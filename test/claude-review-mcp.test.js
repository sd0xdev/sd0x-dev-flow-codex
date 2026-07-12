'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const test = require('node:test');
const {
  CLAUDE_REQUIRED_FLAGS,
  CLAUDE_OUTPUT_SCHEMA,
  DEFAULT_TIMEOUT_MS,
  MAX_PROCESS_OUTPUT_BYTES,
  REVIEW_SYSTEM_PROMPT,
  buildClaudeArgs,
  buildClaudeEnv,
  claudeAttemptTimeoutMs,
  claudeRequiredFlags,
  collectReviewBundle,
  executeClaude,
  executeClaudeAttempt,
  resolveClaudeExecutable,
  reviewWorktree,
  serve
} = require('../plugin/sd0x-dev-flow-codex/scripts/mcp/server');
const {
  claudeCliStatus,
  doctor,
  mcpServerStatus
} = require('../plugin/sd0x-dev-flow-codex/scripts/runtime/cli');
const { snapshot } = require('../plugin/sd0x-dev-flow-codex/scripts/runtime/worktree');
const {
  refreshState,
  resolveStatePath
} = require('../plugin/sd0x-dev-flow-codex/scripts/runtime/state');
const {
  commit,
  git,
  initRepository,
  isolateGitEnvironment
} = require('./helpers/git');

isolateGitEnvironment();

function createRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-claude-mcp-'));
  initRepository(root);
  fs.writeFileSync(path.join(root, 'app.js'), 'module.exports = 1;\n');
  fs.writeFileSync(path.join(root, 'helper.js'), 'module.exports = 42;\n');
  git(root, ['add', '.']);
  commit(root, 'baseline');
  fs.writeFileSync(path.join(root, 'app.js'), 'module.exports = 2;\n');
  fs.writeFileSync(path.join(root, 'app.test.js'), 'assert.equal(value, 2);\n');
  return root;
}

function fakeClaudeChild(onStart) {
  const child = new EventEmitter();
  child.stdin = new PassThrough();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.kills = [];
  const processHandle = setInterval(() => {}, 60_000);
  const releaseProcessHandle = () => clearInterval(processHandle);
  child.cleanup = releaseProcessHandle;
  child.once('close', releaseProcessHandle);
  child.once('error', releaseProcessHandle);
  child.kill = (signal) => {
    child.kills.push(signal);
    if (signal === 'SIGKILL') releaseProcessHandle();
    return true;
  };
  if (onStart) setImmediate(() => onStart(child));
  return child;
}

function protocolHarness(review) {
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
  const lines = serve({ input, output, review });
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

test('MCP server negotiates, lists, and calls the Claude review tool', async (t) => {
  const cleanResult = {
    schema_version: 1,
    reviewer: 'claude_mcp',
    perspective: 'primary',
    repository_root: '/repo',
    fingerprint: 'a'.repeat(64),
    outcome: 'clean',
    summary: 'No findings.',
    findings: [],
    duration_ms: 1
  };
  const harness = protocolHarness(async () => cleanResult);
  t.after(() => harness.close());

  const initialized = await harness.request({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: { protocolVersion: '2025-11-25', capabilities: {} }
  });
  assert.equal(initialized.result.protocolVersion, '2025-11-25');
  assert.equal(initialized.result.serverInfo.name, 'sd0x-claude-review');

  const listed = await harness.request({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/list',
    params: {}
  });
  assert.equal(listed.result.tools.length, 1);
  assert.equal(listed.result.tools[0].name, 'review_worktree');
  assert.equal(listed.result.tools[0].annotations.readOnlyHint, true);
  assert.equal(listed.result.tools[0].inputSchema.properties.prior_findings.maxItems, 50);
  const findingRequired = listed.result.tools[0].outputSchema
    .properties.findings.items.required;
  assert.ok(findingRequired.includes('root_cause'));
  assert.ok(findingRequired.includes('regression_protection'));

  const called = await harness.request({
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: {
      name: 'review_worktree',
      arguments: { cwd: '/repo', fingerprint: 'a'.repeat(64) }
    }
  });
  assert.equal(called.result.isError, false);
  assert.equal(called.result.content[0].text, 'No actionable findings remain.');
  assert.deepEqual(called.result.structuredContent, cleanResult);
});

test('Claude CLI invocation is non-persistent and exposes only read tools', () => {
  const args = buildClaudeArgs({
    SD0X_CLAUDE_REVIEW_MODEL: 'sonnet',
    SD0X_CLAUDE_REVIEW_FALLBACK_MODEL: 'claude-opus-4-8',
    SD0X_CLAUDE_REVIEW_MAX_BUDGET_USD: '2.50'
  });
  assert.ok(args.includes('--safe-mode'));
  assert.ok(args.includes('--no-session-persistence'));
  assert.deepEqual(
    args.slice(args.indexOf('--permission-mode'), args.indexOf('--permission-mode') + 2),
    ['--permission-mode', 'dontAsk']
  );
  assert.equal(args[args.indexOf('--tools') + 1], 'Read,Glob,Grep');
  assert.match(args[args.indexOf('--disallowedTools') + 1], /Bash/);
  assert.equal(args[args.indexOf('--model') + 1], 'sonnet');
  assert.equal(args[args.indexOf('--fallback-model') + 1], 'claude-opus-4-8');
  assert.equal(args[args.indexOf('--max-budget-usd') + 1], '2.50');
  assert.equal(buildClaudeEnv({}).CLAUDE_CODE_MAX_TURNS, '20');
  assert.equal(buildClaudeEnv({
    SD0X_CLAUDE_REVIEW_MAX_TURNS: '7'
  }).CLAUDE_CODE_MAX_TURNS, '7');
});

test('Claude preflight flags are derived from the actual invocation contract', () => {
  const emitted = buildClaudeArgs({}).filter((value) => value.startsWith('--'));
  assert.deepEqual(CLAUDE_REQUIRED_FLAGS, [...new Set(emitted)]);
  assert.deepEqual(claudeRequiredFlags({}), CLAUDE_REQUIRED_FLAGS);
  assert.ok(claudeRequiredFlags({
    SD0X_CLAUDE_REVIEW_MAX_BUDGET_USD: '1.00'
  }).includes('--max-budget-usd'));
});

test('Claude review defaults to Opus 4.8 without an automatic fallback', () => {
  const args = buildClaudeArgs({});
  assert.equal(args[args.indexOf('--model') + 1], 'claude-opus-4-8');
  assert.equal(args.includes('--fallback-model'), false);
});

test('Claude prompt preserves the sd0x independent-review theory', () => {
  for (const concept of [
    'Inspect every changed file in full',
    'performance',
    'maintainability',
    'requirement traceability',
    'mock reasonableness',
    'all five',
    'intentional design',
    'adjacent gaps',
    'Never expose secrets'
  ]) {
    assert.match(REVIEW_SYSTEM_PROMPT, new RegExp(concept, 'i'));
  }
  assert.match(REVIEW_SYSTEM_PROMPT, /Use P0.*Use P1.*Use P2/s);
});

test('Claude retries with an explicitly configured Fable fallback', async () => {
  const attempts = [];
  const output = await executeClaude('/repo', 'review', {
    env: { SD0X_CLAUDE_REVIEW_FALLBACK_MODEL: 'claude-fable-5' },
    runAttempt: async (_root, _prompt, options) => {
      attempts.push([options.model, options.fallbackModel]);
      if (attempts.length === 1) throw new Error('Opus timed out');
      return { outcome: 'clean', summary: 'Clean.', findings: [] };
    }
  });
  assert.equal(output.outcome, 'clean');
  assert.deepEqual(attempts, [
    ['claude-opus-4-8', 'claude-fable-5'],
    ['claude-fable-5', 'claude-fable-5']
  ]);
});

test('Claude failure has no second attempt unless fallback is configured', async () => {
  const attempts = [];
  await assert.rejects(
    executeClaude('/repo', 'review', {
      env: {},
      runAttempt: async (_root, _prompt, options) => {
        attempts.push(options.model);
        throw new Error('review failed');
      }
    }),
    /review failed/
  );
  assert.deepEqual(attempts, ['claude-opus-4-8']);
});

test('MCP timeout accommodates two 15-minute model attempts', () => {
  const pluginRoot = path.resolve(__dirname, '..', 'plugin', 'sd0x-dev-flow-codex');
  const config = JSON.parse(fs.readFileSync(path.join(pluginRoot, '.mcp.json'), 'utf8'));
  const toolTimeoutMs = config.mcpServers.sd0x_claude_review.tool_timeout_sec * 1000;
  assert.equal(DEFAULT_TIMEOUT_MS, 15 * 60 * 1000);
  assert.ok(toolTimeoutMs > DEFAULT_TIMEOUT_MS * 2);
  assert.equal(claudeAttemptTimeoutMs({}, 20 * 60 * 1000), DEFAULT_TIMEOUT_MS);
  assert.equal(claudeAttemptTimeoutMs({
    SD0X_CLAUDE_REVIEW_TIMEOUT_MS: '2500'
  }), 2500);
});

test('Claude attempt enforces timeout and abort by terminating the child', async (t) => {
  const timedOutChild = fakeClaudeChild();
  t.after(() => timedOutChild.cleanup());
  await assert.rejects(
    executeClaudeAttempt('/repo', 'review', {
      env: {},
      timeoutMs: 5,
      terminationGraceMs: 5,
      spawnProcess: () => timedOutChild
    }),
    /timed out after 5ms/
  );
  await new Promise((resolve) => setTimeout(resolve, 15));
  assert.deepEqual(timedOutChild.kills, ['SIGTERM', 'SIGKILL']);

  const controller = new AbortController();
  const abortedChild = fakeClaudeChild();
  t.after(() => abortedChild.cleanup());
  const aborted = executeClaudeAttempt('/repo', 'review', {
    env: {},
    timeoutMs: 1000,
    terminationGraceMs: 5,
    signal: controller.signal,
    spawnProcess: () => abortedChild
  });
  controller.abort();
  await assert.rejects(aborted, (error) => error.code === 'ABORT_ERR');
  await new Promise((resolve) => setTimeout(resolve, 15));
  assert.deepEqual(abortedChild.kills, ['SIGTERM', 'SIGKILL']);
});

test('Claude attempt terminates the child when prompt delivery fails', async (t) => {
  const asynchronousChild = fakeClaudeChild((child) => {
    child.stdin.emit('error', new Error('broken pipe'));
  });
  t.after(() => asynchronousChild.cleanup());
  await assert.rejects(
    executeClaudeAttempt('/repo', 'review', {
      env: {},
      timeoutMs: 1000,
      terminationGraceMs: 5,
      spawnProcess: () => asynchronousChild
    }),
    /Unable to send the review prompt to Claude: broken pipe/
  );
  await new Promise((resolve) => setTimeout(resolve, 15));
  assert.deepEqual(asynchronousChild.kills, ['SIGTERM', 'SIGKILL']);

  const synchronousChild = fakeClaudeChild();
  t.after(() => synchronousChild.cleanup());
  synchronousChild.stdin.end = () => {
    throw new Error('write failed');
  };
  await assert.rejects(
    executeClaudeAttempt('/repo', 'review', {
      env: {},
      timeoutMs: 1000,
      terminationGraceMs: 5,
      spawnProcess: () => synchronousChild
    }),
    /Unable to send the review prompt to Claude: write failed/
  );
  await new Promise((resolve) => setTimeout(resolve, 15));
  assert.deepEqual(synchronousChild.kills, ['SIGTERM', 'SIGKILL']);
});

test('Claude attempt validates process output limits and structured envelopes', async (t) => {
  const structured = { outcome: 'clean', summary: 'Clean.', findings: [] };
  const success = await executeClaudeAttempt('/repo', 'review', {
    env: {},
    timeoutMs: 1000,
    spawnProcess: () => fakeClaudeChild((child) => {
      child.stdout.write(JSON.stringify({ structured_output: structured }));
      child.emit('close', 0, null);
    })
  });
  assert.deepEqual(success, structured);

  await assert.rejects(
    executeClaudeAttempt('/repo', 'review', {
      env: {},
      timeoutMs: 1000,
      spawnProcess: () => fakeClaudeChild((child) => {
        child.stdout.write('{}');
        child.emit('close', 0, null);
      })
    }),
    /Invalid Claude structured output/
  );

  const oversizedChild = fakeClaudeChild((child) => {
    child.stdout.write(Buffer.alloc(MAX_PROCESS_OUTPUT_BYTES + 1, 97));
    child.stdout.write('still running');
  });
  t.after(() => oversizedChild.cleanup());
  await assert.rejects(
    executeClaudeAttempt('/repo', 'review', {
      env: {},
      timeoutMs: 1000,
      terminationGraceMs: 5,
      spawnProcess: () => oversizedChild
    }),
    /output exceeded the safety limit/
  );
  await new Promise((resolve) => setTimeout(resolve, 15));
  assert.deepEqual(oversizedChild.kills, ['SIGTERM', 'SIGKILL']);

  await assert.rejects(
    executeClaudeAttempt('/repo', 'review', {
      env: {},
      timeoutMs: 1000,
      spawnProcess: () => fakeClaudeChild((child) => {
        child.stderr.write('model unavailable');
        child.emit('close', 2, null);
      })
    }),
    /exited with 2: model unavailable/
  );
});

test('Claude attempt preserves complex Windows arguments without a shell', async () => {
  let invocation;
  const structured = { outcome: 'clean', summary: 'Clean.', findings: [] };
  await executeClaudeAttempt('C:\\repo', 'review', {
    env: {},
    platform: 'win32',
    timeoutMs: 1000,
    resolveBinary: () => 'C:\\Program Files\\Claude\\claude.exe',
    spawnProcess: (binary, args, options) => {
      invocation = { binary, args, options };
      return fakeClaudeChild((child) => {
        child.stdout.write(JSON.stringify({ structured_output: structured }));
        child.emit('close', 0, null);
      });
    }
  });
  assert.equal(invocation.binary, 'C:\\Program Files\\Claude\\claude.exe');
  assert.equal(invocation.options.shell, false);
  assert.equal(
    invocation.args[invocation.args.indexOf('--system-prompt') + 1],
    REVIEW_SYSTEM_PROMPT
  );
  assert.deepEqual(
    JSON.parse(invocation.args[invocation.args.indexOf('--json-schema') + 1]),
    CLAUDE_OUTPUT_SCHEMA
  );
});

test('Windows Claude resolution accepts native executables and rejects shims', () => {
  const mixed = resolveClaudeExecutable('claude', {
    platform: 'win32',
    execute: () => ({
      status: 0,
      stdout: 'C:\\Tools\\claude.cmd\r\nC:\\Program Files\\Claude\\claude.exe\r\n'
    })
  });
  assert.equal(mixed, 'C:\\Program Files\\Claude\\claude.exe');
  assert.throws(() => resolveClaudeExecutable('claude', {
    platform: 'win32',
    execute: () => ({ status: 0, stdout: 'C:\\Tools\\claude.cmd\r\n' })
  }), /native Claude Code executable/);
  assert.throws(() => resolveClaudeExecutable('C:\\Tools\\claude.cmd', {
    platform: 'win32'
  }), /command shim/);
});

test('Claude preflight reports readiness without exposing account identity', () => {
  const calls = [];
  const execute = (_binary, args) => {
    calls.push(args);
    if (args[0] === '--version') {
      return { status: 0, stdout: '2.1.206 (Claude Code)\n', stderr: '' };
    }
    if (args[0] === '--help') {
      return {
        status: 0,
        stdout: CLAUDE_REQUIRED_FLAGS.join('\n'),
        stderr: ''
      };
    }
    return {
      status: 0,
      stdout: JSON.stringify({
        loggedIn: true,
        authMethod: 'claude.ai',
        apiProvider: 'firstParty',
        email: 'private@example.com',
        orgName: 'Private Org'
      }),
      stderr: ''
    };
  };
  const status = claudeCliStatus({}, execute);
  assert.equal(status.installed, true);
  assert.equal(status.compatible, true);
  assert.equal(status.authenticated, true);
  assert.equal(status.auth_method, 'claude.ai');
  assert.equal(JSON.stringify(status).includes('private@example.com'), false);
  assert.equal(JSON.stringify(status).includes('Private Org'), false);
  assert.deepEqual(calls, [
    ['--version'],
    ['--help'],
    ['auth', 'status', '--json']
  ]);
});

test('Claude preflight rejects a CLI missing required review flags', () => {
  const env = { SD0X_CLAUDE_REVIEW_FALLBACK_MODEL: 'claude-fable-5' };
  const required = claudeRequiredFlags(env);
  const execute = (_binary, args) => {
    if (args[0] === '--version') return { status: 0, stdout: 'old\n', stderr: '' };
    if (args[0] === '--help') {
      return {
        status: 0,
        stdout: required.filter((flag) => flag !== '--fallback-model').join('\n'),
        stderr: ''
      };
    }
    return { status: 0, stdout: '{"loggedIn":true}', stderr: '' };
  };
  const status = claudeCliStatus(env, execute);
  assert.equal(status.installed, true);
  assert.equal(status.compatible, false);
  assert.ok(status.missing_flags.includes('--fallback-model'));
  assert.equal(status.reason, 'missing-required-flags');
});

test('Claude preflight covers every unconditional invocation flag', () => {
  const missing = '--system-prompt';
  const execute = (_binary, args) => {
    if (args[0] === '--version') return { status: 0, stdout: 'current\n', stderr: '' };
    if (args[0] === '--help') {
      return {
        status: 0,
        stdout: CLAUDE_REQUIRED_FLAGS.filter((flag) => flag !== missing).join('\n'),
        stderr: ''
      };
    }
    return { status: 0, stdout: '{"loggedIn":true}', stderr: '' };
  };
  const status = claudeCliStatus({}, execute);
  assert.equal(status.compatible, false);
  assert.deepEqual(status.missing_flags, [missing]);
});

test('Claude preflight uses the resolved native Windows executable without a shell', () => {
  const observed = [];
  const execute = (binary, args, options) => {
    observed.push({ binary, shell: options.shell });
    if (args[0] === '--version') return { status: 0, stdout: 'current\n', stderr: '' };
    if (args[0] === '--help') {
      return { status: 0, stdout: CLAUDE_REQUIRED_FLAGS.join('\n'), stderr: '' };
    }
    return { status: 0, stdout: '{"loggedIn":true}', stderr: '' };
  };
  const status = claudeCliStatus({}, execute, 'win32', () => 'C:\\Claude\\claude.exe');
  assert.equal(status.compatible, true);
  assert.equal(status.resolved_binary, 'C:\\Claude\\claude.exe');
  assert.deepEqual(observed, [
    { binary: 'C:\\Claude\\claude.exe', shell: false },
    { binary: 'C:\\Claude\\claude.exe', shell: false },
    { binary: 'C:\\Claude\\claude.exe', shell: false }
  ]);
});

test('doctor MCP smoke test verifies initialize and review tool discovery', () => {
  const pluginRoot = path.resolve(__dirname, '..', 'plugin', 'sd0x-dev-flow-codex');
  const status = mcpServerStatus(pluginRoot);
  assert.equal(status.ready, true);
  assert.equal(status.server_name, 'sd0x-claude-review');
  assert.equal(status.tool, 'review_worktree');
});

test('doctor skips Claude checks for the default Codex provider', (t) => {
  const root = createRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const status = doctor(root, {
    claudeStatus: () => {
      throw new Error('Claude status must not run in Codex mode');
    },
    mcpStatus: () => {
      throw new Error('Claude MCP status must not run in Codex mode');
    }
  });
  assert.equal(status.review_provider, 'codex');
  assert.equal(status.claude.checked, false);
  assert.equal(status.mcp.checked, false);
  assert.equal(status.checks.some((check) => check.check === 'claude-cli'), false);
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

test('doctor requires Claude readiness only when the project opts in', (t) => {
  const root = createRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, '.codex'), { recursive: true });
  fs.writeFileSync(
    path.join(root, '.codex', 'sd0x-dev-flow.json'),
    JSON.stringify({
      schema_version: 1,
      enabled: true,
      review: { provider: 'claude' }
    })
  );
  const status = doctor(root, {
    claudeStatus: () => ({
      installed: false,
      compatible: false,
      authenticated: false
    }),
    mcpStatus: () => ({ ready: false })
  });
  assert.equal(status.review_provider, 'claude');
  assert.equal(status.ok, false);
  assert.equal(status.checks.find((check) => check.check === 'claude-cli').ok, false);
  assert.equal(
    status.checks.find((check) => check.check === 'claude-review-mcp-handshake').ok,
    false
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
    mcpStatus: () => ({ ready: true })
  };

  const skillArtifacts = [
    'scripts/runtime/collaboration.js',
    'skills/bug-fix/SKILL.md',
    'skills/create-request/SKILL.md',
    'skills/create-request/references/request-format.md',
    'skills/create-request/scripts/request-tool.js',
    'skills/doctor/SKILL.md',
    'skills/doctor/scripts/doctor.js',
    'skills/feature-dev/SKILL.md',
    'skills/remind/SKILL.md',
    'skills/remind/scripts/status.js',
    'skills/reset/SKILL.md',
    'skills/reset/scripts/reset.js',
    'skills/review/SKILL.md',
    'skills/review/references/review-theory.md',
    'skills/review/scripts/gate.js',
    'skills/review/scripts/provider.js',
    'skills/review/scripts/round.js',
    'skills/review/scripts/snapshot.js',
    'skills/setup/SKILL.md',
    'skills/setup/scripts/setup.js',
    'skills/verify/SKILL.md',
    'skills/verify/scripts/verify.js',
    'templates/agents/sd0x-claude-primary-reviewer.toml',
    'templates/agents/sd0x-codex-primary-reviewer.toml',
    'templates/agents/sd0x-reviewer.toml',
    'templates/agents/sd0x-test-reviewer.toml'
  ];

  for (const relative of skillArtifacts) {
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
});

test('MCP cancellation aborts the active Claude review request', async (t) => {
  let started;
  const reviewStarted = new Promise((resolve) => { started = resolve; });
  const harness = protocolHarness((_input, options) => new Promise((_resolve, reject) => {
    started();
    options.signal.addEventListener('abort', () => {
      const error = new Error('Claude review cancelled');
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
      name: 'review_worktree',
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

test('closing the MCP transport aborts active Claude work', async () => {
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
      name: 'review_worktree',
      arguments: { cwd: '/repo', fingerprint: 'a'.repeat(64) }
    }
  });
  await reviewStarted;
  harness.close();
  await reviewAborted;
  await assert.rejects(responsePromise, /transport closed/);
});

test('review binds Claude output to the exact fingerprint and changed files', async (t) => {
  const root = createRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const worktree = snapshot(root);
  let observedPrompt = '';
  const result = await reviewWorktree({
    cwd: root,
    fingerprint: worktree.fingerprint,
    prior_findings: [{
      severity: 'P1',
      file: 'app.test.js',
      line: 1,
      title: 'Prior test execution gap'
    }]
  }, {
    invokeClaude: async (_root, prompt) => {
      observedPrompt = prompt;
      return {
        outcome: 'findings',
        summary: 'A regression remains.',
        findings: [{
          severity: 'P1',
          category: 'tests',
          file: 'app.test.js',
          line: 1,
          title: 'Test cannot execute',
          evidence: 'The new file references undefined identifiers.',
          root_cause: 'The test was added without importing or constructing its subject.',
          recommendation: 'Import the subject and test it through the repository runner.',
          regression_protection: 'Run the repository test command in verification.'
        }]
      };
    }
  });
  assert.equal(result.fingerprint, worktree.fingerprint);
  assert.equal(result.findings[0].file, 'app.test.js');
  assert.match(observedPrompt, /app\.js/);
  assert.match(observedPrompt, /app\.test\.js/);
  assert.match(observedPrompt, /Prior test execution gap/);
  assert.match(observedPrompt, /untrusted repository data/);
});

test('review accepts a finding in unchanged surrounding repository code', async (t) => {
  const root = createRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const worktree = snapshot(root);
  const result = await reviewWorktree({ cwd: root, fingerprint: worktree.fingerprint }, {
    invokeClaude: async () => ({
      outcome: 'findings',
      summary: 'The changed caller exposes a helper defect.',
      findings: [{
        severity: 'P1',
        category: 'implementation',
        file: 'helper.js',
        line: 1,
        title: 'Changed caller exposes incompatible helper behavior',
        evidence: 'The helper is tracked surrounding code and the changed caller now reaches it.',
        root_cause: 'The unchanged helper contract is incompatible with the new call path.',
        recommendation: 'Make the helper contract compatible with the new caller.',
        regression_protection: 'Add a test that exercises the changed caller through the helper.'
      }]
    })
  });
  assert.equal(result.findings[0].file, 'helper.js');
});

test('review rejects prior finding identities that escape the repository', async (t) => {
  const root = createRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const worktree = snapshot(root);
  for (const file of ['../outside.js', '..']) {
    await assert.rejects(
      reviewWorktree({
        cwd: root,
        fingerprint: worktree.fingerprint,
        prior_findings: [{
          severity: 'P1',
          file,
          line: 1,
          title: 'Untrusted prior path'
        }]
      }, {
        invokeClaude: async () => ({ outcome: 'clean', summary: 'Clean.', findings: [] })
      }),
      /prior finding path escapes/
    );
  }
});

test('review rejects a bare parent-directory finding path', async (t) => {
  const root = createRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const worktree = snapshot(root);
  await assert.rejects(
    reviewWorktree({ cwd: root, fingerprint: worktree.fingerprint }, {
      invokeClaude: async () => ({
        outcome: 'findings',
        summary: 'Invalid parent finding.',
        findings: [{
          severity: 'P2',
          category: 'implementation',
          file: '..',
          line: 1,
          title: 'Out-of-root finding',
          evidence: 'The path points outside the repository.',
          root_cause: 'The path is untrusted model output.',
          recommendation: 'Reject it.',
          regression_protection: 'Keep this boundary test.'
        }]
      })
    }),
    /finding path escapes the repository/
  );
});

test('review bundle fails closed for oversized diffs and omitted changed files', async (t) => {
  const root = createRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const worktree = snapshot(root);
  let invoked = false;

  await assert.rejects(
    reviewWorktree({ cwd: root, fingerprint: worktree.fingerprint }, {
      maxBundleBytes: 8,
      invokeClaude: async () => {
        invoked = true;
        return { outcome: 'clean', summary: 'Clean.', findings: [] };
      }
    }),
    /diff exceeds the configured bundle limit/
  );

  const bundle = collectReviewBundle(worktree, {
    maxBundleBytes: 1024 * 1024,
    maxUntrackedFileBytes: 5
  });
  assert.equal(
    bundle.untracked_files.find((entry) => entry.path === 'app.test.js').omitted_reason,
    'file-too-large'
  );
  await assert.rejects(
    reviewWorktree({ cwd: root, fingerprint: worktree.fingerprint }, {
      maxBundleBytes: 1024 * 1024,
      maxUntrackedFileBytes: 5,
      invokeClaude: async () => {
        invoked = true;
        return { outcome: 'clean', summary: 'Clean.', findings: [] };
      }
    }),
    /omitted changed content/
  );
  assert.equal(invoked, false);
});

test('review rejects stale input and a worktree that changes during Claude review', async (t) => {
  const root = createRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const original = snapshot(root);

  await assert.rejects(
    reviewWorktree({ cwd: root, fingerprint: 'b'.repeat(64) }, {
      invokeClaude: async () => ({ outcome: 'clean', summary: 'Clean.', findings: [] })
    }),
    /stale/
  );

  await assert.rejects(
    reviewWorktree({ cwd: root, fingerprint: original.fingerprint }, {
      invokeClaude: async () => {
        fs.writeFileSync(path.join(root, 'app.js'), 'module.exports = 3;\n');
        return { outcome: 'clean', summary: 'Clean.', findings: [] };
      }
    }),
    /changed while Claude was reviewing/
  );
});

test('review refuses protected changed paths before invoking Claude', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-claude-protected-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  initRepository(root);
  fs.writeFileSync(path.join(root, '.env'), 'TOKEN=old\n');
  git(root, ['add', '-f', '.env']);
  commit(root, 'baseline');
  fs.writeFileSync(path.join(root, '.env'), 'TOKEN=new\n');
  const worktree = snapshot(root);
  let invoked = false;

  await assert.rejects(
    reviewWorktree({ cwd: root, fingerprint: worktree.fingerprint }, {
      invokeClaude: async () => {
        invoked = true;
        return { outcome: 'clean', summary: 'Clean.', findings: [] };
      }
    }),
    /protected changed paths/
  );
  assert.equal(invoked, false);
});

test('review refuses a staged rename from a protected source path', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-claude-protected-rename-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  initRepository(root);
  const secrets = Array.from({ length: 24 }, (_, index) =>
    `TOKEN_${index}=secret-${index}`
  );
  fs.writeFileSync(path.join(root, '.env'), `${secrets.join('\n')}\n`);
  git(root, ['add', '-f', '.env']);
  commit(root, 'baseline');
  git(root, ['mv', '.env', 'settings.txt']);
  secrets[12] = 'TOKEN_12=changed-secret';
  fs.writeFileSync(path.join(root, 'settings.txt'), `${secrets.join('\n')}\n`);
  git(root, ['add', 'settings.txt']);
  const worktree = snapshot(root);
  let invoked = false;

  assert.deepEqual(worktree.files, ['.env', 'settings.txt']);
  await assert.rejects(
    reviewWorktree({ cwd: root, fingerprint: worktree.fingerprint }, {
      invokeClaude: async () => {
        invoked = true;
        return { outcome: 'clean', summary: 'Clean.', findings: [] };
      }
    }),
    /protected changed paths/
  );
  assert.equal(invoked, false);
});

test('review fails closed for changed nested repositories', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-claude-nested-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  initRepository(root);
  fs.writeFileSync(path.join(root, 'base.js'), 'module.exports = 1;\n');
  git(root, ['add', '.']);
  commit(root, 'baseline');
  const nested = path.join(root, 'nested');
  fs.mkdirSync(nested);
  initRepository(nested);
  fs.writeFileSync(path.join(nested, 'app.js'), 'module.exports = 2;\n');
  git(nested, ['add', '.']);
  commit(nested, 'nested baseline');
  fs.writeFileSync(path.join(nested, 'app.js'), 'module.exports = 3;\n');
  const worktree = snapshot(root);
  let invoked = false;

  await assert.rejects(
    reviewWorktree({ cwd: root, fingerprint: worktree.fingerprint }, {
      invokeClaude: async () => {
        invoked = true;
        return { outcome: 'clean', summary: 'Clean.', findings: [] };
      }
    }),
    /nested repositories or submodules/
  );
  assert.equal(invoked, false);
});

test('review refuses tracked binary changes before invoking Claude', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-claude-binary-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  initRepository(root);
  fs.writeFileSync(path.join(root, 'asset.bin'), Buffer.from([0, 1, 2, 3]));
  git(root, ['add', '.']);
  commit(root, 'binary baseline');
  fs.writeFileSync(path.join(root, 'asset.bin'), Buffer.from([0, 9, 8, 7]));
  const worktree = snapshot(root);
  let invoked = false;

  await assert.rejects(
    reviewWorktree({ cwd: root, fingerprint: worktree.fingerprint }, {
      invokeClaude: async () => {
        invoked = true;
        return { outcome: 'clean', summary: 'Clean.', findings: [] };
      }
    }),
    /tracked binary changes: asset\.bin/
  );
  assert.equal(invoked, false);
});

test('review bundle includes staged content hidden by a reverted worktree file', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-claude-index-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  initRepository(root);
  fs.writeFileSync(path.join(root, 'app.js'), 'module.exports = 1;\n');
  git(root, ['add', '.']);
  commit(root, 'baseline');
  fs.writeFileSync(path.join(root, 'app.js'), 'module.exports = 99;\n');
  git(root, ['add', 'app.js']);
  fs.writeFileSync(path.join(root, 'app.js'), 'module.exports = 1;\n');
  const worktree = snapshot(root);
  let prompt = '';

  await reviewWorktree({ cwd: root, fingerprint: worktree.fingerprint }, {
    invokeClaude: async (_reviewRoot, value) => {
      prompt = value;
      return { outcome: 'clean', summary: 'Clean.', findings: [] };
    }
  });
  assert.match(prompt, /SD0X_INDEX_DIFF_HEAD_TO_INDEX/);
  assert.match(prompt, /module\.exports = 99/);
});
