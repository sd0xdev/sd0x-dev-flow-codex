'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  extractPatchPaths,
  extractToolPaths,
  isProtectedPath,
  snapshot
} = require('../plugin/sd0x-dev-flow-codex/scripts/runtime/worktree');
const {
  commit,
  git,
  initRepository,
  isolateGitEnvironment
} = require('./helpers/git');

isolateGitEnvironment();

function createRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-worktree-'));
  initRepository(root);
  fs.writeFileSync(path.join(root, 'README.md'), '# Test\n');
  git(root, ['add', '.']);
  commit(root, 'baseline');
  return root;
}

test('snapshot includes untracked contents and classifies docs-only changes', (t) => {
  const root = createRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'notes.md'), 'first\n');

  const first = snapshot(root);
  assert.deepEqual(first.files, ['notes.md']);
  assert.equal(first.requires_review, true);
  assert.equal(first.requires_verify, false);

  fs.writeFileSync(path.join(root, 'notes.md'), 'second\n');
  const second = snapshot(root);
  assert.notEqual(second.fingerprint, first.fingerprint);
});

test('snapshot hashes tracked code changes', (t) => {
  const root = createRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'app.js'), 'module.exports = 1;\n');

  const current = snapshot(root);
  assert.deepEqual(current.code_files, ['app.js']);
  assert.equal(current.requires_verify, true);
  assert.equal(snapshot(root).fingerprint, current.fingerprint);
});

test('snapshot content hashing survives alternate root separators', (t) => {
  const root = createRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'app.js'), 'module.exports = 1;\n');
  git(root, ['add', 'app.js']);
  commit(root, 'track app');
  fs.writeFileSync(path.join(root, 'app.js'), 'module.exports = 2;\n');

  const alternateRoot = root.split(path.sep).join('/');
  const first = snapshot(alternateRoot);
  fs.writeFileSync(path.join(root, 'app.js'), 'module.exports = 3;\n');
  const second = snapshot(alternateRoot);

  assert.equal(fs.realpathSync(first.root), fs.realpathSync(root));
  assert.notEqual(first.fingerprint, second.fingerprint);
});

test('snapshot includes staged changes hidden by HEAD-matching worktree content', (t) => {
  const root = createRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'README.md'), '# Staged version\n');
  git(root, ['add', 'README.md']);
  fs.writeFileSync(path.join(root, 'README.md'), '# Test\n');

  const current = snapshot(root);
  assert.notEqual(current.fingerprint, 'clean');
  assert.deepEqual(current.files, ['README.md']);
  assert.equal(current.requires_review, true);
});

test('snapshot includes a staged new file deleted from the worktree', (t) => {
  const root = createRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const stagedPath = path.join(root, 'staged.js');
  fs.writeFileSync(stagedPath, 'module.exports = 1;\n');
  git(root, ['add', 'staged.js']);
  fs.unlinkSync(stagedPath);

  const current = snapshot(root);
  assert.notEqual(current.fingerprint, 'clean');
  assert.deepEqual(current.files, ['staged.js']);
  assert.equal(current.requires_verify, true);
});

test('snapshot exposes both sides of a staged rename', (t) => {
  const root = createRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'old.js'), 'module.exports = 1;\n');
  git(root, ['add', 'old.js']);
  commit(root, 'track rename source');
  git(root, ['mv', 'old.js', 'new.js']);

  assert.deepEqual(snapshot(root).files, ['new.js', 'old.js']);
});

test('tracked generated and vendor paths are never hidden from gates', (t) => {
  const root = createRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
  fs.writeFileSync(path.join(root, 'dist', 'bundle.js'), 'first\n');
  git(root, ['add', '.']);
  commit(root, 'track dist');
  fs.writeFileSync(path.join(root, 'dist', 'bundle.js'), 'second\n');
  assert.deepEqual(snapshot(root).files, ['dist/bundle.js']);
});

test('nested repository content changes invalidate the parent fingerprint', (t) => {
  const root = createRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const nested = path.join(root, 'nested');
  fs.mkdirSync(nested);
  initRepository(nested);
  fs.writeFileSync(path.join(nested, 'child.js'), 'module.exports = 1;\n');
  git(nested, ['add', '.']);
  commit(nested, 'nested baseline');
  git(root, ['-c', 'advice.addEmbeddedRepo=false', 'add', 'nested']);
  commit(root, 'track nested repository');
  assert.equal(snapshot(root).fingerprint, 'clean');

  fs.writeFileSync(path.join(nested, 'child.js'), 'module.exports = 2;\n');
  const first = snapshot(root);
  fs.writeFileSync(path.join(nested, 'child.js'), 'module.exports = 3;\n');
  const second = snapshot(root);
  assert.deepEqual(first.files, ['nested']);
  assert.notEqual(first.fingerprint, second.fingerprint);
});

test('submodule changes override configured ignore=all', (t) => {
  const root = createRepo();
  const source = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-submodule-source-'));
  t.after(() => {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(source, { recursive: true, force: true });
  });
  initRepository(source);
  fs.writeFileSync(path.join(source, 'child.js'), 'module.exports = 1;\n');
  git(source, ['add', '.']);
  commit(source, 'submodule baseline');

  git(root, [
    '-c',
    'protocol.file.allow=always',
    'submodule',
    'add',
    source,
    'submodule'
  ], { stdio: 'ignore' });
  git(root, [
    'config',
    '-f',
    '.gitmodules',
    'submodule.submodule.ignore',
    'all'
  ]);
  git(root, ['add', '.gitmodules', 'submodule']);
  commit(root, 'add ignored submodule');
  assert.equal(snapshot(root).fingerprint, 'clean');

  fs.writeFileSync(
    path.join(root, 'submodule', 'child.js'),
    'module.exports = 2;\n'
  );
  const first = snapshot(root);
  fs.writeFileSync(
    path.join(root, 'submodule', 'child.js'),
    'module.exports = 3;\n'
  );
  const second = snapshot(root);
  assert.deepEqual(first.files, ['submodule']);
  assert.notEqual(first.fingerprint, second.fingerprint);
});

test('Git-ignored untracked files are outside the fingerprint contract', (t) => {
  const root = createRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, '.gitignore'), 'ignored.log\n');
  git(root, ['add', '.gitignore']);
  commit(root, 'ignore local log');
  fs.writeFileSync(path.join(root, 'ignored.log'), 'first\n');
  assert.equal(snapshot(root).fingerprint, 'clean');
  fs.writeFileSync(path.join(root, 'ignored.log'), 'second\n');
  assert.equal(snapshot(root).fingerprint, 'clean');
});

test('apply_patch paths are extracted from Codex command input', () => {
  const command = [
    '*** Begin Patch',
    '*** Update File: src/a.js',
    '*** Move to: src/b.js',
    '*** Add File: .env',
    '*** End Patch'
  ].join('\n');
  assert.deepEqual(extractPatchPaths(command), ['src/a.js', '.env', 'src/b.js']);
  assert.deepEqual(extractToolPaths({ tool_input: { command } }), [
    'src/a.js', '.env', 'src/b.js'
  ]);
});

test('protected paths block secrets but permit environment templates', () => {
  assert.equal(isProtectedPath('.env'), true);
  assert.equal(isProtectedPath('config/.env.production'), true);
  assert.equal(isProtectedPath('certs/private.pem'), true);
  assert.equal(isProtectedPath('.git/config'), true);
  assert.equal(isProtectedPath('.env.example'), false);
  assert.equal(isProtectedPath('src/config.js'), false);
});
