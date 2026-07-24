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
  'plugin/sd0x-dev-flow-codex/skills/req-analyze/SKILL.md'
);

function repository() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-req-analyze-'));
  initRepository(root);
  fs.writeFileSync(path.join(root, 'seed.txt'), 'seed\n');
  git(root, ['add', 'seed.txt']);
  commit(root, 'initial');
  fs.mkdirSync(path.join(root, 'docs/features/auth'), { recursive: true });
  fs.mkdirSync(path.join(root, 'docs/features/billing'), { recursive: true });
  return root;
}

test('req-analyze delegates deterministic context selection to the shared resolver', (t) => {
  const skill = fs.readFileSync(SKILL, 'utf8');
  assert.match(skill, /\.\.\/create-request\/scripts\/request-tool\.js/);
  assert.match(skill, /explicit path and key, current branch, changed paths, then exactly one/);

  const root = repository();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  git(root, ['switch', '-c', 'feat/auth']);
  assert.deepEqual(
    { key: resolveFeature(root).key, source: resolveFeature(root).source },
    { key: 'auth', source: 'branch' }
  );
  assert.throws(() => resolveFeature(root, {
    feature: 'billing',
    path: 'docs/features/auth'
  }), /does not match/);
});

test('req-analyze preserves bounded parallel research and lifecycle backlinks', () => {
  const skill = fs.readFileSync(SKILL, 'utf8');
  assert.match(skill, /assign at most one read-only repository investigator/);
  assert.match(skill, /both evidence streams proceed in parallel/);
  assert.match(skill, /same bounded parallel repository and external research as standard mode/);
  assert.match(skill, /adds the missing relative `\.\/1-requirements\.md` backlink/);
  assert.match(skill, /Do not edit each request ticket merely to add a backlink/);
});
