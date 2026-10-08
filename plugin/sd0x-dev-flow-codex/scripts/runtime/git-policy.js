'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const DEFAULT_PROTECTED = Object.freeze(['main', 'master', 'develop', 'release/*']);
const POLICY_PATH = '.codex/sd0x-git.json';
const KEYS = new Set(['schema_version', 'branch_naming', 'commit_format', 'protected_branches',
  'offer_mode', 'goal_commit', 'deploy', 'run_steps']);
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function branchName(value) {
  return typeof value === 'string' && value.length > 0 && value !== '@' &&
    !value.startsWith('-') && !value.startsWith('/') && !value.endsWith('/') &&
    !value.endsWith('.') && !value.includes('..') && !value.includes('//') &&
    !value.includes('@{') && !/[\x00-\x20\x7f~^:?*\[\\]/.test(value) &&
    value.split('/').every(part => !part.startsWith('.') && !part.endsWith('.lock'));
}

function branchPattern(value) {
  return typeof value === 'string' && !value.startsWith('!') && branchName(value.endsWith('/*') ? value.slice(0, -1) + 'x' : value);
}

function parsePolicy(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).some(key => !KEYS.has(key)) ||
      (value.schema_version !== undefined && value.schema_version !== 1)) {
    throw new Error('Invalid Git policy; unsupported keys cannot override Anchors');
  }
  const field = (name, fallback) => Object.hasOwn(value, name) ? value[name] : fallback;
  const additions = field('protected_branches', []);
  if (!Array.isArray(additions) || additions.some(item => !branchPattern(item))) {
    throw new Error('Protected branches accept additions only: exact names or prefix/*');
  }
  const result = { schema_version: 1, branch_naming: value.branch_naming ?? null,
    commit_format: value.commit_format ?? null,
    protected_branches: [...new Set([...DEFAULT_PROTECTED, ...additions])],
    offer_mode: field('offer_mode', 'on'), goal_commit: field('goal_commit', 'on'),
    deploy: field('deploy', []), run_steps: field('run_steps', 'print') };
  if (!['on', 'off', 'commit-only'].includes(result.offer_mode) ||
      !['on', 'off'].includes(result.goal_commit) || !['print', 'execute'].includes(result.run_steps)) {
    throw new Error('Invalid Git policy setting');
  }
  for (const name of ['branch_naming', 'commit_format']) {
    if (result[name] !== null && (typeof result[name] !== 'string' ||
        !result[name].trim() || result[name].length > 2000 || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(result[name]))) {
      throw new Error('Invalid naming convention');
    }
  }
  if (!Array.isArray(result.deploy) || result.deploy.length > 100) throw new Error('Invalid deploy steps');
  result.deploy = result.deploy.map(step => {
    if (!step || typeof step !== 'object' || Array.isArray(step)) throw new Error('Invalid deploy step');
    if (step.kind === 'merge' && Object.keys(step).every(key => ['kind', 'source', 'target', 'form'].includes(key)) &&
        branchPattern(step.source) && branchPattern(step.target) && ['no-ff', 'ff-only'].includes(Object.hasOwn(step, 'form') ? step.form : 'no-ff')) {
      return { kind: 'merge', source: step.source, target: step.target, form: step.form ?? 'no-ff' };
    }
    if (step.kind === 'run' && Object.keys(step).every(key => ['kind', 'path', 'args'].includes(key)) &&
        typeof step.path === 'string' && /^[A-Za-z0-9_][A-Za-z0-9_./-]*$/.test(step.path) &&
        step.path.split('/').every(part => part && part !== '.' && part !== '..') &&
        !step.path.startsWith('.git/') && Array.isArray(Object.hasOwn(step, 'args') ? step.args : []) &&
        (step.args ?? []).every(arg => typeof arg === 'string' && !/[\x00-\x1f\x7f]/.test(arg))) {
      return { kind: 'run', path: step.path, args: [...(step.args ?? [])] };
    }
    throw new Error('Invalid deploy step; no steps may execute');
  });
  return result;
}

function readPolicy(root) {
  const directory = path.join(root, '.codex');
  const dir = fs.lstatSync(directory, { throwIfNoEntry: false });
  if (dir && (!dir.isDirectory() || dir.isSymbolicLink())) throw new Error('Git policy directory is not a real directory');
  const file = path.join(root, POLICY_PATH);
  const stat = fs.lstatSync(file, { throwIfNoEntry: false });
  if (!stat) return { policy: parsePolicy(), sha256: null, path: POLICY_PATH, present: false };
  if (!stat.isFile() || stat.isSymbolicLink() || !(stat.mode & 0o444)) throw new Error('Git policy is unreadable or not a regular file');
  const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    const opened = fs.fstatSync(fd);
    if (opened.ino !== stat.ino || opened.dev !== stat.dev) throw new Error('Git policy changed while reading');
    const bytes = fs.readFileSync(fd);
    const after = fs.lstatSync(file);
    if (after.ino !== opened.ino || after.dev !== opened.dev || after.size !== bytes.length ||
        after.mtimeMs !== opened.mtimeMs || after.ctimeMs !== opened.ctimeMs) throw new Error('Git policy changed while reading');
    return { policy: parsePolicy(JSON.parse(bytes.toString('utf8'))), sha256: hash(bytes), path: POLICY_PATH, present: true };
  } finally { fs.closeSync(fd); }
}

function matches(branch, pattern) {
  return pattern.endsWith('/*') ? branch.startsWith(pattern.slice(0, -1)) &&
    branch.length > pattern.length - 1 : branch === pattern;
}

function isProtected(branch, policy) {
  if (!branchName(branch)) throw new Error('Invalid or detached branch');
  return policy.protected_branches.some(pattern => matches(branch, pattern));
}

function offerDecision({ policy, branch, fingerprint, gates, declinedFingerprint, prohibited = false }) {
  if (prohibited || policy.offer_mode === 'off' || !branch || !branchName(branch) ||
      !fingerprint || fingerprint === 'clean' || declinedFingerprint === fingerprint ||
      gates.fingerprint !== fingerprint || gates.review !== 'pass' ||
      (gates.requires_verify && gates.verify !== 'pass') || gates.next_action !== 'complete') return [];
  return isProtected(branch, policy) || policy.offer_mode === 'commit-only'
    ? ['commit', 'not-now'] : ['commit', 'commit-and-push', 'not-now'];
}

// This is eligibility, never an authorization issuer. The caller must establish
// the user's actual grant from conversation; files and model-created goals cannot.
function goalCommitEligible({ policy, goal, root, branch, fingerprint, gates, now = Date.now() }) {
  return Boolean(policy.goal_commit === 'on' && goal &&
    ['user', 'user-approved'].includes(goal.origin) && goal.status === 'active' &&
    goal.commit_authorized === true && typeof goal.id === 'string' && goal.id.length &&
    goal.root === root && goal.branch === branch && branchName(branch) &&
    Number.isFinite(goal.expires_at) && goal.expires_at > now &&
    (!isProtected(branch, policy) || goal.protected_branch_authorized === true) &&
    fingerprint && fingerprint !== 'clean' && gates.fingerprint === fingerprint &&
    gates.review === 'pass' && (!gates.requires_verify || gates.verify === 'pass') &&
    gates.next_action === 'complete');
}

module.exports = { DEFAULT_PROTECTED, POLICY_PATH, branchName, branchPattern, parsePolicy,
  readPolicy, matches, isProtected, offerDecision, goalCommitEligible };

function scaffoldPolicy(root) {
  root = fs.realpathSync(root);
  const current = readPolicy(root);
  if (current.present) return { created: false, path: POLICY_PATH, reason: 'user-owned policy preserved' };
  const directory = path.join(root, '.codex');
  fs.mkdirSync(directory, { recursive: true });
  if (fs.lstatSync(directory).isSymbolicLink() || !fs.statSync(directory).isDirectory()) throw new Error('Unsafe policy directory');
  const example = { schema_version: 1, branch_naming: null, commit_format: null,
    protected_branches: [], offer_mode: 'on', goal_commit: 'on', deploy: [], run_steps: 'print' };
  // Exclusive creation never replaces a concurrently created user file.
  fs.writeFileSync(path.join(root, POLICY_PATH), JSON.stringify(example, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  return { created: true, path: POLICY_PATH };
}
module.exports.scaffoldPolicy = scaffoldPolicy;
