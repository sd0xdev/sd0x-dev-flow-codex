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

test('req-analyze can retry unresolved context with a selected new feature without creating it', (t) => {
  const root = repository();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  assert.equal(resolveFeature(root).key, null);
  const beforeDirectories = fs.readdirSync(path.join(root, 'docs/features'));
  const beforeStatus = git(root, ['status', '--porcelain=v1', '--untracked-files=all']);

  // Task interpretation selects this key; the resolver only validates the explicit retry.
  const selected = resolveFeature(root, {
    feature: 'autonomous-delivery',
    path: 'docs/features/autonomous-delivery/1-requirements.md'
  });
  assert.equal(selected.key, 'autonomous-delivery');
  assert.equal(selected.docs_path, 'docs/features/autonomous-delivery');
  assert.equal(selected.exists, false);
  assert.deepEqual(selected.canonical_docs, { requirements: null, tech_spec: null });
  assert.deepEqual(selected.active_requests, []);
  assert.equal(fs.existsSync(path.join(root, selected.docs_path)), false);
  assert.deepEqual(fs.readdirSync(path.join(root, 'docs/features')), beforeDirectories);
  assert.deepEqual(git(root, ['status', '--porcelain=v1', '--untracked-files=all']), beforeStatus);
});

test('req-analyze selects the task feature from multiple changed features without modifying either', (t) => {
  const root = repository();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const authPath = 'docs/features/auth/1-requirements.md';
  const billingPath = 'docs/features/billing/1-requirements.md';
  const authContent = '# Authentication\n\nUser-authored authentication requirements.\n';
  const billingContent = '# Billing\n\nUnrelated work in progress.\n';
  fs.writeFileSync(path.join(root, authPath), authContent);
  fs.writeFileSync(path.join(root, billingPath), billingContent);
  const beforeStatus = git(root, ['status', '--porcelain=v1', '--untracked-files=all']);
  assert.equal(resolveFeature(root).key, null);

  const selected = resolveFeature(root, { feature: 'auth', path: authPath });
  assert.equal(selected.key, 'auth');
  assert.equal(selected.docs_path, 'docs/features/auth');
  assert.equal(selected.canonical_docs.requirements, authPath);
  assert.equal(fs.readFileSync(path.join(root, authPath), 'utf8'), authContent);
  assert.equal(fs.readFileSync(path.join(root, billingPath), 'utf8'), billingContent);
  assert.deepEqual(git(root, ['status', '--porcelain=v1', '--untracked-files=all']), beforeStatus);
});

test('req-analyze inferred context does not bypass explicit conflicts or a symlinked requirements leaf', (t) => {
  const root = repository();
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-req-analyze-outside-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }));
  assert.equal(resolveFeature(root).key, null);
  const requirementsPath = 'docs/features/auth/1-requirements.md';
  assert.throws(() => resolveFeature(root, {
    feature: 'billing', path: requirementsPath
  }), /does not match/);
  const external = path.join(outside, 'requirements.md');
  const externalContent = '# External requirements\n';
  fs.writeFileSync(external, externalContent);
  fs.symlinkSync(external, path.join(root, requirementsPath));
  assert.throws(() => resolveFeature(root, {
    feature: 'auth', path: requirementsPath
  }), /symlink/);
  assert.equal(fs.readFileSync(external, 'utf8'), externalContent);
  assert.equal(fs.lstatSync(path.join(root, requirementsPath)).isSymbolicLink(), true);
});

test('req-analyze preserves lifecycle backlinks without mutating execution tickets', () => {
  const skill = fs.readFileSync(SKILL, 'utf8');
  assert.match(skill, /adds the missing relative `\.\/1-requirements\.md` backlink/);
  assert.match(skill, /Do not edit each request ticket merely to add a backlink/);
});
