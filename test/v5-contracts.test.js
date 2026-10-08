'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { TOPICS, locator, withContract } = require('../plugin/sd0x-dev-flow-codex/scripts/runtime/contracts');

test('every contract is delivered from the pinned plugin with actual bytes', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-contracts-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, '.codex-plugin'));
  fs.mkdirSync(path.join(root, 'scripts/contracts'), { recursive: true });
  fs.writeFileSync(path.join(root, '.codex-plugin/plugin.json'), JSON.stringify({ name: 'sd0x-dev-flow-codex', version: 'test' }));
  const files = TOPICS.map(topic => {
    const relative = `scripts/contracts/${topic}.md`, content = '# ' + topic;
    fs.writeFileSync(path.join(root, relative), content);
    return { path: relative, sha256: crypto.createHash('sha256').update(content).digest('hex') };
  });
  fs.writeFileSync(path.join(root, '.codex-plugin/payload-manifest.json'), JSON.stringify({ files }));
  assert.equal(locator(root).version, 'test');
  let calls = 0;
  for (const topic of TOPICS) withContract(topic, { pluginRoot: root, expectedVersion: 'test' }, result => {
    assert.equal(result.content, '# ' + topic); calls++;
  });
  assert.equal(calls, 8);
  const topic = TOPICS[0], file = path.join(root, files[0].path);
  const operation = () => { calls++; };
  assert.throws(() => withContract(topic, { pluginRoot: root, expectedVersion: 'old' }, operation), /version/);
  fs.writeFileSync(file, 'wrong bytes');
  assert.throws(() => withContract(topic, { pluginRoot: root, expectedVersion: 'test' }, operation), /manifest/);
  fs.chmodSync(file, 0);
  assert.throws(() => withContract(topic, { pluginRoot: root, expectedVersion: 'test' }, operation), /unreadable/);
  fs.chmodSync(file, 0o644); fs.unlinkSync(file);
  assert.throws(() => withContract(topic, { pluginRoot: root, expectedVersion: 'test' }, operation));
  fs.symlinkSync('missing', file);
  assert.throws(() => withContract(topic, { pluginRoot: root, expectedVersion: 'test' }, operation), /unreadable/);
  assert.equal(calls, 8, 'dependent actions did not run after failed reads');
});

test('stall diagnosis keeps behavior identity across line shifts and distinguishes stale subjects', () => {
  const { findingIdentity, diagnose } = require('../plugin/sd0x-dev-flow-codex/scripts/runtime/review-diagnostics');
  const finding = { component: 'Parser', trigger: 'Empty input', mechanism: 'Unchecked index', obligation: 'Reject input', line: 4 };
  assert.equal(findingIdentity(finding), findingIdentity({ ...finding, line: 50, component: ' parser ' }));
  const rows = [{ id: 'one', fingerprint: 'a'.repeat(64), findings: [finding, finding] },
    { id: 'two', fingerprint: 'b'.repeat(64), findings: [{ ...finding, line: 50 }] }];
  const result = diagnose(rows);
  assert.equal(result.gate_authority, false); assert.equal(result.repeated.length, 1);
  assert.equal(result.repeated[0].history.length, 2); assert.equal(result.repeated[0].subject_changed, true);
  assert.equal(diagnose([rows[0]]).repeated.length, 0);
  assert.throws(() => diagnose([rows[0], rows[0]]), /duplicated/);
});

test('comment accounting bridges blanks without letting a license exempt later rationale', () => {
  const { commentBlocks, scanComments } = require('../plugin/sd0x-dev-flow-codex/scripts/runtime/comment-blocks');
  const text = '// SPDX-License-Identifier: MIT\n\n' + '// rationale\n'.repeat(30) + 'const x = 1;\n';
  assert.deepEqual(commentBlocks(text), [{ line: 3, count: 30, severity: 'block' }]);
  assert.equal(commentBlocks('// SPDX-License-Identifier: MIT\n// header\nconst x=1;').length, 0);
  assert.equal(commentBlocks('/*\n' + 'reason\n'.repeat(28) + '*/')[0].count, 30);
  assert.equal(commentBlocks('case "$x" in\n/*)\n' + 'echo value\n'.repeat(35) + ';;\nesac', 'sh').length, 0);
  assert.equal(scanComments(process.cwd(), []).outcome, 'uncovered');
  assert.throws(() => scanComments(process.cwd(), ['../outside.js']));
});
