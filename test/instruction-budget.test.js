'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { size, guidance, staticReport, checkBudget } = require('../scripts/instruction-budget');
const { MANAGED_BLOCK } = require('../plugin/sd0x-dev-flow-codex/scripts/runtime/workflow-contract');
const ROOT = path.resolve(__dirname, '..');
const PLUGIN = path.join(ROOT, 'plugin/sd0x-dev-flow-codex');

test('accounting distinguishes code units, bytes, lines and unknown tokens', () => {
  assert.deepEqual(size('文😀\n'), { utf16_code_units: 4, utf8_bytes: 8, lines: 1 });
  assert.deepEqual(size(''), { utf16_code_units: 0, utf8_bytes: 0, lines: 0 });
  const report = staticReport(ROOT, PLUGIN, ['review']);
  assert.equal(report.token_accounting, null);
  assert.equal(report.observed_reads, null);
  assert.equal(report.discovery.model_visible_catalog, null);
  assert.equal(report.selected_skills.length, 1);
  assert.ok(report.available_references.some(row => row.path.endsWith('/default.md')));
  assert.throws(() => staticReport(ROOT, PLUGIN, ['../secrets']), /Unknown/);
});

test('user guidance is preserved and excluded from managed regression budget', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-budget-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const user = 'User guidance\n'.repeat(5000);
  fs.writeFileSync(path.join(root, 'AGENTS.md'), user + MANAGED_BLOCK);
  const report = staticReport(root, PLUGIN);
  assert.deepEqual(report.project_guidance.user, size(user));
  const boundary = size(MANAGED_BLOCK);
  assert.equal(checkBudget(report, boundary), true);
  fs.writeFileSync(path.join(root, 'AGENTS.md'), user + MANAGED_BLOCK.replace('### Guidance', 'x### Guidance'));
  assert.throws(() => checkBudget(staticReport(root, PLUGIN), boundary), /on demand/);
  assert.equal(fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8').startsWith(user), true);
});

test('ambiguous markers cannot misclassify user content as managed', () => {
  assert.throws(() => guidance(MANAGED_BLOCK + MANAGED_BLOCK), /Ambiguous/);
  assert.deepEqual(guidance('Custom guidance'), { managed: '', user: 'Custom guidance', status: 'unmanaged' });
});

test('native resident budget is dual and applies to fresh setup without charging user text', t => {
  const { setup } = require('../plugin/sd0x-dev-flow-codex/scripts/runtime/setup');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-fresh-budget-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  require('node:child_process').execFileSync('git', ['init', root], { stdio: 'ignore' });
  const user = '# User instructions\n' + 'Preserve project context.\n'.repeat(1000);
  fs.writeFileSync(path.join(root, 'AGENTS.md'), user);
  setup(root, { mode: 'guidance' });
  const report = staticReport(root, PLUGIN);
  assert.equal(checkBudget(report, { utf16_code_units: 3840, lines: 44 }), true);
  assert.equal(fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8').startsWith(user), true);
  for (const key of ['utf16_code_units', 'lines']) {
    const over = structuredClone(report); over.project_guidance.managed[key] = key === 'lines' ? 45 : 3841;
    assert.throws(() => checkBudget(over, { utf16_code_units: 3840, lines: 44 }), /budget/);
  }
});
