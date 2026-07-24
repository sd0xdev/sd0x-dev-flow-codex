'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  resolveFeature
} = require('../plugin/sd0x-dev-flow-codex/skills/create-request/scripts/request-tool');
const { commit, git, initRepository } = require('./helpers/git');

const ROOT = path.resolve(__dirname, '..');
const SKILL = path.join(
  ROOT,
  'plugin/sd0x-dev-flow-codex/skills/tech-spec/SKILL.md'
);
const CONTRACT = path.join(
  ROOT,
  'plugin/sd0x-dev-flow-codex/skills/tech-spec/migration-contract.json'
);

test('tech-spec delegates feature containment to the shared query-only resolver', () => {
  const skill = fs.readFileSync(SKILL, 'utf8');
  assert.match(skill, /\.\.\/create-request\/scripts\/request-tool\.js/);
  assert.match(skill, /canonical lifecycle-document, or request path directly as `--path`/);
  assert.match(skill, /shared resolver validates the complete leaf/);
  assert.match(skill, /reject every other lifecycle-document path/);
  assert.match(skill, /When both feature and path are present, pass both so conflicts fail closed/);
  assert.match(skill, /does not create directories/);
});

test('tech-spec normalizes its exact lifecycle-document trigger through the shared resolver', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-tech-spec-'));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-tech-spec-outside-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }));
  initRepository(root);
  fs.writeFileSync(path.join(root, 'seed.txt'), 'seed\n');
  git(root, ['add', 'seed.txt']);
  commit(root, 'initial');
  fs.mkdirSync(path.join(root, 'docs/features/billing'), { recursive: true });
  const triggerPath = 'docs/features/billing/2-tech-spec.md';
  assert.deepEqual(
    { key: resolveFeature(root, { path: triggerPath }).key,
      docsPath: resolveFeature(root, { path: triggerPath }).docs_path },
    { key: 'billing', docsPath: 'docs/features/billing' }
  );
  fs.writeFileSync(path.join(outside, 'external.md'), '# External\n');
  fs.symlinkSync(path.join(outside, 'external.md'), path.join(root, triggerPath));
  assert.throws(() => resolveFeature(root, { path: triggerPath }), /symlink/);
});

test('tech-spec keeps design, lifecycle, and deep-mode boundaries explicit', () => {
  const skill = fs.readFileSync(SKILL, 'utf8');
  assert.match(skill, /Do not invent missing product requirements, implement code, create date-prefixed execution tickets, or update per-task progress/);
  assert.match(skill, /extensive multi-option investigation or independent challenge in the deep mode/);
  assert.match(skill, /do not edit those tickets as part of technical design/);
  assert.match(skill, /do not add assignees, dates, estimates, or progress status/);
  assert.match(skill, /Include at least one proportional Mermaid architecture or sequence diagram/);
  const template = fs.readFileSync(path.join(
    path.dirname(SKILL), 'references', 'template.md'
  ), 'utf8');
  assert.match(template, /### 3\.1 Architecture or Sequence Diagram/);
  assert.match(template, /```mermaid/);
});

test('tech-spec deep mode preserves bounded proposal validation and synthesis', () => {
  const skill = fs.readFileSync(SKILL, 'utf8');
  assert.match(skill, /extract the proposal's objectives, questionable assumptions, and technical claims that need verification/);
  assert.match(skill, /naming conventions, dependency-injection patterns, error handling, and comparable implementations/);
  assert.match(skill, /compares at least two credible options/);
  assert.match(skill, /dependency-aware implementation roadmap/);
  assert.match(skill, /do not create a separate roadmap artifact or execution tracker/);
  const template = fs.readFileSync(path.join(
    path.dirname(SKILL), 'references', 'template.md'
  ), 'utf8');
  assert.match(template, /## 10\. Deep-Mode Evidence/);
  assert.match(template, /### 10\.3 Independent challenge and immediate validation/);
});

test('tech-spec contract owns default and deep units without a live deep-analyze alias', () => {
  const contract = JSON.parse(fs.readFileSync(CONTRACT, 'utf8'));
  assert.deepEqual(
    contract.units.map((unit) => ({
      id: unit.promotion_unit_id,
      mode: unit.target_mode,
      sources: unit.source_names
    })),
    [
      { id: 'tech-spec/deep', mode: 'deep', sources: ['deep-analyze'] },
      { id: 'tech-spec/default', mode: null, sources: ['tech-spec'] }
    ]
  );
  assert.equal(fs.existsSync(path.join(
    ROOT, 'plugin/sd0x-dev-flow-codex/skills/deep-analyze'
  )), false);
  assert.equal(fs.existsSync(path.join(
    ROOT, 'migration/candidates/deep-analyze'
  )), false);
});
