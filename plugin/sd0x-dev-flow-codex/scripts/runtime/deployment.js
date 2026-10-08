'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { readPolicy, branchName, matches } = require('./git-policy');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const digest = value => hash(JSON.stringify(value));
const IMPLEMENTATION_SHA256 = hash(Buffer.concat([fs.readFileSync(__filename), fs.readFileSync(require.resolve('./git-policy'))]));

function environment() {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (/^(?:GIT_(?:DIR|WORK_TREE|COMMON_DIR|INDEX_FILE|OBJECT_DIRECTORY|ALTERNATE_OBJECT_DIRECTORIES|NAMESPACE|CONFIG.*|EXEC_PATH|EXTERNAL_DIFF|REPLACE_REF_BASE|SHALLOW_FILE|GRAFT_FILE)|BASH_ENV|ENV|ALLOW_AI_COAUTHOR|ALLOW_PUSH_PROTECTED|ALLOW_FORCE_UNSHARED|ALLOW_FORCE_WITH_LEASE)$/.test(key)) delete env[key];
  }
  env.GIT_NO_REPLACE_OBJECTS = '1';
  env.GIT_GRAFT_FILE = os.devNull;
  env.GIT_TERMINAL_PROMPT = '0';
  env.GIT_MERGE_AUTOEDIT = 'no';
  return env;
}

function git(root, args, acceptFailure = false) {
  const result = spawnSync('git', ['--no-replace-objects', '-c', 'core.fsmonitor=false', '-C', root, ...args], {
    encoding: 'utf8', env: environment(), maxBuffer: 4 * 1024 * 1024, timeout: 120000
  });
  if (result.status !== 0 && !acceptFailure) throw new Error('Git precondition failed: ' + args[0]);
  return acceptFailure ? result : result.stdout.trimEnd();
}

function clean(root) {
  if (git(root, ['rev-parse', '--show-toplevel']) !== fs.realpathSync(root)) throw new Error('Repository root mismatch');
  if (git(root, ['status', '--porcelain=v1', '--untracked-files=all'])) throw new Error('Deploy requires a clean worktree');
  for (const name of ['MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'rebase-merge', 'rebase-apply']) {
    const file = git(root, ['rev-parse', '--git-path', name]);
    if (fs.existsSync(path.resolve(root, file))) throw new Error('Existing Git operation blocks deployment');
  }
}

function oid(root, branch) {
  if (!branchName(branch)) throw new Error('A concrete local branch is required');
  return git(root, ['rev-parse', '--verify', `refs/heads/${branch}^{commit}`]);
}

function scriptIdentity(root, relative) {
  let file = root;
  for (const part of relative.split('/')) {
    file = path.join(file, part);
    if (fs.lstatSync(file).isSymbolicLink()) throw new Error('Deploy script path contains a symlink');
  }
  const stat = fs.statSync(file);
  if (!stat.isFile() || !(stat.mode & 0o111)) throw new Error('Deploy script must be an executable regular file');
  git(root, ['ls-files', '--error-unmatch', '--', relative]);
  return { sha256: hash(fs.readFileSync(file)), mode: stat.mode & 0o777 };
}

function planStep(root, index, bindings = {}, flowPolicyHash) {
  root = fs.realpathSync(root);
  clean(root);
  const config = readPolicy(root);
  if (flowPolicyHash !== undefined && flowPolicyHash !== config.sha256) throw new Error('Deploy declaration changed; stop the flow');
  const step = config.policy.deploy[index];
  if (!Number.isSafeInteger(index) || index < 0 || !step) throw new Error('Undeclared deploy step');
  const plan = { schema_version: 1, implementation_sha256: IMPLEMENTATION_SHA256, root, policy_sha256: config.sha256, index,
    head: git(root, ['rev-parse', 'HEAD']), branch: git(root, ['symbolic-ref', '--quiet', '--short', 'HEAD']),
    step: { ...step } };
  if (step.kind === 'merge') {
    const source = bindings.source ?? step.source, target = bindings.target ?? step.target;
    if (!branchName(source) || !branchName(target) || !matches(source, step.source) || !matches(target, step.target)) {
      throw new Error('Merge bindings do not match the declaration');
    }
    plan.step = { ...step, source, target };
    plan.source_oid = oid(root, source);
    plan.target_oid = oid(root, target);
    if (git(root, ['merge-base', '--is-ancestor', plan.source_oid, plan.target_oid], true).status === 0) {
      throw new Error('Source is already merged; no mutation required');
    }
    if (step.form === 'ff-only' && git(root, ['merge-base', '--is-ancestor', plan.target_oid, plan.source_oid], true).status !== 0) {
      throw new Error('Target cannot fast-forward');
    }
    plan.message = `Merge branch '${source}' into ${target}`;
    plan.argv = ['git', 'merge', '--' + step.form, '--no-edit', ...(step.form === 'no-ff' ? ['-m', plan.message] : []), plan.source_oid];
    plan.effects = ['switch-target-branch', 'merge-local-history'];
  } else {
    plan.script = scriptIdentity(root, step.path);
    plan.argv = [path.join(root, step.path), ...step.args];
    plan.run_steps = config.policy.run_steps;
    plan.effects = ['script-can-commit-push-merge-publish-deploy-with-user-credentials'];
  }
  return { ...plan, plan_sha256: digest(plan) };
}

function executeStep(root, plan, authorization) {
  // The skill establishes authorization from the actual user instruction. A
  // matching digest binds scope; it does not make a configuration an approval.
  if (!authorization || authorization.plan_sha256 !== plan.plan_sha256) throw new Error('Exact step authorization is required');
  const { plan_sha256, ...subject } = plan;
  if (digest(subject) !== plan_sha256 || fs.realpathSync(root) !== plan.root) throw new Error('Deploy plan identity mismatch');
  const current = planStep(root, plan.index, plan.step, plan.policy_sha256);
  if (current.plan_sha256 !== plan_sha256) throw new Error('Deploy plan drift; nothing executed');
  if (plan.step.kind === 'run') {
    if (plan.run_steps !== 'execute') return { outcome: 'printed', executed: false, argv: plan.argv };
    const result = spawnSync(plan.argv[0], plan.argv.slice(1), {
      cwd: plan.root, env: environment(), encoding: 'utf8', timeout: 30 * 60 * 1000, maxBuffer: 4 * 1024 * 1024
    });
    return { outcome: result.status === 0 ? 'complete' : 'failed', executed: true,
      exit_code: result.status, signal: result.signal, plan_sha256,
      stdout_sha256: hash(result.stdout || ''), stderr_sha256: hash(result.stderr || ''),
      requires_reconciliation: result.status !== 0 };
  }
  git(root, ['switch', '--', plan.step.target]);
  if (git(root, ['rev-parse', 'HEAD']) !== plan.target_oid || readPolicy(root).sha256 !== plan.policy_sha256) {
    throw new Error('Target/declaration changed after switch; merge not executed');
  }
  const result = git(root, plan.argv.slice(1), true);
  if (result.status !== 0) {
    const mergeHead = path.resolve(root, git(root, ['rev-parse', '--git-path', 'MERGE_HEAD']));
    const aborted = fs.existsSync(mergeHead) ? git(root, ['merge', '--abort'], true).status === 0 : false;
    return { outcome: 'failed', executed: true, exit_code: result.status, conflict_aborted: aborted,
      head: git(root, ['rev-parse', 'HEAD']), plan_sha256, requires_reconciliation: true };
  }
  const head = git(root, ['rev-parse', 'HEAD']);
  const valid = plan.step.form === 'ff-only' ? head === plan.source_oid :
    git(root, ['show', '-s', '--format=%P', head]) === `${plan.target_oid} ${plan.source_oid}` &&
    git(root, ['show', '-s', '--format=%B', head]) === plan.message;
  return { outcome: valid ? 'complete' : 'readback-mismatch', executed: true, head,
    plan_sha256, requires_reconciliation: !valid };
}

async function runFlow(root, { authorize, bind = () => ({}) }) {
  const initial = readPolicy(root);
  const results = [];
  for (let index = 0; index < initial.policy.deploy.length; index++) {
    try {
      const plan = planStep(root, index, await bind(initial.policy.deploy[index]), initial.sha256);
      if (plan.step.kind === 'run' && plan.run_steps === 'print') {
        results.push({ outcome: 'printed', executed: false, argv: plan.argv });
        continue;
      }
      const authorization = await authorize(plan);
      if (!authorization) return { outcome: 'declined', stopped_at: index, results };
      const result = executeStep(root, plan, authorization);
      results.push(result);
      if (result.outcome !== 'complete') return { outcome: 'stopped', stopped_at: index, results };
    } catch (error) {
      return { outcome: 'stopped', stopped_at: index, reason: error.message, results };
    }
  }
  return { outcome: 'complete', results };
}

module.exports = { environment, clean, oid, scriptIdentity, planStep, executeStep, runFlow };
