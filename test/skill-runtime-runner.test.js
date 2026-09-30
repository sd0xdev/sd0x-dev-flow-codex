'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync, spawn } = require('node:child_process');
const test = require('node:test');
const { RUNTIME_ENTRYPOINTS, runSkillScript } = require('../plugin/sd0x-dev-flow-codex/scripts/runtime/runner');
const { doctor, runnerStatus } = require('../plugin/sd0x-dev-flow-codex/scripts/runtime/cli');
const { snapshot } = require('../plugin/sd0x-dev-flow-codex/scripts/runtime/worktree');
const {
  refreshState,
  resolveStatePath
} = require('../plugin/sd0x-dev-flow-codex/scripts/runtime/state');
const {
  MANAGED_BLOCK
} = require('../plugin/sd0x-dev-flow-codex/scripts/runtime/workflow-contract');
const {
  commit,
  git,
  initRepository,
  isolateGitEnvironment
} = require('./helpers/git');

isolateGitEnvironment();

const PLUGIN = path.resolve(__dirname, '../plugin/sd0x-dev-flow-codex');
const RUNNER = path.join(PLUGIN, 'scripts/runtime/runner.js');

test('plugin exposes the local runner without MCP configuration', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(PLUGIN, '.codex-plugin/plugin.json')));
  assert.equal(Object.hasOwn(manifest, 'mcpServers'), false);
  assert.equal(fs.existsSync(path.join(PLUGIN, '.mcp.json')), false);
  assert.equal(fs.existsSync(path.join(PLUGIN, 'scripts/mcp/server.js')), false);
  const result = runnerStatus(PLUGIN);
  assert.equal(result.ready, true);
  assert.equal(result.transport, 'cli');
  assert.deepEqual(result.entrypoints, Object.keys(RUNTIME_ENTRYPOINTS));
});

test('doctor rejects retained MCP registration before executing a runner', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-retired-connection-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, '.codex-plugin'));
  const manifest = path.join(root, '.codex-plugin/plugin.json');
  fs.writeFileSync(manifest, JSON.stringify({ mcpServers: './.mcp.json' }));
  const execute = () => assert.fail('retained MCP configuration must not execute');
  assert.equal(runnerStatus(root, execute).reason, 'mcp-configuration-present');
  fs.writeFileSync(manifest, '{}');
  fs.writeFileSync(path.join(root, '.mcp.json'), '{}');
  assert.equal(runnerStatus(root, execute).reason, 'mcp-configuration-present');
});

test('doctor fails closed on a broken runner or unexpected description', () => {
  for (const result of [
    { error: { code: 'ETIMEDOUT' } }, { status: 1 },
    { status: 0, stdout: 'not JSON' },
    { status: 0, stdout: JSON.stringify({ schema_version: 1, transport: 'cli', entrypoints: [] }) }
  ]) assert.equal(runnerStatus(PLUGIN, () => result).ready, false);
});

function createRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-skill-runtime-'));
  initRepository(root);
  fs.writeFileSync(path.join(root, 'app.js'), 'module.exports = 1;\n');
  fs.writeFileSync(path.join(root, 'helper.js'), 'module.exports = 42;\n');
  git(root, ['add', '.']);
  commit(root, 'baseline');
  fs.writeFileSync(path.join(root, 'app.js'), 'module.exports = 2;\n');
  fs.writeFileSync(path.join(root, 'app.test.js'), 'assert.equal(value, 2);\n');
  return root;
}

test('runtime runner pins the host Node executable and installed script in hostile environments',
  async (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-runtime-tool-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const pluginRoot = path.join(root, 'plugin');
    const cwd = path.join(root, 'hostile-project');
    const script = path.join(
      pluginRoot,
      'skills',
      'remind',
      'scripts',
      'status.js'
    );
    const shadowNode = path.join(cwd, process.platform === 'win32' ? 'node.cmd' : 'node');
    const shadowMarker = path.join(root, 'shadow-executed');
    fs.mkdirSync(path.dirname(script), { recursive: true });
    fs.mkdirSync(cwd, { recursive: true });
    fs.writeFileSync(script, [
      "'use strict';",
      'process.stdout.write(JSON.stringify({',
      '  execPath: process.execPath,',
      '  cwd: process.cwd(),',
      '  nodeOptions: process.env.NODE_OPTIONS || null,',
      '  nodePath: process.env.NODE_PATH || null',
      '}));'
    ].join('\n'));
    if (process.platform === 'win32') {
      fs.writeFileSync(shadowNode, `@echo shadow>${shadowMarker}\r\n`);
    } else {
      fs.writeFileSync(
        shadowNode,
        `#!/bin/sh\nprintf shadow > ${JSON.stringify(shadowMarker)}\n`
      );
      fs.chmodSync(shadowNode, 0o755);
    }

    const result = await runSkillScript({
      entrypoint: 'remind/status.js',
      cwd
    }, {
      pluginRoot,
      environment: {
        ...process.env,
        PATH: `${cwd}${path.delimiter}${process.env.PATH || ''}`,
        NODE_OPTIONS: '--require=/definitely/untrusted.js',
        NODE_PATH: cwd
      }
    });

    assert.equal(result.exit_code, 0);
    assert.equal(fs.existsSync(shadowMarker), false);
    assert.deepEqual(JSON.parse(result.stdout), {
      execPath: fs.realpathSync(process.execPath),
      cwd: fs.realpathSync(cwd),
      nodeOptions: null,
      nodePath: null
    });
  });

test('runtime runner rejects malformed inputs and installed entrypoint escapes', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-runtime-tool-reject-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const pluginRoot = path.join(root, 'plugin');
  const cwd = path.join(root, 'repo');
  fs.mkdirSync(cwd, { recursive: true });

  for (const input of [
    { entrypoint: 'unknown/script.js', cwd },
    { entrypoint: 'review/gate.js', cwd: 'relative' },
    { entrypoint: 'review/gate.js', cwd, args: Array(65).fill('x') },
    { entrypoint: 'review/gate.js', cwd, unexpected: true }
  ]) {
    assert.throws(
      () => runSkillScript(input, { pluginRoot }),
      /(?:allowlisted|absolute path|at most 64|unsupported fields)/
    );
  }

  if (process.platform === 'win32') return;
  const outside = path.join(root, 'outside.js');
  const entrypoint = path.join(pluginRoot, 'skills', 'remind', 'scripts', 'status.js');
  fs.writeFileSync(outside, 'process.stdout.write("outside");\n');
  fs.mkdirSync(path.dirname(entrypoint), { recursive: true });
  fs.symlinkSync(outside, entrypoint);
  assert.throws(
    () => runSkillScript({ entrypoint: 'remind/status.js', cwd }, { pluginRoot }),
    /escapes the installed plugin payload/
  );
});

test('doctor always checks the skill runtime but skips Claude checks for Codex', (t) => {
  const root = createRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  let runnerChecks = 0;
  const status = doctor(root, {
    claudeStatus: () => {
      throw new Error('Claude status must not run in Codex mode');
    },
    runnerStatus: () => {
      runnerChecks += 1;
      return { ready: true, transport: 'cli' };
    }
  });
  assert.equal(status.review_provider, 'codex');
  assert.equal('claude' in status, false);
  assert.equal(runnerChecks, 1);
  assert.equal(status.runtime.ready, true);
  assert.equal(
    status.checks.find((check) => check.check === 'skill-runtime-cli').ok,
    true
  );
  assert.equal(status.checks.some((check) => check.check === 'claude-cli'), false);
  assert.equal(
    status.checks.some((check) => check.check === 'claude-review-mcp-handshake'),
    false
  );
});

test('doctor reports managed guidance contract drift for enabled projects', (t) => {
  const root = createRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, '.codex'), { recursive: true });
  fs.writeFileSync(path.join(root, '.codex', 'sd0x-dev-flow.json'), JSON.stringify({
    schema_version: 1,
    enabled: true,
    review: { provider: 'codex' }
  }));
  const options = {
    runnerStatus: () => ({ ready: true, transport: 'cli' })
  };

  let status = doctor(root, options);
  assert.equal(status.managed_guidance.status, 'missing');
  assert.deepEqual(
    status.checks.find((check) => check.check === 'managed-guidance-current'),
    { check: 'managed-guidance-current', ok: false }
  );

  fs.writeFileSync(path.join(root, 'AGENTS.md'), `${MANAGED_BLOCK}\n`);
  status = doctor(root, options);
  assert.equal(status.managed_guidance.status, 'current');
  assert.equal(status.workflow_contract_version, 1);
  assert.deepEqual(
    status.checks.find((check) => check.check === 'managed-guidance-current'),
    { check: 'managed-guidance-current', ok: true }
  );

  fs.writeFileSync(path.join(root, 'AGENTS.md'), MANAGED_BLOCK.replace(
    'the model owns', 'the hook owns'
  ));
  status = doctor(root, options);
  assert.equal(status.managed_guidance.status, 'stale');
  assert.equal(status.ok, false);
});

test('doctor requires Node.js 24 or newer', (t) => {
  const root = createRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const unsupported = doctor(root, { nodeMajor: 23 });
  assert.equal(unsupported.ok, false);
  assert.deepEqual(
    unsupported.checks.find((check) => check.check === 'node>=24'),
    { check: 'node>=24', ok: false }
  );

  const supported = doctor(root, { nodeMajor: 24 });
  assert.deepEqual(
    supported.checks.find((check) => check.check === 'node>=24'),
    { check: 'node>=24', ok: true }
  );
});

test('doctor reports corrupt runtime state without crashing', (t) => {
  const root = createRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  refreshState(root, { sessionId: 'doctor-corrupt-state' });
  fs.writeFileSync(resolveStatePath(root), '{not valid json');

  const status = doctor(root);

  assert.equal(status.ok, false);
  assert.equal(status.status, null);
  assert.match(status.state_error, /runtime state is unreadable or corrupt/i);
  assert.deepEqual(
    status.checks.find((check) => check.check === 'runtime-state-readable'),
    { check: 'runtime-state-readable', ok: false }
  );
});

test('doctor fails when any shipped skill artifact is missing', (t) => {
  const root = createRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const source = path.resolve(__dirname, '..', 'plugin', 'sd0x-dev-flow-codex');
  const pluginRoot = path.join(root, 'plugin-fixture');
  fs.cpSync(source, pluginRoot, { recursive: true });
  const options = {
    pluginRoot,
    claudeStatus: () => ({ installed: true, compatible: true, authenticated: true }),
    runnerStatus: () => ({ ready: true, transport: 'cli' })
  };

  const representativeArtifacts = [
    'scripts/runtime/collaboration.js',
    'skills/architecture/SKILL.md',
    'skills/architecture/migration-contract.json',
    'skills/feature-verify/references/blackbox-testing.md',
    'skills/orchestrate/scripts/validate-plan.js',
    'skills/review/scripts/gate.js',
    'skills/test-review/SKILL.md',
    'templates/agents/sd0x-codex-primary-reviewer.toml'
  ];

  for (const relative of representativeArtifacts) {
    const artifact = path.join(pluginRoot, relative);
    const contents = fs.readFileSync(artifact);
    fs.rmSync(artifact);
    const status = doctor(root, options);
    assert.equal(status.ok, false);
    assert.deepEqual(
      status.checks.find((check) => check.check === relative),
      { check: relative, ok: false }
    );
    fs.mkdirSync(path.dirname(artifact), { recursive: true });
    fs.writeFileSync(artifact, contents);
  }

  const extra = path.join(pluginRoot, 'skills', 'unmanifested.txt');
  fs.writeFileSync(extra, 'not declared\n');
  const status = doctor(root, options);
  assert.equal(status.ok, false);
  assert.deepEqual(
    status.checks.find((check) => check.check === 'skills/unmanifested.txt'),
    { check: 'skills/unmanifested.txt', ok: false }
  );
});

test('doctor rejects symbolic payload files and a symbolic manifest', (t) => {
  const root = createRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const source = path.resolve(__dirname, '..', 'plugin', 'sd0x-dev-flow-codex');
  const pluginRoot = path.join(root, 'plugin-fixture');
  const outside = path.join(root, 'outside');
  fs.cpSync(source, pluginRoot, { recursive: true });
  fs.mkdirSync(outside);
  const options = {
    pluginRoot,
    claudeStatus: () => ({ installed: true, compatible: true, authenticated: true }),
    runnerStatus: () => ({ ready: true, transport: 'cli' })
  };

  const relative = 'skills/test-review/SKILL.md';
  const artifact = path.join(pluginRoot, relative);
  const outsideArtifact = path.join(outside, 'SKILL.md');
  fs.copyFileSync(artifact, outsideArtifact);
  fs.rmSync(artifact);
  fs.symlinkSync(outsideArtifact, artifact);
  let status = doctor(root, options);
  assert.equal(status.ok, false);
  assert.deepEqual(status.checks.find((check) => check.check === relative),
    { check: relative, ok: false });
  assert.deepEqual(status.checks.find((check) =>
    check.check === `${relative}#symbolic-link`),
  { check: `${relative}#symbolic-link`, ok: false });

  fs.rmSync(artifact);
  fs.copyFileSync(outsideArtifact, artifact);
  const manifestRelative = '.codex-plugin/payload-manifest.json';
  const manifest = path.join(pluginRoot, manifestRelative);
  const outsideManifest = path.join(outside, 'payload-manifest.json');
  fs.copyFileSync(manifest, outsideManifest);
  fs.rmSync(manifest);
  fs.symlinkSync(outsideManifest, manifest);
  status = doctor(root, options);
  assert.equal(status.ok, false);
  assert.deepEqual(status.checks.find((check) =>
    check.check === manifestRelative),
  { check: manifestRelative, ok: false });
});

test('CLI reports script output and preserves failing script exit status', (t) => {
  const root = createRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const env = { ...process.env };
  delete env.CODEX_HOME;
  delete env.CODEX_THREAD_ID;
  for (const [entrypoint, expected] of [['review/provider.js', 0], ['doctor/doctor.js', 1]]) {
    const result = spawnSync(process.execPath, [RUNNER, JSON.stringify({
      cwd: root, entrypoint, args: []
    })], { env, encoding: 'utf8' });
    assert.equal(result.status, expected, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.equal(output.exit_code, expected);
    assert.equal(output.entrypoint, entrypoint);
    assert.equal(typeof JSON.parse(output.stdout), 'object');
    if (expected) assert.match(output.stderr, /session-context-missing/);
  }
  for (const args of [[], ['{bad'], ['{}', '{}'], [JSON.stringify({
    cwd: root, entrypoint: 'review_worktree'
  })]]) {
    const result = spawnSync(process.execPath, [RUNNER, ...args], { encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /sd0x runner:/);
  }
});

function childFixture(t, body) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-runner-child-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const pluginRoot = path.join(root, 'plugin');
  fs.cpSync(PLUGIN, pluginRoot, { recursive: true });
  fs.writeFileSync(path.join(pluginRoot, 'skills/remind/scripts/status.js'), body);
  return { root, pluginRoot, input: { cwd: root, entrypoint: 'remind/status.js' } };
}

test('runner terminates output-overflow work and honors an abort signal', async (t) => {
  const values = childFixture(t, "process.stdout.write('x'.repeat(4096)); setInterval(() => {}, 1000);");
  await assert.rejects(runSkillScript(values.input, {
    pluginRoot: values.pluginRoot, maxOutputBytes: 128
  }), /output exceeded the limit/);
  const controller = new AbortController();
  const running = runSkillScript(values.input, {
    pluginRoot: values.pluginRoot, signal: controller.signal
  });
  controller.abort();
  await assert.rejects(running, { code: 'ABORT_ERR' });
});

test('CLI cancellation aborts its running script', { skip: process.platform === 'win32' }, async (t) => {
  const values = childFixture(t, "require('node:fs').writeFileSync('started', String(process.pid)); setInterval(() => {}, 1000);");
  const child = spawn(process.execPath, [path.join(values.pluginRoot, 'scripts/runtime/runner.js'),
    JSON.stringify(values.input)], { stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(() => child.kill('SIGKILL'));
  const closed = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code, signal) => resolve({ code, signal }));
  });
  const marker = path.join(values.root, 'started');
  const deadline = Date.now() + 5000;
  while (!fs.existsSync(marker) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.ok(fs.existsSync(marker), 'script must start before cancellation');
  child.kill('SIGTERM');
  assert.deepEqual(await closed, { code: 143, signal: null });
});
