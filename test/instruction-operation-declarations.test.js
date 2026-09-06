'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { auditCandidateStatic } = require('../scripts/skill-migration-audit');

test('Obsidian prose mutation retains connector sensitivity without generic command scaffolding', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-operation-declaration-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const repository = path.resolve(__dirname, '..');
  const candidate = 'plugin/sd0x-dev-flow-codex/skills/obsidian-cli';
  fs.mkdirSync(path.join(root, 'migration'), { recursive: true });
  fs.cpSync(path.join(repository, candidate), path.join(root, candidate), { recursive: true });
  const source = JSON.parse(fs.readFileSync(path.join(repository, 'migration/source-disposition.json')));
  const rows = source.skills.filter((row) => row.target_skill === 'obsidian-cli')
    .map((row) => ({ ...row, delivery_state: 'candidate' }));
  const disposition = path.join(root, 'migration/source-disposition.json');
  fs.writeFileSync(disposition, JSON.stringify({ skills: rows }));
  const result = auditCandidateStatic({ root, target: 'obsidian-cli', candidate });
  assert.ok(result.observed_operations.includes('connector-write'));
  for (const row of rows) row.operations = ['read'];
  fs.writeFileSync(disposition, JSON.stringify({ skills: rows }));
  assert.throws(() => auditCandidateStatic({ root, target: 'obsidian-cli', candidate }),
    /undeclared operation: connector-write/);
});
