'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { initRepository, git, commit, isolateGitEnvironment } = require('./helpers/git');
const hooks = require('../plugin/sd0x-dev-flow-codex/scripts/runtime/git-hooks');
isolateGitEnvironment();
function repo(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'v5-git-hooks-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  initRepository(root);
  fs.writeFileSync(path.join(root, 'file.txt'), 'fixture'); git(root, ['add', '.']); commit(root, 'baseline');
  return root;
}
function run(root, file, args, input = '') {
  return spawnSync(file, args, { cwd: root, input, encoding: 'utf8', timeout: 5000, detached: true });
}
test('default commit guard is executable and actually rejects attribution without changing user hook configuration', t => {
  const root = repo(t), prior = git(root, ['config', 'core.hooksPath']).toString();
  const result = hooks.install(root);
  assert.equal(result.hooks['commit-msg'].status, 'installed');
  assert.equal(result.hooks['pre-push'].status, 'declined');
  assert.equal(git(root, ['config', 'core.hooksPath']).toString(), prior);
  const message = path.join(root, '.git/message-fixture');
  const guard = path.resolve(root, result.hooks['commit-msg'].written_path);
  fs.writeFileSync(message, 'Human-authored fixture'); assert.equal(run(root, guard, [message]).status, 0);
  fs.writeFileSync(message, 'Generated-by Codex'); assert.notEqual(run(root, guard, [message]).status, 0);
  fs.writeFileSync(path.join(root, 'file.txt'), 'changed'); git(root, ['add', 'file.txt']);
  const head = git(root, ['rev-parse', 'HEAD']).toString();
  const rejected = run(root, 'git', ['commit', '-m', 'Generated-by Codex']);
  assert.notEqual(rejected.status, 0); assert.equal(git(root, ['rev-parse', 'HEAD']).toString(), head);
  commit(root, 'Human fixture update'); assert.notEqual(git(root, ['rev-parse', 'HEAD']).toString(), head);
  fs.chmodSync(guard, 0o644); assert.equal(hooks.doctor(root).hooks['commit-msg'].status, 'pending');
});
test('foreign hooks and malformed Husky boundaries are preserved, and fallback writing is not activation', t => {
  const root = repo(t), hook = path.resolve(root, git(root, ['rev-parse', '--git-path', 'hooks/commit-msg']).toString().trim());
  fs.writeFileSync(hook, '#!/bin/sh\necho user\n', { mode: 0o755 });
  assert.equal(hooks.install(root).hooks['commit-msg'].status, 'pending');
  assert.equal(fs.readFileSync(hook, 'utf8'), '#!/bin/sh\necho user\n');
  const fallback = hooks.install(root, { fallback: true });
  assert.equal(fallback.hooks['commit-msg'].status, 'pending');
  fs.mkdirSync(path.join(root, '.husky'));
  const damaged = '# sd0x-native-git-hook:v1 commit-msg:start\necho user\n';
  fs.writeFileSync(path.join(root, '.husky/commit-msg'), damaged);
  assert.equal(hooks.install(root).hooks['commit-msg'].status, 'pending');
  assert.equal(fs.readFileSync(path.join(root, '.husky/commit-msg'), 'utf8'), damaged);
});
test('Husky guard executes then preserves downstream commands and the exact one-shot ref stream', t => {
  const root = repo(t); fs.mkdirSync(path.join(root, '.husky'));
  git(root, ['config', '--local', 'core.hooksPath', '.husky']);
  const push = path.join(root, '.husky/pre-push'), msg = path.join(root, '.husky/commit-msg');
  fs.writeFileSync(push, '#!/bin/sh\ncat > .git/observed-refs\n', { mode: 0o755 });
  fs.writeFileSync(msg, '#!/bin/sh\nprintf user > .git/observed-message\n', { mode: 0o755 });
  const result = hooks.install(root, { with_push_gate: true });
  assert.equal(result.hooks['pre-push'].status, 'installed');
  const oid = git(root, ['rev-parse', 'HEAD']).toString().trim();
  const input = `refs/heads/feature ${oid} refs/heads/feature ${'0'.repeat(40)}\n`;
  const pushed = run(root, push, ['origin', 'fixture'], input);
  assert.equal(pushed.status, 0, pushed.stderr); assert.equal(fs.readFileSync(path.join(root, '.git/observed-refs'), 'utf8'), input);
  const message = path.join(root, '.git/message-fixture'); fs.writeFileSync(message, 'Human message');
  assert.equal(run(root, msg, [message]).status, 0); assert.equal(fs.readFileSync(path.join(root, '.git/observed-message'), 'utf8'), 'user');
  const bytes = fs.readFileSync(push, 'utf8'); hooks.install(root); assert.equal(fs.readFileSync(push, 'utf8'), bytes);
  assert.equal(hooks.doctor(root).hooks['pre-push'].status, 'installed');
  fs.writeFileSync(message, 'Generated-by Codex'); fs.unlinkSync(path.join(root, '.git/observed-message'));
  assert.notEqual(run(root, msg, [message]).status, 0); assert.equal(fs.existsSync(path.join(root, '.git/observed-message')), false);
});
test('protected and history-changing pushes require exact terminal confirmation; environment flags cannot bypass', t => {
  const root = repo(t), result = hooks.install(root, { with_push_gate: true });
  const oid = git(root, ['rev-parse', 'HEAD']).toString().trim();
  const input = `refs/heads/main ${oid} refs/heads/main ${'0'.repeat(40)}\n`;
  assert.equal(hooks.pushAssessment(root, input).requires_confirmation, true);
  const pushed = run(root, path.resolve(root, result.hooks['pre-push'].written_path), ['origin', 'fixture'], input);
  assert.notEqual(pushed.status, 0); assert.equal(pushed.signal, null);
  assert.throws(() => hooks.pushAssessment(root, 'broken\n'), /Malformed/);
  assert.throws(() => hooks.pushAssessment(root, 'x'.repeat(1024 * 1024 + 1)), /budget/);
});
test('external hooks paths and symlinks are not followed by installation', t => {
  const root = repo(t), external = fs.mkdtempSync(path.join(os.tmpdir(), 'v5-external-hooks-'));
  t.after(() => fs.rmSync(external, { recursive: true, force: true }));
  git(root, ['config', '--local', 'core.hooksPath', external]);
  assert.equal(hooks.install(root).hooks['commit-msg'].status, 'pending'); assert.deepEqual(fs.readdirSync(external), []);
  git(root, ['config', '--local', 'core.hooksPath', '.hooks']); fs.symlinkSync(external, path.join(root, '.hooks'));
  assert.equal(hooks.install(root).hooks['commit-msg'].status, 'pending'); assert.deepEqual(fs.readdirSync(external), []);
});

test('explicit removal preserves Husky user bytes and persists decline across sync', t => {
  const root = repo(t); fs.mkdirSync(path.join(root, '.husky'));
  git(root, ['config', '--local', 'core.hooksPath', '.husky']);
  const file = path.join(root, '.husky/pre-push'), original = '#!/bin/sh\nprintf user\n';
  fs.writeFileSync(file, original, { mode: 0o755 }); hooks.install(root, { with_push_gate: true });
  assert.equal(hooks.removePushGate(root).hooks['pre-push'].status, 'declined');
  assert.equal(fs.readFileSync(file, 'utf8'), original);
  hooks.install(root); assert.equal(fs.readFileSync(file, 'utf8'), original);
});

test('push confirmation binds remote destination and supports Git-valid symbol and Unicode refs', t => {
  const root = repo(t), oid = git(root, ['rev-parse', 'HEAD']).toString().trim();
  const input = `HEAD ${oid} refs/heads/main ${'0'.repeat(40)}\n`;
  const staging = hooks.pushAssessment(root, input, ['staging', 'https://example.invalid/staging.git']);
  const production = hooks.pushAssessment(root, input, ['production', 'https://example.invalid/production.git']);
  assert.notEqual(staging.digest, production.digest);
  assert.notEqual(staging.target.identity_sha256, production.target.identity_sha256);
  const credentialed = hooks.pushAssessment(root, input, ['origin', 'https://fixture:private-password@example.invalid/repo.git']);
  assert.equal(JSON.stringify(credentialed).includes('private-password'), false);
  for (const branch of ['feat/a+b', 'feat/@work', 'feat/中文']) {
    git(root, ['check-ref-format', `refs/heads/${branch}`]);
    assert.equal(hooks.pushAssessment(root, `HEAD ${oid} refs/heads/${branch} ${'0'.repeat(40)}\n`).requires_confirmation, false);
  }
});
test('Husky downstream receives exact raw bytes for a non-UTF8 local ref', t => {
  const root = repo(t); fs.mkdirSync(path.join(root, '.husky')); git(root, ['config', 'core.hooksPath', '.husky']);
  const hook = path.join(root, '.husky/pre-push'); fs.writeFileSync(hook, '#!/bin/sh\ncat > .git/raw-ref-stream\n', { mode: 0o755 });
  hooks.install(root, { with_push_gate: true });
  const oid = git(root, ['rev-parse', 'HEAD']).toString().trim();
  const input = Buffer.concat([Buffer.from('refs/heads/'), Buffer.from([0xff]), Buffer.from(` ${oid} refs/heads/feature ${'0'.repeat(40)}\n`)]);
  const result = run(root, hook, ['origin', 'fixture'], input);
  assert.equal(result.status, 0, result.stderr); assert.deepEqual(fs.readFileSync(path.join(root, '.git/raw-ref-stream')), input);
});

test('unwritable direct hooks select fallback without changing Git configuration', t => {
  const root = repo(t); git(root, ['config', '--unset', 'core.hooksPath']);
  const directory = path.join(root, '.git/hooks'); fs.chmodSync(directory, 0o555);
  try {
    const result = hooks.install(root);
    assert.equal(result.hooks['commit-msg'].mode, 'fallback');
    assert.equal(result.hooks['commit-msg'].status, 'pending');
  } finally { fs.chmodSync(directory, 0o755); }
});

test('doctor cannot report active wiring after its recorded Node executable disappears', t => {
  const root = repo(t), binary = path.join(root, '.git/fixture-node');
  fs.copyFileSync(process.execPath, binary); fs.chmodSync(binary, 0o755);
  const modulePath = require.resolve('../plugin/sd0x-dev-flow-codex/scripts/runtime/git-hooks');
  const installed = run(root, binary, ['-e', `require(${JSON.stringify(modulePath)}).install(process.cwd())`]);
  assert.equal(installed.status, 0, installed.stderr);
  assert.equal(hooks.doctor(root).hooks['commit-msg'].active, true);
  fs.unlinkSync(binary);
  assert.equal(hooks.doctor(root).hooks['commit-msg'].active, false);
  assert.equal(hooks.doctor(root).hooks['commit-msg'].status, 'pending');
});

test('modern Husky shim routes to the owned container, while a missing helper remains pending', t => {
  const root = repo(t); fs.mkdirSync(path.join(root, '.husky/_'), { recursive: true });
  git(root, ['config', 'core.hooksPath', '.husky/_']);
  const shim = '#!/bin/sh\n. "$(dirname "$0")/h"\n';
  fs.writeFileSync(path.join(root, '.husky/_/commit-msg'), shim, { mode: 0o755 });
  fs.writeFileSync(path.join(root, '.husky/_/h'), '#!/bin/sh\nn=$(basename "$0")\ns=$(dirname "$(dirname "$0")")/$n\nsh -e "$s" "$@"\n', { mode: 0o755 });
  const result = hooks.install(root); assert.equal(result.hooks['commit-msg'].status, 'installed');
  fs.writeFileSync(path.join(root, 'file.txt'), 'new'); git(root, ['add', 'file.txt']);
  assert.notEqual(run(root, 'git', ['commit', '-m', 'Generated-by Codex']).status, 0);
  commit(root, 'Human Husky fixture');
  fs.unlinkSync(path.join(root, '.husky/_/h'));
  assert.equal(hooks.doctor(root).hooks['commit-msg'].status, 'pending');
});
