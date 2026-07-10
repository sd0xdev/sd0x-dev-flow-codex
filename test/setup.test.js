'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  END,
  START,
  setup
} = require('../plugin/sd0x-dev-flow-codex/skills/setup/scripts/setup');
const {
  hasSetupDeferral,
  setupDeferralPath
} = require('../plugin/sd0x-dev-flow-codex/scripts/runtime/state');
const {
  initRepository,
  isolateGitEnvironment
} = require('./helpers/git');

isolateGitEnvironment();

function createRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-setup-'));
  initRepository(root);
  return root;
}

test('setup preserves user guidance and is idempotent', (t) => {
  const root = createRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'AGENTS.md'), '# Project Rules\n\nKeep this.\n');

  const first = setup(root);
  const firstContent = fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8');
  const second = setup(root);
  const secondContent = fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8');

  assert.equal(firstContent, secondContent);
  assert.match(firstContent, /Keep this\./);
  assert.equal(firstContent.split(START).length - 1, 1);
  assert.equal(firstContent.split(END).length - 1, 1);
  assert.ok(first.results.some((item) => item.status === 'created'));
  assert.ok(second.results.every((item) => item.status === 'unchanged'));
  assert.equal(first.activation_deferred, true);
  assert.equal(second.activation_deferred, false);
  assert.equal(first.setup_claim.schema_version, 1);
  assert.equal(fs.realpathSync(first.setup_claim.root), fs.realpathSync(root));
  assert.match(first.setup_claim.token, /^[0-9a-f-]{36}$/);
  assert.equal(second.setup_claim, null);
  assert.equal(hasSetupDeferral(root), true);
  assert.ok(
    fs.realpathSync(setupDeferralPath(root)).startsWith(
      fs.realpathSync(path.join(root, '.git'))
    )
  );
  const implementationAgent = fs.readFileSync(
    path.join(root, '.codex', 'agents', 'sd0x-reviewer.toml'),
    'utf8'
  );
  const testAgent = fs.readFileSync(
    path.join(root, '.codex', 'agents', 'sd0x-test-reviewer.toml'),
    'utf8'
  );
  assert.match(implementationAgent, /performance, resource growth/);
  assert.match(implementationAgent, /intentional design/);
  assert.match(testAgent, /acceptance traceability/);
  assert.match(testAgent, /mock reasonableness/);
  assert.equal(JSON.parse(
    fs.readFileSync(path.join(root, '.codex', 'sd0x-dev-flow.json'), 'utf8')
  ).enabled, true);
});

test('setup refuses to replace an unowned agent file', (t) => {
  const root = createRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const agentPath = path.join(root, '.codex', 'agents', 'sd0x-reviewer.toml');
  fs.mkdirSync(path.dirname(agentPath), { recursive: true });
  fs.writeFileSync(agentPath, 'name = "custom"\n');
  assert.throws(() => setup(root), /Refusing to replace unowned/);
  assert.equal(fs.existsSync(path.join(root, 'AGENTS.md')), false);
  assert.equal(fs.existsSync(path.join(root, '.codex', 'sd0x-dev-flow.json')), false);
});

test('setup preflights invalid config before writing guidance', (t) => {
  const root = createRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const configPath = path.join(root, '.codex', 'sd0x-dev-flow.json');
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, '{not json');
  assert.throws(() => setup(root), /invalid/);
  assert.equal(fs.existsSync(path.join(root, 'AGENTS.md')), false);
});
