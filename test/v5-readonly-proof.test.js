'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { initRepository, git, commit, isolateGitEnvironment } = require('./helpers/git');
const { fingerprint } = require('../plugin/sd0x-dev-flow-codex/skills/orchestrate/scripts/run-verify');
const reference = require('../plugin/sd0x-dev-flow-codex/scripts/runtime/reference-stability');
isolateGitEnvironment();
function repo(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'v5-proof-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  initRepository(root); fs.writeFileSync(path.join(root, '.gitignore'), '.private\nignored/\n');
  git(root, ['add', '.']); commit(root, 'baseline'); return root;
}
test('read-only proof detects ignored contents, empty directories, refs and local configuration', t => {
  const root = repo(t);
  let before = fingerprint(root);
  assert.equal(fingerprint(root), before);
  for (const mutate of [
    () => fs.writeFileSync(path.join(root, '.private'), 'fixture secret value'),
    () => fs.writeFileSync(path.join(root, '.private'), 'changed fixture secret'),
    () => fs.mkdirSync(path.join(root, 'ignored')),
    () => fs.mkdirSync(path.join(root, 'ignored/empty')),
    () => git(root, ['config', '--local', 'example.value', 'changed']),
    () => git(root, ['update-ref', 'refs/heads/proof-extra', 'HEAD'])
  ]) {
    mutate(); const after = fingerprint(root); assert.notEqual(after, before); before = after;
    assert.equal(fingerprint(root), after);
  }
});
test('regular ignored files named node_modules are included; symlink targets are never read', t => {
  const root = repo(t);
  fs.writeFileSync(path.join(root, 'node_modules'), 'one');
  let before = fingerprint(root);
  fs.writeFileSync(path.join(root, 'node_modules'), 'two'); assert.notEqual(fingerprint(root), before);
  fs.symlinkSync('/outside/nonexistent', path.join(root, '.private'));
  before = fingerprint(root); assert.equal(fingerprint(root), before);
  fs.unlinkSync(path.join(root, '.private')); fs.symlinkSync('/other/nonexistent', path.join(root, '.private'));
  assert.notEqual(fingerprint(root), before);
});
test('reference-stability separates prose from fences and historical evidence, with a strict scope cap', t => {
  const root = repo(t);
  fs.writeFileSync(path.join(root, 'guide.md'), '# Guide\nSee src/a.js:12\n```js\n"src/a.js:20"\n```\n');
  fs.mkdirSync(path.join(root, 'requests')); fs.writeFileSync(path.join(root, 'requests/old.md'), 'src/a.js:5');
  const result = reference.plan(root, { files: ['guide.md', 'requests/old.md'] });
  assert.equal(result[0].count, 1); assert.equal(result[1].status, 'exempt-record');
  assert.throws(() => reference.plan(root, { files: ['guide.md'], auto: true }), /incompatible/);
  assert.throws(() => reference.plan(root, { files: Array.from({ length: 6 }, (_, i) => `f${i}.md`) }), /1–5/);
  assert.throws(() => reference.plan(root, { files: ['requests'] }), /regular files/);
});

test('reference candidates in template strings and heredocs are never certified as comments', t => {
  const root = repo(t);
  fs.writeFileSync(path.join(root, 'template.js'), 'const text = `\n// src/a.js:42\n`;\n// src/a.js:50\n');
  fs.writeFileSync(path.join(root, 'here.sh'), 'cat <<EOF\n# src/a.js:42\nEOF\n');
  fs.writeFileSync(path.join(root, 'fences.md'), '````js\n```\nsrc/a.js:42\n````\n<!--\nsrc/a.js:55\n-->\nSee src/a.js:90\n');
  const result = reference.plan(root, { files: ['template.js', 'here.sh', 'fences.md'] });
  assert.equal(result[0].count, null); assert.deepEqual(result[0].eligible_pointers, []);
  assert.equal(result[1].status, 'manual-confirmation-required'); assert.deepEqual(result[1].eligible_pointers, []);
  assert.equal(result[2].count, 1); assert.equal(result[2].eligible_pointers[0].pointer, 'src/a.js:90');
});
