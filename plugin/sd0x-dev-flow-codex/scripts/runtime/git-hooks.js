'use strict';

// Native Git hooks are separate from Codex event hooks. Installation changes only
// explicitly selected repository wiring; no config, foreign hook or gate evidence.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { environment } = require('./commit-workflow');
const attribution = require('./attribution');
const policy = require('./git-policy');
const { redactOutput } = require('../../skills/debug/scripts/probe-redaction');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const quote = value => "'" + value.replaceAll("'", "'\\''") + "'";
const names = ['commit-msg', 'pre-push'];
const prefix = '# sd0x-native-git-hook:v1';
function git(root, args, allowed = []) {
  const r = spawnSync('git', ['-c', 'core.fsmonitor=false', '-C', root, ...args], {
    env: environment(), encoding: 'utf8', timeout: 30000, maxBuffer: 1024 * 1024
  });
  if (r.error || r.signal || (r.status !== 0 && !allowed.includes(r.status))) throw new Error('Git hook discovery failed');
  return r;
}
function regular(file, absent = false) {
  let current = path.parse(file).root;
  for (const [index, part] of file.slice(current.length).split(path.sep).entries()) {
    current = path.join(current, part);
    const stat = fs.lstatSync(current, { throwIfNoEntry: false });
    if (!stat && absent) return null;
    if (!stat || stat.isSymbolicLink()) throw new Error('Missing or symlinked hook path');
    if (current !== file && !stat.isDirectory()) throw new Error('Invalid hook parent');
  }
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.size > 1024 * 1024 || !(stat.mode & 0o444)) throw new Error('Unreadable or oversized hook file');
  const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    const opened = fs.fstatSync(fd);
    if (opened.dev !== stat.dev || opened.ino !== stat.ino) throw new Error('Hook path changed');
    const bytes = fs.readFileSync(fd), text = bytes.toString('utf8');
    if (bytes.length > 1024 * 1024 || bytes.includes(0) || !Buffer.from(text).equals(bytes)) throw new Error('Invalid hook bytes');
    return text;
  }
  finally { fs.closeSync(fd); }
}
function context(root) {
  const suppliedRoot = path.resolve(root);
  root = fs.realpathSync(root);
  if (git(root, ['rev-parse', '--show-toplevel']).stdout.trim() !== root) throw new Error('Use exact repository root');
  const metadata = path.resolve(root, git(root, ['rev-parse', '--absolute-git-dir']).stdout.trim());
  const file = path.join(metadata, 'sd0x-native-git-hooks.json');
  const bytes = regular(file, true);
  const state = bytes === null ? { schema_version: 1, hooks: {} } : JSON.parse(bytes);
  if (state.schema_version !== 1 || !state.hooks || typeof state.hooks !== 'object' || Array.isArray(state.hooks) || Object.keys(state.hooks).some(n => !names.includes(n))) throw new Error('Invalid Git hook install state');
  const configured = git(root, ['config', '--path', '--get', 'core.hooksPath'], [1]);
  const resolved = name => {
    const value = path.resolve(root, git(root, ['rev-parse', '--git-path', `hooks/${name}`]).stdout.trim());
    if (value.startsWith(root + path.sep)) return value;
    if (value.startsWith(suppliedRoot + path.sep)) return path.join(root, path.relative(suppliedRoot, value));
    // Git may retain an absolute spelling through a system/repository alias
    // (macOS /var versus /private/var). Normalize only the repository ancestor,
    // preserving all descendant components for the no-symlink ownership checks.
    let normalized = value;
    for (let parent = path.dirname(value); parent !== path.dirname(parent); parent = path.dirname(parent)) {
      try {
        if (fs.realpathSync(parent) === root) normalized = path.join(root, path.relative(parent, value));
      } catch { /* An absent ancestor cannot establish repository identity. */ }
    }
    return normalized;
  };
  return { root, metadata, file, bytes, state, configured: configured.status === 0, resolved };
}
function ownedBlock(text, name) {
  const open = `${prefix} ${name}:start`, close = `${prefix} ${name}:end`;
  const starts = [...text.matchAll(new RegExp('^' + open + '$', 'gm'))], ends = [...text.matchAll(new RegExp('^' + close + '$', 'gm'))];
  if (!starts.length && !ends.length) return null;
  if (starts.length !== 1 || ends.length !== 1 || starts[0].index >= ends[0].index) throw new Error('Damaged or duplicate native hook block');
  const start = starts[0].index, end = ends[0].index + close.length + (text[ends[0].index + close.length] === '\n' ? 1 : 0);
  const bytes = text.slice(start, end);
  if (!bytes.includes('--guard ' + name) && !bytes.includes('--capture pre-push')) throw new Error('Empty native hook block');
  return { start, end, bytes };
}
function block(name, runtime = __filename) {
  const node = `/usr/bin/env -u NODE_OPTIONS -u NODE_PATH -u BASH_ENV -u ENV ${quote(process.execPath)} ${quote(runtime)}`;
  const guard = name === 'pre-push'
    ? `__sd0x_stream=$(${node} --capture pre-push "$@")\ncase "$?" in 0) ;; *) __sd0x_refuse=''; : "\${__sd0x_refuse:?sd0x pre-push refused}" ;; esac\ncase "$__sd0x_stream" in /*) ;; *) __sd0x_refuse=''; : "\${__sd0x_refuse:?missing ref stream}" ;; esac\nexec 0< "$__sd0x_stream"\n${node} --unlink "$__sd0x_stream"\n`
    : `${node} --guard commit-msg "$@"\ncase "$?" in 0) ;; *) __sd0x_refuse=''; : "\${__sd0x_refuse:?sd0x commit-msg refused}" ;; esac\n`;
  return `${prefix} ${name}:start\n${guard}${prefix} ${name}:end\n`;
}
function routeActive(c, name, entry, text) {
  if (!entry?.written_path || !text || typeof entry.node_path !== 'string' ||
    typeof entry.runtime_path !== 'string' || !path.isAbsolute(entry.node_path) ||
    !path.isAbsolute(entry.runtime_path) || !regular(entry.runtime_path, true)) return false;
  const executable = fs.lstatSync(entry.node_path, { throwIfNoEntry: false });
  if (!executable?.isFile() || executable.isSymbolicLink() || !(executable.mode & 0o111)) return false;
  fs.accessSync(entry.node_path, fs.constants.X_OK);
  const written = path.resolve(c.root, entry.written_path), resolved = c.resolved(name);
  const stat = fs.lstatSync(resolved, { throwIfNoEntry: false });
  if (!stat?.isFile() || stat.isSymbolicLink() || !(stat.mode & 0o111)) return false;
  const segment = ownedBlock(text, name);
  if (!segment || hash(segment.bytes) !== entry.block_sha256) return false;
  if (resolved === written) return true;
  // Recognize the modern Husky shim chain; this is static routing evidence,
  // never a claim that arbitrary hook bodies executed successfully.
  if (entry.mode !== 'husky' || resolved !== path.join(c.root, '.husky/_', name)) return false;
  const shim = regular(resolved), helper = regular(path.join(c.root, '.husky/_/h'), true);
  return /\. "\$\(dirname "\$0"\)\/h"/.test(shim) && Boolean(helper && /\$\(dirname "\$\(dirname "\$0"\)"\)/.test(helper) && /sh -e "\$s" "\$@"/.test(helper));
}
function doctor(root) {
  const c = context(root), hooks = {};
  for (const name of names) {
    const entry = c.state.hooks[name];
    if (!entry || entry.status === 'declined') { hooks[name] = { status: entry?.status || 'unknown', active: false }; continue; }
    try {
      const text = regular(path.resolve(c.root, entry.written_path), true);
      const active = routeActive(c, name, entry, text);
      hooks[name] = { ...entry, status: active ? 'installed' : 'pending', active,
        bytes_current: Boolean(text && hash(text) === entry.file_sha256), activation_evidence: 'static-git-routing' };
    } catch { hooks[name] = { ...entry, status: 'pending', active: false, reason: 'unreadable-or-invalid-wiring' }; }
  }
  return { root: c.root, hooks, execution_observed: false };
}
function install(root, options = {}) {
  if (Object.keys(options).some(k => !['with_push_gate', 'fallback'].includes(k)) || Object.values(options).some(v => typeof v !== 'boolean')) throw new Error('Unknown Git hook install options');
  const c = context(root), husky = fs.lstatSync(path.join(c.root, '.husky'), { throwIfNoEntry: false });
  if (husky?.isSymbolicLink()) throw new Error('Symlinked Husky directory');
  let mode = husky?.isDirectory() ? 'husky' : options.fallback ? 'fallback' : c.configured ? 'hooksPath' : 'direct';
  if (mode === 'direct') {
    let parent = path.dirname(c.resolved('commit-msg'));
    while (!fs.existsSync(parent) && parent !== path.dirname(parent)) parent = path.dirname(parent);
    const stat = fs.lstatSync(parent);
    if (stat.isSymbolicLink()) throw new Error('Symlinked hook directory');
    try { fs.accessSync(parent, fs.constants.W_OK); if (!(stat.mode & 0o222)) mode = 'fallback'; }
    catch { mode = 'fallback'; }
  }
  for (const name of names) {
    const previous = c.state.hooks[name];
    if (name === 'pre-push' && !options.with_push_gate && !['installed', 'pending'].includes(previous?.status)) {
      c.state.hooks[name] = { status: 'declined' }; continue;
    }
    const destination = mode === 'husky' ? path.join(c.root, '.husky', name) : mode === 'fallback' ? path.join(c.root, '.githooks', name) : c.resolved(name);
    const entry = { status: 'pending', mode, written_path: path.relative(c.root, destination),
      node_path: process.execPath, runtime_path: __filename };
    c.state.hooks[name] = entry;
    if (![c.root, c.metadata].some(base => destination.startsWith(base + path.sep))) { entry.reason = 'external-hook-path-requires-separate-owner'; continue; }
    try {
      const before = regular(destination, true), currentBlock = before && ownedBlock(before, name), nextBlock = block(name);
      if (before && mode !== 'husky' && (!currentBlock || before !== '#!/bin/sh\n' + currentBlock.bytes ||
          hash(before) !== (previous?.file_sha256 || hash('#!/bin/sh\n' + nextBlock)))) { entry.reason = 'foreign-or-edited-hook-preserved'; continue; }
      if (before && mode === 'husky' && currentBlock && (hash(currentBlock.bytes) !== (previous?.block_sha256 || hash(nextBlock)))) { entry.reason = 'unowned-or-edited-block-preserved'; continue; }
      if (before && mode === 'husky' && !currentBlock && before.split('\n').some(line => !/^\s*#/.test(line) && /git-hooks\.js|sd0x-native-git-hook/.test(line))) { entry.reason = 'unbounded-legacy-wiring-preserved'; continue; }
      let after;
      if (mode === 'husky') {
        if (currentBlock) after = before.slice(0, currentBlock.start) + nextBlock + before.slice(currentBlock.end);
        else if (before?.startsWith('#!')) { const end = before.indexOf('\n'); if (end < 0) throw new Error('Malformed hook shebang'); after = before.slice(0, end + 1) + nextBlock + before.slice(end + 1); }
        else after = '#!/bin/sh\n' + nextBlock + (before || '');
      } else after = '#!/bin/sh\n' + nextBlock;
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      if (regular(destination, true) !== before) throw new Error('Hook changed during install');
      const temp = destination + '.' + crypto.randomUUID() + '.tmp';
      try { fs.writeFileSync(temp, after, { flag: 'wx', mode: 0o755 }); if (regular(destination, true) !== before) throw new Error('Hook changed before write'); fs.renameSync(temp, destination); }
      finally { fs.rmSync(temp, { force: true }); }
      entry.file_sha256 = hash(after); entry.block_sha256 = hash(nextBlock);
      entry.status = routeActive(c, name, entry, after) ? 'installed' : 'pending';
      if (entry.status === 'pending') entry.reason = 'written-but-not-active';
    } catch { entry.reason = 'invalid-unreadable-or-damaged-wiring'; }
  }
  if (regular(c.file, true) !== c.bytes) throw new Error('Git hook state changed');
  const stateTemp = c.file + '.' + crypto.randomUUID() + '.tmp';
  try { fs.writeFileSync(stateTemp, JSON.stringify(c.state, null, 2) + '\n', { mode: 0o600, flag: 'wx' }); if (regular(c.file, true) !== c.bytes) throw new Error('Git hook state changed'); fs.renameSync(stateTemp, c.file); }
  finally { fs.rmSync(stateTemp, { force: true }); }
  return doctor(root);
}
function removePushGate(root) {
  const c = context(root), entry = c.state.hooks['pre-push'];
  if (!entry || entry.status === 'declined') return doctor(root);
  const destination = path.resolve(c.root, entry.written_path);
  if (![c.root, c.metadata].some(base => destination.startsWith(base + path.sep))) throw new Error('External hook owner required');
  const before = regular(destination, true), segment = before && ownedBlock(before, 'pre-push');
  if (before && (!segment || hash(segment.bytes) !== entry.block_sha256 ||
    (entry.mode !== 'husky' && (hash(before) !== entry.file_sha256 || before !== '#!/bin/sh\n' + segment.bytes)))) {
    throw new Error('Foreign or edited push hook must be reconciled by its owner');
  }
  if (regular(c.file, true) !== c.bytes || regular(destination, true) !== before) throw new Error('Hook removal drift');
  if (before && entry.mode === 'husky') {
    const after = before.slice(0, segment.start) + before.slice(segment.end);
    const temporary = destination + '.' + crypto.randomUUID() + '.tmp';
    try {
      fs.writeFileSync(temporary, after, { flag: 'wx', mode: fs.statSync(destination).mode & 0o777 });
      if (regular(destination, true) !== before) throw new Error('Hook removal drift');
      fs.renameSync(temporary, destination);
    } finally { fs.rmSync(temporary, { force: true }); }
  } else if (before) fs.unlinkSync(destination);
  c.state.hooks['pre-push'] = { status: 'declined' };
  const temporary = c.file + '.' + crypto.randomUUID() + '.tmp';
  try {
    fs.writeFileSync(temporary, JSON.stringify(c.state, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    if (regular(c.file, true) !== c.bytes) throw new Error('Hook state drift after removal; reconcile before sync');
    fs.renameSync(temporary, c.file);
  } finally { fs.rmSync(temporary, { force: true }); }
  return doctor(root);
}
function pushAssessment(root, input, remote = null) {
  const bytes = Buffer.isBuffer(input) ? input : Buffer.from(input);
  if (bytes.length > 1024 * 1024) throw new Error('Push ref input exceeds observation budget');
  if (remote && (!Array.isArray(remote) || remote.length !== 2 || remote.some(value => typeof value !== 'string' || !value || /[\x00-\x1f\x7f]/.test(value)))) throw new Error('Invalid remote identity');
  const target = remote && { name: redactOutput(remote[0]), location: redactOutput(remote[1]),
    identity_sha256: hash(JSON.stringify(remote)) };
  const p = policy.readPolicy(root).policy;
  const bytePolicy = { ...p, protected_branches: p.protected_branches.map(value => Buffer.from(value).toString('latin1')) };
  const gitdir = path.resolve(root, git(root, ['rev-parse', '--absolute-git-dir']).stdout.trim());
  if (git(root, ['rev-parse', '--is-shallow-repository']).stdout.trim() !== 'false' || fs.existsSync(path.join(gitdir, 'info/grafts')) || git(root, ['for-each-ref', '--format=%(refname)', 'refs/replace']).stdout.trim()) throw new Error('Unsupported ancestry overlay');
  // Latin-1 is a reversible byte view, not a claimed text encoding. Git permits
  // non-UTF8 ref names; preserve the original stream and validate byte grammar.
  const stream = bytes.toString('latin1').replace(/\n$/, '');
  const display = value => {
    const original = Buffer.from(value, 'latin1'), text = original.toString('utf8');
    return Buffer.from(text).equals(original) ? redactOutput(text) : `<non-UTF8 ref sha256=${hash(original)}>`;
  };
  const rows = stream ? stream.split('\n').map(line => {
    const parts = line.split(' ');
    if (parts.length !== 4 || !parts.every(Boolean) || /[\x00-\x20\x7f]/.test(parts[0]) ||
        !/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/.test(parts[1]) ||
        !/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/.test(parts[3]) || parts[1].length !== parts[3].length ||
        !parts[2].startsWith('refs/') || !policy.branchName(parts[2])) throw new Error('Malformed push ref input');
    const [local_ref, local_oid, remote_ref, remote_oid] = parts;
    const deletion = /^0+$/.test(local_oid), existing = !/^0+$/.test(remote_oid);
    const protectedBranch = remote_ref.startsWith('refs/heads/') && policy.isProtected(remote_ref.slice(11), bytePolicy);
    const rewriting = existing && (deletion || !remote_ref.startsWith('refs/heads/') || git(root, ['merge-base', '--is-ancestor', remote_oid, local_oid], [1]).status !== 0);
    return { local_ref_display: display(local_ref), local_oid, remote_ref_display: display(remote_ref), remote_oid,
      protected: protectedBranch, rewriting, deletion };
  }) : [];
  return { rows, target, requires_confirmation: rows.some(row => row.protected || row.rewriting),
    digest: hash(JSON.stringify({ target: target?.identity_sha256 || null, refs: hash(bytes) })) };
}
function confirm(assessment) {
  if (!assessment.requires_confirmation) return;
  if (!assessment.target) throw new Error('Push confirmation requires the exact remote destination');
  let tty;
  try {
    tty = fs.openSync('/dev/tty', 'r+');
    fs.writeSync(tty, `Remote ${JSON.stringify(assessment.target.name)} at ${JSON.stringify(assessment.target.location)} (sha256 ${assessment.target.identity_sha256})\n`);
    fs.writeSync(tty, assessment.rows.map(row => `${JSON.stringify(row.remote_ref_display)}: ${row.remote_oid} -> ${row.local_oid}`).join('\n') + '\n');
    fs.writeSync(tty, `sd0x: protected or history-changing push (${assessment.rows.length} refs). Type PUSH ${assessment.digest} to authorize this exact update: `);
    const b = Buffer.alloc(256), n = fs.readSync(tty, b, 0, b.length, null);
    if (b.subarray(0, n).toString().trim() !== `PUSH ${assessment.digest}`) throw new Error('Push declined');
  } catch { throw new Error('Push requires exact interactive confirmation; no noninteractive bypass'); }
  finally { if (tty !== undefined) fs.closeSync(tty); }
}
function guard(root, name, args, input) {
  if (name === 'commit-msg') {
    if (args.length !== 1) throw new Error('Expected exact commit message path');
    const supplied = path.resolve(root, args[0]);
    const message = path.join(fs.realpathSync(path.dirname(supplied)), path.basename(supplied));
    attribution.assertClean(regular(message)); return;
  }
  if (name !== 'pre-push' || args.length !== 2) throw new Error('Invalid hook invocation');
  confirm(pushAssessment(root, input, args));
}
if (require.main === module) {
  try {
    const [action, name, ...args] = process.argv.slice(2);
    if (action === '--unlink') {
      const base = fs.realpathSync(os.tmpdir());
      if (path.dirname(name) !== base || !/^sd0x-hook-stream-[a-f0-9-]+$/.test(path.basename(name))) throw new Error('Invalid temporary stream');
      regular(name); fs.unlinkSync(name);
    } else if (['--guard', '--capture'].includes(action)) {
      const chunks = []; let total = 0;
      if (name === 'pre-push') { for (;;) { const buffer = Buffer.alloc(65536), n = fs.readSync(0, buffer, 0, buffer.length, null); if (!n) break; total += n; if (total > 1024 * 1024) throw new Error('Ref stream exceeds budget'); chunks.push(buffer.subarray(0, n)); } }
      const input = Buffer.concat(chunks);
      guard(process.cwd(), name, args, input);
      if (action === '--capture') {
        const file = path.join(fs.realpathSync(os.tmpdir()), 'sd0x-hook-stream-' + crypto.randomUUID());
        fs.writeFileSync(file, input, { mode: 0o600, flag: 'wx' }); process.stdout.write(file);
      }
    } else throw new Error('Unknown hook action');
  } catch { console.error('sd0x Git hook refused: invalid, unavailable or unauthorized operation'); process.exitCode = 1; }
}
module.exports = { install, doctor, removePushGate, block, pushAssessment, guard };
