'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { assertClean } = require('./attribution');
const { readPolicy, isProtected } = require('./git-policy');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const IMPLEMENTATION = hash(fs.readFileSync(__filename));
function assertMessage(text) {
  assertClean(text);
  if (/\b(?:gh[opsu]_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9_-]{20,}|AKIA[A-Z0-9]{16})\b|-----BEGIN [A-Z ]*PRIVATE KEY-----|\bBearer\s+[A-Za-z0-9._~+/-]{12,}|[a-z][a-z0-9+.-]*:\/\/[^\s/@]+:[^\s/@]+@/i.test(text)) throw new Error('Commit payload contains secret material');
}
const IDENTITY_ENV = /^(?:GIT_(?:AUTHOR|COMMITTER)_(?:NAME|EMAIL|DATE))$/;

function environment(source = process.env) {
  const result = { ...source };
  for (const key of Object.keys(result)) {
    if ((/^GIT_/i.test(key) && !IDENTITY_ENV.test(key)) ||
        /^(?:NODE_OPTIONS|NODE_PATH|LD_PRELOAD|LD_LIBRARY_PATH|DYLD_.*|BASH_ENV|ENV|SHELLOPTS|BASHOPTS|BASH_FUNC_.*|ALLOW_AI_COAUTHOR)$/i.test(key)) delete result[key];
  }
  return { ...result, LANG: 'C', LC_ALL: 'C', GIT_TERMINAL_PROMPT: '0', GIT_NO_LAZY_FETCH: '1',
    GIT_NO_REPLACE_OBJECTS: '1', GIT_OPTIONAL_LOCKS: '0' };
}
function git(root, args, options = {}) {
  const result = spawnSync('git', ['--no-pager', '-c', 'core.fsmonitor=false', ...args], {
    cwd: root, env: { ...environment(), ...(options.environment || {}) }, input: options.input === undefined ? undefined : Buffer.from(options.input),
    encoding: 'buffer', timeout: options.timeout || 30000, maxBuffer: 32 * 1024 * 1024,
    windowsHide: true
  });
  if (result.error || result.signal || ![0, ...(options.allowed || [])].includes(result.status)) {
    throw new Error('Git operation failed: ' + args[0]);
  }
  const bytes = result.stdout || Buffer.alloc(0);
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  return { text, status: result.status, output_sha256: hash(Buffer.concat([bytes, result.stderr || Buffer.alloc(0)])) };
}
function line(value) {
  if (!value.endsWith('\n')) throw new Error('Truncated Git record');
  return value.slice(0, -1);
}
function repository(cwd) {
  const root = fs.realpathSync(line(git(cwd, ['rev-parse', '--show-toplevel']).text));
  if (fs.realpathSync(cwd) !== root) throw new Error('Commit workflow requires repository root cwd');
  return root;
}
function config(root) {
  const raw = git(root, ['config', '--null', '--list', '--show-scope', '--show-origin']).text;
  const fields = raw.split('\0');
  if (fields.pop() !== '' || fields.length % 3) throw new Error('Malformed configuration records');
  const records = [];
  for (let index = 0; index < fields.length; index += 3) {
    const separator = fields[index + 2].indexOf('\n');
    if (separator === 0 || !fields[index + 2] || !['system', 'global', 'local', 'worktree', 'command'].includes(fields[index])) throw new Error('Malformed configuration record');
    records.push({ scope: fields[index], origin: fields[index + 1], key: separator < 0 ? fields[index + 2] : fields[index + 2].slice(0, separator), value: separator < 0 ? null : fields[index + 2].slice(separator + 1) });
  }
  const effective = new Map(records.map(record => [record.key, record]));
  for (const [key, record] of effective) {
    if (/^(?:core\.(?:hookspath|attributesfile|fsmonitor)|gpg\.(?:program|openpgp\.program|x509\.program|ssh\.(?:program|defaultkeycommand))|filter\..*\.(?:clean|process)|diff\..*\.(?:command|textconv)|merge\..*\.driver)$/.test(key) &&
        !['local', 'worktree'].includes(record.scope) && !((key === 'core.fsmonitor') && ['false', '0', 'no', 'off', ''].includes(String(record.value).toLowerCase()))) {
      throw new Error('Executable Git configuration requires repository/worktree ownership: ' + key);
    }
  }
  const identities = ['user.name', 'user.email', 'author.name', 'author.email', 'committer.name', 'committer.email'].map(key => ({ key,
    records: records.filter(record => record.key === key).map(record => ({ scope: record.scope,
      origin_sha256: hash(record.origin), kind: record.value === null ? 'valueless' : record.value === '' ? 'empty' : 'value', value_sha256: record.value === null ? null : hash(record.value) })),
    present: effective.has(key) }));
  const signing = git(root, ['config', '--type=bool', '--get', 'commit.gpgsign'], { allowed: [1] });
  return { sha256: hash(raw), identities, signing: signing.status === 1 ? 'unset' : line(signing.text), effective };
}
function overlays(root) {
  if (line(git(root, ['rev-parse', '--is-shallow-repository']).text) !== 'false') throw new Error('Shallow history cannot certify commit ancestry');
  for (const name of ['info/grafts', 'shallow']) {
    const file = path.resolve(root, line(git(root, ['rev-parse', '--git-path', name]).text));
    const stat = fs.lstatSync(file, { throwIfNoEntry: false });
    if (stat && (stat.isSymbolicLink() || !stat.isFile() || stat.size > 0)) throw new Error('Ancestry overlay cannot certify commit history');
  }
  if (git(root, ['for-each-ref', '--format=%(refname)', 'refs/replace/']).text) throw new Error('Replacement refs cannot certify commit history');
}
function tips(root) {
  const raw = git(root, ['for-each-ref', '--format=%(objectname) %(refname)']).text;
  return raw.split('\n').filter(Boolean).map(record => {
    const match = /^([0-9a-f]{40,64}) (refs\/[^\s\x00-\x1f]+)$/.exec(record);
    if (!match) throw new Error('Invalid reference enumeration');
    return { oid: match[1], ref: match[2] };
  });
}
function fileTree(root, excludeGit = true, selected = null) {
  const digest = crypto.createHash('sha256'); let total = 0;
  function append(value) {
    const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value);
    digest.update(String(bytes.length) + ':').update(bytes);
  }
  function walk(absolute, relative) {
    if (excludeGit && relative === '.git') return;
    const stat = fs.lstatSync(absolute);
    append(JSON.stringify([relative, stat.mode]));
    if (stat.isSymbolicLink()) { append(fs.readlinkSync(absolute)); return; }
    if (stat.isDirectory()) { for (const name of fs.readdirSync(absolute).sort()) walk(path.join(absolute, name), relative ? relative + '/' + name : name); return; }
    if (!stat.isFile() || !(stat.mode & 0o444) || (total += stat.size) > 512 * 1024 * 1024) throw new Error('Commit observation incomplete');
    const fd = fs.openSync(absolute, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
    try {
      const before = fs.fstatSync(fd);
      if (before.ino !== stat.ino || before.dev !== stat.dev) throw new Error('Commit observation raced');
      append(fs.readFileSync(fd));
      const after = fs.fstatSync(fd), current = fs.lstatSync(absolute);
      if (after.size !== before.size || after.mtimeMs !== before.mtimeMs || after.ctimeMs !== before.ctimeMs || current.ino !== before.ino || current.dev !== before.dev) throw new Error('Commit observation raced');
    } finally { fs.closeSync(fd); }
  }
  if (selected) {
    for (const relative of selected) {
      const parts = relative.split('/');
      if (parts.some(part => !part || part === '.' || part === '..' || part.toLowerCase() === '.git') || relative.includes('\\')) throw new Error('Invalid observed worktree path');
      const ancestors = [];
      let missing = false;
      for (let i = 1; i < parts.length; i++) {
        const parent = path.join(root, ...parts.slice(0, i));
        const stat = fs.lstatSync(parent, { throwIfNoEntry: false });
        if (!stat) { missing = true; break; }
        if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Observed worktree ancestor is not a directory');
        ancestors.push({ parent, stat });
      }
      const absolute = path.join(root, relative);
      const stat = missing ? null : fs.lstatSync(absolute, { throwIfNoEntry: false });
      if (!stat) append(JSON.stringify([relative, 'absent']));
      else {
        if (stat.isDirectory()) throw new Error('Observed worktree path is a directory');
        walk(absolute, relative);
        const after = fs.lstatSync(absolute);
        if (after.ino !== stat.ino || after.dev !== stat.dev || after.mtimeMs !== stat.mtimeMs || after.ctimeMs !== stat.ctimeMs) throw new Error('Commit observation raced');
      }
      for (const { parent, stat: before } of ancestors) {
        const after = fs.lstatSync(parent);
        if (!after.isDirectory() || after.ino !== before.ino || after.dev !== before.dev) throw new Error('Commit observation raced');
      }
    }
  } else walk(root, '');
  return digest.digest('hex');
}
function worktreePaths(root, retained = []) {
  // Git-owned content includes tracked files even when ignored. Runtime caches,
  // sockets and other ignored local artifacts are outside the commit subject.
  const paths = git(root, ['ls-files', '--cached', '--others', '--exclude-standard', '-z']).text.split('\0').filter(Boolean);
  const head = headOid(root);
  if (head) paths.push(...git(root, ['ls-tree', '-r', '--name-only', '-z', head]).text.split('\0').filter(Boolean));
  return [...new Set([...paths, ...retained])].sort();
}
function observeWorktree(root, retained = []) {
  const paths = worktreePaths(root, retained);
  const sha256 = fileTree(root, true, paths);
  if (JSON.stringify(worktreePaths(root, retained)) !== JSON.stringify(paths)) throw new Error('Commit observation raced');
  return { paths, sha256 };
}
function index(root) {
  const raw = git(root, ['ls-files', '--stage', '-z']).text;
  const entries = raw.split('\0').filter(Boolean).map(record => {
    const match = /^(100644|100755|120000) ([0-9a-f]{40,64}) 0\t([\s\S]+)$/.exec(record);
    if (!match) throw new Error('Unmerged or submodule index requires explicit reconciliation');
    return { mode: match[1], oid: match[2], file: match[3] };
  });
  const debug = git(root, ['ls-files', '--debug']).text;
  if ([...debug.matchAll(/flags: ([0-9a-f]+)/g)].some(match => (parseInt(match[1], 16) & 0x20000000) !== 0)) throw new Error('Intent-to-add entries cannot be committed by this workflow');
  return { entries, sha256: hash(raw) };
}
function treeOid(entries, format) {
  const tree = new Map();
  for (const entry of entries) {
    let parent = tree; const parts = entry.file.split('/');
    for (const part of parts.slice(0, -1)) {
      if (!part || part === '.' || part === '..') throw new Error('Invalid index path');
      if (!parent.has(part)) parent.set(part, new Map());
      parent = parent.get(part); if (!(parent instanceof Map)) throw new Error('Index path conflict');
    }
    parent.set(parts.at(-1), entry);
  }
  function serialize(directory) {
    const sorted = [...directory].sort(([a, av], [b, bv]) => Buffer.compare(Buffer.from(a + (av instanceof Map ? '/' : '')), Buffer.from(b + (bv instanceof Map ? '/' : ''))));
    const bytes = Buffer.concat(sorted.map(([name, entry]) => Buffer.concat([
      Buffer.from(`${entry instanceof Map ? '40000' : entry.mode} ${name}\0`),
      Buffer.from(entry instanceof Map ? serialize(entry) : entry.oid, 'hex')
    ])));
    return crypto.createHash(format).update(Buffer.from(`tree ${bytes.length}\0`)).update(bytes).digest('hex');
  }
  return serialize(tree);
}
function ident(root, role) {
  const full = line(git(root, ['var', `GIT_${role}_IDENT`]).text);
  const match = /^(.+ <[^<>\r\n]+>) \d+ [+-]\d{4}$/.exec(full);
  if (!match) throw new Error('Effective Git identity is empty or malformed');
  assertClean(match[1]); return hash(match[1]);
}
function headOid(root) {
  const result = git(root, ['rev-parse', '--verify', '--quiet', 'HEAD^{commit}'], { allowed: [1] });
  return result.status === 1 ? null : line(result.text);
}
function inspect(cwd) {
  const root = repository(cwd); overlays(root);
  const cfg = config(root);
  const branch = line(git(root, ['symbolic-ref', '--quiet', 'HEAD']).text);
  const head = headOid(root);
  const staged = index(root);
  const format = line(git(root, ['rev-parse', '--show-object-format']).text);
  if (!['sha1', 'sha256'].includes(format)) throw new Error('Unsupported object format');
  const tree = treeOid(staged.entries, format);
  if ((!head && !staged.entries.length) || (head && line(git(root, ['rev-parse', 'HEAD^{tree}']).text) === tree)) throw new Error('Index has no staged changes');
  const hooksPath = path.resolve(root, line(git(root, ['rev-parse', '--git-path', 'hooks']).text));
  const hookStat = fs.lstatSync(hooksPath, { throwIfNoEntry: false });
  if (hookStat?.isSymbolicLink() || (hookStat && !hookStat.isDirectory())) throw new Error('Hooks directory must be a real directory');
  const hooks = hookStat ? fileTree(hooksPath, false) : null;
  const worktree = observeWorktree(root);
  return { schema_version: 1, root, branch, head, tree, index_sha256: staged.sha256,
    staged_paths: git(root, ['diff', '--cached', '--name-only', '-z', '--no-ext-diff', '--no-textconv', '--']).text.split('\0').filter(Boolean),
    worktree_sha256: worktree.sha256, worktree_paths: worktree.paths, config_sha256: cfg.sha256, configured_identities: cfg.identities,
    author_sha256: ident(root, 'AUTHOR'), committer_sha256: ident(root, 'COMMITTER'), signing: cfg.signing,
    hooks_sha256: hooks, refs: tips(root), implementation_sha256: IMPLEMENTATION,
    environment_sha256: hash(JSON.stringify(Object.entries(environment()).sort(([a], [b]) => a.localeCompare(b)))),
    policy_sha256: readPolicy(root).sha256 };
}
function plan(cwd, message) {
  assertMessage(message);
  if (!message.trim() || message.includes('\0')) throw new Error('Commit message must be nonempty literal text');
  const subject = inspect(cwd);
  const body = message.trimEnd() + '\n';
  return { ...subject, message: body, message_sha256: hash(body) };
}
function planHash(value) { return hash(JSON.stringify(value)); }
function audit(cwd, before, marker) {
  const root = repository(cwd); overlays(root);
  const afterTips = tips(root);
  const beforeOids = [...new Set(before.refs.map(record => record.oid).concat(before.head).filter(Boolean))];
  const afterHead = headOid(root);
  const afterOids = [...new Set(afterTips.map(record => record.oid).concat(afterHead).filter(Boolean))];
  const revisionInput = afterOids.concat(beforeOids.map(oid => '^' + oid)).join('\n') + '\n';
  const created = afterOids.length ? git(root, ['rev-list', '--stdin'], { input: revisionInput }).text.split('\n').filter(Boolean) : [];
  const reflogs = git(root, ['reflog', 'show', '--all', '--no-show-signature', '--format=%H%x00%gs']).text.split('\n').filter(Boolean);
  const rows = created.map(oid => {
    const raw = git(root, ['cat-file', 'commit', oid]).text;
    const separator = raw.indexOf('\n\n'); if (separator < 0) throw new Error('Malformed commit object');
    const headers = raw.slice(0, separator), message = raw.slice(separator + 2);
    assertMessage(message);
    const parents = [...headers.matchAll(/^parent ([0-9a-f]+)$/gm)].map(match => match[1]);
    const tree = /^tree ([0-9a-f]+)$/m.exec(headers)?.[1];
    const author = /^author (.+ <[^<>]+>) \d+ [+-]\d{4}$/m.exec(headers)?.[1];
    const committer = /^committer (.+ <[^<>]+>) \d+ [+-]\d{4}$/m.exec(headers)?.[1];
    if (!author || !committer) throw new Error('Malformed commit identity');
    return { oid, parents, tree, message_sha256: hash(message), author_sha256: hash(author), committer_sha256: hash(committer),
      signed: /^gpgsig(?:-sha256)? /m.test(headers),
      origin: typeof marker === 'string' && marker && reflogs.some(record => record === `${oid}\0${marker}` || record.startsWith(`${oid}\0${marker}:`)) ? 'this-invocation' : 'unknown' };
  });
  const owned = rows.find(row => row.oid === afterHead);
  const beforeMap = new Map(before.refs.map(row => [row.ref, row.oid]));
  const afterMap = new Map(afterTips.map(row => [row.ref, row.oid]));
  const changedRefs = [...new Set([...beforeMap.keys(), ...afterMap.keys()])].filter(ref => beforeMap.get(ref) !== afterMap.get(ref));
  const currentConfig = config(root);
  const currentHooksPath = path.resolve(root, line(git(root, ['rev-parse', '--git-path', 'hooks']).text));
  const currentHooks = fs.existsSync(currentHooksPath) ? fileTree(currentHooksPath, false) : null;
  const complete = currentConfig.sha256 === before.config_sha256 && currentHooks === before.hooks_sha256 &&
    (before.signing !== 'true' || owned?.signed === true) && rows.length === 1 && owned?.origin === 'this-invocation' &&
    owned.tree === before.tree && JSON.stringify(owned.parents) === JSON.stringify(before.head ? [before.head] : []) &&
    owned.message_sha256 === before.message_sha256 && owned.author_sha256 === before.author_sha256 &&
    owned.committer_sha256 === before.committer_sha256 && changedRefs.length === 1 && changedRefs[0] === before.branch &&
    line(git(root, ['symbolic-ref', '--quiet', 'HEAD']).text) === before.branch &&
    observeWorktree(root, before.worktree_paths).sha256 === before.worktree_sha256 && index(root).sha256 === before.index_sha256;
  return { outcome: complete ? 'complete' : 'partial-or-unknown', head: afterHead, changed_refs: changedRefs,
    created_commits: rows, retries_authorized: false };
}
function execute(cwd, prepared, grant) {
  if (!grant || grant.action !== 'commit' || grant.plan_sha256 !== planHash(prepared)) throw new Error('Exact user commit grant required');
  const fresh = plan(cwd, prepared.message);
  if (planHash(fresh) !== planHash(prepared)) throw new Error('Commit subject drifted');
  if (isProtected(prepared.branch.slice('refs/heads/'.length), readPolicy(prepared.root).policy) && grant.protected_branch !== true) throw new Error('Protected branch commit grant required');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-commit-'));
  const messageFile = path.join(directory, 'message');
  const marker = 'sd0x-commit-' + crypto.randomUUID();
  try {
    fs.writeFileSync(messageFile, prepared.message, { mode: 0o600, flag: 'wx' });
    let result = null, executionError = null;
    try {
      result = git(prepared.root, ['commit', '--cleanup=verbatim', '-F', messageFile],
        { timeout: 120000, allowed: Array.from({ length: 255 }, (_, index) => index + 1), environment: { GIT_REFLOG_ACTION: marker } });
    } catch (error) { executionError = error.message; }
    // Observe even a timeout/signal: a ref update may precede a failed post-commit hook.
    let observed;
    try { observed = audit(prepared.root, prepared, marker); }
    catch (error) {
      return { outcome: 'partial-or-unknown', marker, exit_code: result?.status ?? null,
        execution_error: executionError, observation_error: error.message, retries_authorized: false };
    }
    return { ...observed, marker, exit_code: result?.status ?? null,
      output_sha256: result?.output_sha256 ?? null, execution_error: executionError,
      outcome: result?.status === 0 ? observed.outcome : observed.created_commits.length ? 'partial-or-unknown' : 'failed' };
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
}
module.exports = { environment, config, inspect, plan, planHash, audit, execute, treeOid };
