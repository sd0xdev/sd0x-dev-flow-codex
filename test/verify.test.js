'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const {
  markGate,
  nextAction,
  recordSubagent,
  refreshState
} = require('../plugin/sd0x-dev-flow-codex/scripts/runtime/state');
const {
  commandForPlatform,
  detectCommands,
  execute,
  runVerification,
  stagedWorktreeDivergence
} = require('../plugin/sd0x-dev-flow-codex/scripts/runtime/verify');
const {
  commit,
  git,
  initRepository,
  isolateGitEnvironment
} = require('./helpers/git');

isolateGitEnvironment();

const CLI = path.resolve(
  __dirname,
  '..',
  'plugin',
  'sd0x-dev-flow-codex',
  'scripts',
  'runtime',
  'cli.js'
);

function createRepo(options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-verify-'));
  initRepository(root);
  const scripts = {};
  if (options.checkScript !== null) {
    scripts.check = options.checkScript || 'node -e "process.exit(0)"';
  }
  if (options.testScript !== null) scripts.test = options.testScript || 'node --test';
  if (options.buildScript) scripts.build = options.buildScript;
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ scripts }));
  git(root, ['add', '.']);
  commit(root, 'baseline');
  fs.writeFileSync(path.join(root, 'app.js'), 'module.exports = true;\n');
  return root;
}

function setReviewProvider(root, provider) {
  fs.appendFileSync(path.join(root, '.git', 'info', 'exclude'), '\n.codex/\n');
  fs.mkdirSync(path.join(root, '.codex'), { recursive: true });
  fs.writeFileSync(
    path.join(root, '.codex', 'sd0x-dev-flow.json'),
    JSON.stringify({ schema_version: 1, enabled: true, review: { provider } })
  );
}

function passReview(root) {
  refreshState(root);
  for (const agentType of [
    'sd0x_codex_primary_reviewer',
    'sd0x_test_reviewer'
  ]) {
    const agentId = `${agentType}-1`;
    recordSubagent(root, 'start', { agent_id: agentId, agent_type: agentType });
    recordSubagent(root, 'stop', {
      agent_id: agentId,
      agent_type: agentType,
      stop_hook_active: false,
      last_assistant_message: 'No actionable findings remain.'
    });
  }
  return markGate(root, 'review', 'pass', {
    provider: 'codex',
    reviewers: 2,
    agents: [
      'sd0x_codex_primary_reviewer',
      'sd0x_test_reviewer'
    ],
    findings: 0
  });
}

test('Node repositories prefer one aggregate check script', (t) => {
  const root = createRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const commands = detectCommands(root).commands;
  assert.deepEqual(commands, [
    { command: 'git', args: ['diff', '--check', '--cached', '--'] },
    { command: 'git', args: ['diff', '--check', 'HEAD', '--'] },
    { command: 'npm', args: ['run', 'check'] }
  ]);
});

test('build-only Node repositories run the build as their project check', (t) => {
  const root = createRepo({
    checkScript: null,
    testScript: null,
    buildScript: 'node -e "process.exit(7)"'
  });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  assert.deepEqual(detectCommands(root).commands.at(-1), {
    command: 'npm',
    args: ['run', 'build']
  });
  passReview(root);

  const result = runVerification(root);
  assert.equal(result.status, 'fail');
  assert.equal(result.evidence.commands.at(-1).exit_code, 7);
  assert.equal(result.evidence.commands.at(-1).command, 'npm run build');
});

test('Windows resolves package runners through their command shims', () => {
  for (const runner of ['npm', 'yarn', 'pnpm']) {
    assert.equal(commandForPlatform(runner, 'win32'), `${runner}.cmd`);
  }
  assert.equal(commandForPlatform('bun', 'win32'), 'bun');
  assert.equal(commandForPlatform('npm', 'linux'), 'npm');

  let observed;
  const result = execute({ command: 'npm', args: ['run', 'check'] }, 'C:\\repo', {
    platform: 'win32',
    spawnProcess(command, args, options) {
      observed = { command, args, options };
      return { status: 0, stdout: '', stderr: '' };
    }
  });
  assert.equal(result.exit_code, 0);
  assert.equal(observed.command, 'npm.cmd');
  assert.deepEqual(observed.args, ['run', 'check']);
  assert.equal(observed.options.shell, true);
  assert.equal(observed.options.timeout, 30 * 60 * 1000);
});

test('verification records successful deterministic evidence', (t) => {
  const root = createRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  passReview(root);
  const result = runVerification(root);
  assert.equal(result.status, 'pass');
  assert.equal(result.state.gates.verify.status, 'pass');
  assert.equal(result.evidence.commands.length, 3);
  assert.ok(result.evidence.commands.every((item) => item.exit_code === 0));
  assert.equal(result.evidence.fingerprint_changed, false);
});

test('verification records a selected command exiting non-zero', (t) => {
  const root = createRepo({
    checkScript: 'node -e "process.exit(7)"'
  });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  passReview(root);

  const result = runVerification(root);
  assert.equal(result.status, 'fail');
  assert.equal(result.state.gates.verify.status, 'fail');
  assert.equal(result.evidence.commands.length, 3);
  assert.equal(result.evidence.commands[0].exit_code, 0);
  assert.equal(result.evidence.commands[1].exit_code, 0);
  assert.equal(result.evidence.commands[2].exit_code, 7);
  assert.match(result.evidence.commands[2].command, /^npm run check$/);
  assert.equal(result.evidence.fingerprint_changed, false);
});

test('verification fails closed when staged and worktree versions diverge', (t) => {
  const root = createRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'app.js'), 'module.exports = false;\n');
  git(root, ['add', 'app.js']);
  fs.writeFileSync(path.join(root, 'app.js'), 'module.exports = true;\n');
  assert.deepEqual(stagedWorktreeDivergence(root), ['app.js']);
  passReview(root);

  const result = runVerification(root);
  assert.equal(result.status, 'fail');
  assert.equal(result.evidence.commands.length, 1);
  assert.match(result.evidence.commands[0].command, /divergence/);
  assert.match(result.evidence.commands[0].output, /app\.js/);
});

test('verification catches a file recreated after its deletion was staged', (t) => {
  const root = createRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  git(root, ['add', 'app.js']);
  commit(root, 'track app');
  fs.rmSync(path.join(root, 'app.js'));
  git(root, ['add', '-u', '--', 'app.js']);
  fs.writeFileSync(path.join(root, 'app.js'), 'module.exports = true;\n');

  assert.deepEqual(stagedWorktreeDivergence(root), ['app.js']);
  passReview(root);

  const result = runVerification(root);
  assert.equal(result.status, 'fail');
  assert.equal(result.evidence.commands.length, 1);
  assert.match(result.evidence.commands[0].output, /app\.js/);
});

test('verification catches a rename source recreated in the worktree', (t) => {
  const root = createRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  git(root, ['add', 'app.js']);
  commit(root, 'track app');
  git(root, ['mv', 'app.js', 'renamed.js']);
  fs.writeFileSync(path.join(root, 'app.js'), 'module.exports = true;\n');

  assert.deepEqual(stagedWorktreeDivergence(root), ['app.js']);
  passReview(root);
  const result = runVerification(root);
  assert.equal(result.status, 'fail');
  assert.match(result.evidence.commands[0].output, /app\.js/);
});

test('verification refuses to run before review passes', (t) => {
  const root = createRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  assert.throws(() => runVerification(root), /review pass first/);
  assert.equal(refreshState(root).gates.verify.status, 'pending');
});

test('verification fails when a check mutates the reviewed fingerprint', (t) => {
  const root = createRepo({
    checkScript: 'node -e "require(\'fs\').writeFileSync(\'app.js\', \'module.exports = false;\\n\')"'
  });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  passReview(root);

  const result = runVerification(root);
  assert.equal(result.status, 'fail');
  assert.equal(result.evidence.fingerprint_changed, true);
  assert.equal(result.state.gates.review.status, 'pending');
  assert.equal(nextAction(result.state).action, 'review');
});

test('verification fails when the review provider changes during checks', (t) => {
  const root = createRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  passReview(root);
  const startingFingerprint = refreshState(root).worktree.fingerprint;
  let changed = false;

  const result = runVerification(root, {
    onResult() {
      if (changed) return;
      changed = true;
      setReviewProvider(root, 'claude');
    }
  });

  assert.equal(result.status, 'fail');
  assert.equal(result.state.worktree.fingerprint, startingFingerprint);
  assert.equal(result.state.review_provider, 'claude');
  assert.equal(result.state.gates.review.status, 'pending');
  assert.equal(result.state.gates.verify.status, 'fail');
  assert.equal(result.evidence.provider_changed, true);
  assert.equal(result.evidence.expected_provider, 'codex');
  assert.equal(result.evidence.observed_provider, 'claude');
  assert.deepEqual(nextAction(result.state), {
    action: 'review',
    reason: 'review-required'
  });
});

test('generic CLI cannot fabricate a passing verification gate', (t) => {
  const root = createRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const result = spawnSync(process.execPath, [
    CLI,
    'gate',
    'verify',
    'pass',
    '--evidence',
    JSON.stringify({ commands: [{ command: 'fake', exit_code: 0 }] })
  ], {
    cwd: root,
    encoding: 'utf8'
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /deterministic verify command/);
});
