'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const test = require('node:test');
const { RUN_SKILL_SCRIPT_TOOL, runSkillScript, serve } = require('../plugin/sd0x-dev-flow-codex/scripts/mcp/server');
const { doctor, mcpServerStatus } = require('../plugin/sd0x-dev-flow-codex/scripts/runtime/cli');
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

test('MCP exposes only the deterministic runner and rejects the retired review tool', async (t) => {
  let executions = 0;
  const harness = protocolHarness(async () => {
    executions += 1;
    return { exit_code: 0, stdout: 'ok', stderr: '' };
  });
  t.after(() => harness.close());
  const initialized = await harness.request({
    jsonrpc: '2.0', id: 1, method: 'initialize',
    params: { protocolVersion: '2025-11-25' }
  });
  assert.equal(initialized.result.serverInfo.name, 'sd0x-skill-runtime');
  const listed = await harness.request({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
  assert.deepEqual(listed.result.tools.map((tool) => tool.name), ['run_skill_script']);
  const rejected = await harness.request({
    jsonrpc: '2.0', id: 3, method: 'tools/call',
    params: { name: 'review_worktree', arguments: {} }
  });
  assert.equal(rejected.error.code, -32602);
  assert.equal(executions, 0);
  const executed = await harness.request({
    jsonrpc: '2.0', id: 4, method: 'tools/call',
    params: { name: 'run_skill_script', arguments: {} }
  });
  assert.equal(executed.result.isError, false);
  assert.equal(executions, 1);
  assert.equal(require('../plugin/sd0x-dev-flow-codex/scripts/mcp/server').reviewWorktree, undefined);
});

test('doctor verifies the real runtime handshake without a review tool', () => {
  const result = mcpServerStatus(path.resolve(__dirname, '../plugin/sd0x-dev-flow-codex'));
  assert.equal(result.ready, true);
  assert.equal(result.runtime_ready, true);
  assert.equal(result.tool, null);
  assert.equal(result.server_name, 'sd0x-skill-runtime');
});

test('doctor rejects a retained Claude connection before starting any server', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-retired-connection-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const configuration = JSON.parse(fs.readFileSync(path.resolve(
    __dirname, '../plugin/sd0x-dev-flow-codex/.mcp.json'
  ), 'utf8'));
  assert.deepEqual(Object.keys(configuration.mcpServers), ['sd0x_skill_runtime']);
  const server = configuration.mcpServers.sd0x_skill_runtime;
  for (const servers of [
    { sd0x_claude_review: server },
    { sd0x_skill_runtime: server, sd0x_claude_review: server }
  ]) {
    fs.writeFileSync(path.join(root, '.mcp.json'), JSON.stringify({ mcpServers: servers }));
    const result = mcpServerStatus(root, () => assert.fail('retired connection must not execute'));
    assert.deepEqual(result, { ready: false, reason: 'retired-review-connection-present' });
  }
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

function protocolHarness(executeRuntime) {
  const input = new PassThrough();
  const output = new PassThrough();
  const pending = new Map();
  let buffer = '';
  output.setEncoding('utf8');
  output.on('data', (chunk) => {
    buffer += chunk;
    let index;
    while ((index = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, index);
      buffer = buffer.slice(index + 1);
      if (!line) continue;
      const message = JSON.parse(line);
      const request = pending.get(message.id);
      if (request) {
        pending.delete(message.id);
        clearTimeout(request.timer);
        request.resolve(message);
      }
    }
  });
  const lines = serve({ input, output, runSkillScript: executeRuntime });
  return {
    request(message) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(message.id);
          reject(new Error('MCP response timeout'));
        }, 1000);
        pending.set(message.id, { resolve, reject, timer });
        input.write(`${JSON.stringify(message)}\n`);
      });
    },
    notify(message) {
      input.write(`${JSON.stringify(message)}\n`);
    },
    close() {
      lines.close();
      input.end();
      output.end();
      for (const request of pending.values()) {
        clearTimeout(request.timer);
        request.reject(new Error('MCP transport closed'));
      }
      pending.clear();
    }
  };
}

test('runtime tool pins the host Node executable and installed script in hostile environments',
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

test('runtime tool rejects malformed inputs and installed entrypoint escapes', (t) => {
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
  let mcpChecks = 0;
  const status = doctor(root, {
    claudeStatus: () => {
      throw new Error('Claude status must not run in Codex mode');
    },
    mcpStatus: () => {
      mcpChecks += 1;
      return { ready: true, runtime_ready: true };
    }
  });
  assert.equal(status.review_provider, 'codex');
  assert.equal('claude' in status, false);
  assert.equal(mcpChecks, 1);
  assert.equal(status.mcp.runtime_ready, true);
  assert.equal(
    status.checks.find((check) => check.check === 'skill-runtime-mcp-handshake').ok,
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
    mcpStatus: () => ({ runtime_ready: true, review_ready: false })
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
    mcpStatus: () => ({ runtime_ready: true, review_ready: true })
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
    mcpStatus: () => ({ runtime_ready: true, review_ready: true })
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

test('MCP cancellation aborts the active runtime request', async (t) => {
  let started;
  const reviewStarted = new Promise((resolve) => { started = resolve; });
  const harness = protocolHarness((_input, options) => new Promise((_resolve, reject) => {
    started();
    options.signal.addEventListener('abort', () => {
      const error = new Error('Runtime cancelled');
      error.code = 'ABORT_ERR';
      reject(error);
    }, { once: true });
  }));
  t.after(() => harness.close());
  const responsePromise = harness.request({
    jsonrpc: '2.0',
    id: 9,
    method: 'tools/call',
    params: {
      name: 'run_skill_script',
      arguments: { cwd: '/repo', fingerprint: 'a'.repeat(64) }
    }
  });
  await reviewStarted;
  harness.notify({
    jsonrpc: '2.0',
    method: 'notifications/cancelled',
    params: { requestId: 9, reason: 'client stopped waiting' }
  });
  const response = await responsePromise;
  assert.equal(response.result.isError, true);
  assert.match(response.result.content[0].text, /cancelled/);
});

test('closing the MCP transport aborts active runtime work', async () => {
  let started;
  let aborted;
  const reviewStarted = new Promise((resolve) => { started = resolve; });
  const reviewAborted = new Promise((resolve) => { aborted = resolve; });
  const harness = protocolHarness((_input, options) => new Promise((_resolve, reject) => {
    started();
    options.signal.addEventListener('abort', () => {
      aborted();
      const error = new Error('transport closed');
      error.code = 'ABORT_ERR';
      reject(error);
    }, { once: true });
  }));
  const responsePromise = harness.request({
    jsonrpc: '2.0',
    id: 10,
    method: 'tools/call',
    params: {
      name: 'run_skill_script',
      arguments: { cwd: '/repo', fingerprint: 'a'.repeat(64) }
    }
  });
  await reviewStarted;
  harness.close();
  await reviewAborted;
  await assert.rejects(responsePromise, /transport closed/);
});
