'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const {
  clearSessionActivationFailure,
  hasSetupDeferral,
  hasSessionActivationFailure,
  markGate,
  markSetupDeferral,
  markSessionActivationFailure,
  readState,
  refreshState,
  resetState,
  resolveStatePath
} = require('../plugin/sd0x-dev-flow-codex/scripts/runtime/state');
const {
  commit,
  git,
  initRepository,
  isolateGitEnvironment
} = require('./helpers/git');

isolateGitEnvironment();

const HOOK = path.resolve(
  __dirname,
  '..',
  'plugin',
  'sd0x-dev-flow-codex',
  'scripts',
  'runtime',
  'hook.js'
);

test('hook definition observes the exec command that completes setup', () => {
  const hooks = JSON.parse(fs.readFileSync(path.resolve(
    __dirname,
    '..',
    'plugin',
    'sd0x-dev-flow-codex',
    'hooks',
    'hooks.json'
  ), 'utf8')).hooks;
  assert.ok(hooks.PostToolUse.some((entry) => entry.matcher === '^exec_command$'));
  assert.ok(hooks.PreToolUse.some((entry) =>
    entry.matcher === '^mcp__sd0x_claude_review__review_worktree$'
  ));
  assert.ok(hooks.SubagentStart.some((entry) =>
    entry.matcher.includes('sd0x_codex_primary_reviewer') &&
    entry.matcher.includes('sd0x_claude_primary_reviewer')
  ));
});

function createRepo(options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-hook-'));
  initRepository(root);
  fs.writeFileSync(path.join(root, 'app.js'), 'const value = 1;\n');
  fs.mkdirSync(path.join(root, '.codex'), { recursive: true });
  fs.writeFileSync(path.join(root, '.codex', 'sd0x-dev-flow.json'), JSON.stringify({
    schema_version: 1,
    enabled: true,
    review: { provider: options.provider || 'codex' }
  }));
  git(root, ['add', '.']);
  commit(root, 'baseline');
  if (options.activate !== false) {
    invoke(root, { hook_event_name: 'SessionStart' });
  }
  return root;
}

test('hooks are inert until the repository opts in', (t) => {
  const root = createRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, '.codex', 'sd0x-dev-flow.json'), JSON.stringify({
    schema_version: 1,
    enabled: false
  }));
  fs.writeFileSync(path.join(root, 'app.js'), 'const value = 2;\n');
  const result = invoke(root, { hook_event_name: 'Stop' });
  assert.deepEqual(JSON.parse(result.stdout), { continue: true });
});

test('invalid review provider fails closed instead of disabling the workflow', (t) => {
  const root = createRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, '.codex', 'sd0x-dev-flow.json'), JSON.stringify({
    schema_version: 1,
    enabled: true,
    review: { provider: 'invalid' }
  }));
  fs.writeFileSync(path.join(root, 'app.js'), 'const value = 2;\n');
  const result = invoke(root, { hook_event_name: 'Stop' });
  assert.match(result.stderr, /review\.provider/);
  assert.equal(JSON.parse(result.stdout).decision, 'block');
});

function invoke(root, input, environment = {}) {
  return spawnSync(process.execPath, [HOOK], {
    cwd: root,
    input: JSON.stringify({ cwd: root, session_id: 'session-1', ...input }),
    encoding: 'utf8',
    env: { ...process.env, ...environment }
});
}

test('setup deferral is claimed and consumed only by the setup session', (t) => {
  const root = createRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const claimToken = markSetupDeferral(root);
  fs.writeFileSync(path.join(root, 'app.js'), 'const value = 2;\n');

  const unrelatedCommand = invoke(root, {
    hook_event_name: 'PostToolUse',
    tool_name: 'exec_command',
    tool_response: {
      exit_code: 0,
      output: JSON.stringify({
        root,
        activation_deferred: true,
        setup_claim: {
          schema_version: 1,
          token: '00000000-0000-4000-8000-000000000000',
          root
        }
      })
    },
    session_id: 'unrelated-session'
  });
  assert.equal(unrelatedCommand.stdout, '');
  assert.equal(hasSetupDeferral(root, 'unrelated-session'), false);
  assert.equal(hasSetupDeferral(root), true);

  const unrelatedBeforeClaim = JSON.parse(invoke(root, {
    hook_event_name: 'Stop',
    session_id: 'unrelated-session'
  }).stdout);
  assert.equal(unrelatedBeforeClaim.decision, 'block');
  assert.equal(hasSetupDeferral(root), true);

  const setupResult = JSON.parse(invoke(root, {
    hook_event_name: 'PostToolUse',
    tool_name: 'exec_command',
    tool_response: {
      exit_code: 0,
      output: JSON.stringify({
        root,
        activation_deferred: true,
        setup_claim: { schema_version: 1, token: claimToken, root }
      })
    },
    session_id: 'new-session'
  }).stdout);
  assert.match(
    setupResult.hookSpecificOutput.additionalContext,
    /setup was completed in this session/
  );
  assert.equal(hasSetupDeferral(root, 'new-session'), true);

  const unrelatedAfterClaim = JSON.parse(invoke(root, {
    hook_event_name: 'Stop',
    session_id: 'unrelated-session'
  }).stdout);
  assert.equal(unrelatedAfterClaim.decision, 'block');
  assert.equal(hasSetupDeferral(root, 'new-session'), true);

  const result = invoke(root, {
    hook_event_name: 'Stop',
    session_id: 'new-session'
  });
  const output = JSON.parse(result.stdout);
  assert.equal(output.continue, true);
  assert.match(output.systemMessage, /new Codex task/);
  assert.equal(hasSetupDeferral(root), false);

  const second = JSON.parse(invoke(root, {
    hook_event_name: 'Stop',
    session_id: 'new-session'
  }).stdout);
  assert.equal(second.decision, 'block');
});

test('setup deferral never bypasses an already activated session', (t) => {
  const root = createRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  markSetupDeferral(root);
  fs.writeFileSync(path.join(root, 'app.js'), 'const value = 2;\n');

  const output = JSON.parse(invoke(root, {
    hook_event_name: 'Stop',
    session_id: 'session-1'
  }).stdout);
  assert.equal(output.decision, 'block');
  assert.match(output.reason, /review/i);
  assert.equal(hasSetupDeferral(root), true);

  invoke(root, { hook_event_name: 'SessionStart', session_id: 'next-session' });
  assert.equal(hasSetupDeferral(root), false);
});

test('inactive enabled sessions without setup deferral fail closed', (t) => {
  const root = createRepo({ activate: false });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'app.js'), 'const value = 2;\n');

  const stop = invoke(root, { hook_event_name: 'Stop' });
  const output = JSON.parse(stop.stdout);
  assert.equal(output.decision, 'block');
  assert.match(output.reason, /no successful SessionStart activation/);
});

test('recovered Stop fails closed even if activation marker is unavailable', (t) => {
  const root = createRepo({ activate: false });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const invalidParent = path.join(root, 'not-a-directory');
  fs.writeFileSync(invalidParent, 'block state writes\n');

  const start = invoke(root, { hook_event_name: 'SessionStart' }, {
    SD0X_STATE_PATH: path.join(invalidParent, 'runtime-state.json')
  });
  assert.match(start.stderr, /sd0x hook warning/);
  assert.equal(hasSessionActivationFailure(root, 'session-1'), true);
  clearSessionActivationFailure(root, 'session-1');

  fs.writeFileSync(path.join(root, 'app.js'), 'const value = 2;\n');
  const stop = invoke(root, { hook_event_name: 'Stop' });
  const output = JSON.parse(stop.stdout);
  assert.equal(output.decision, 'block');
  assert.match(output.reason, /no successful SessionStart activation/);
});

test('failed SessionStart activation recovers and keeps dirty Stop fail-closed', (t) => {
  const root = createRepo({ activate: false });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const lockPath = `${resolveStatePath(root)}.lock`;
  fs.mkdirSync(lockPath, { recursive: true });
  fs.writeFileSync(path.join(lockPath, 'owner'), String(process.pid));

  const start = invoke(root, { hook_event_name: 'SessionStart' });
  assert.equal(start.status, 0);
  assert.match(start.stderr, /Timed out waiting/);
  assert.match(
    JSON.parse(start.stdout).hookSpecificOutput.additionalContext,
    /activation failed/
  );
  assert.equal(hasSessionActivationFailure(root, 'session-1'), true);

  fs.rmSync(lockPath, { recursive: true, force: true });
  fs.writeFileSync(path.join(root, 'app.js'), 'const value = 2;\n');
  const stop = invoke(root, {
    hook_event_name: 'Stop',
    stop_hook_active: false
  });
  assert.equal(stop.status, 0);
  const output = JSON.parse(stop.stdout);
  assert.equal(output.decision, 'block');
  assert.match(output.reason, /review/i);
  assert.equal(hasSessionActivationFailure(root, 'session-1'), false);
  assert.equal(
    readState(root).sessions.some((entry) => entry.session_id === 'session-1'),
    true
  );
});

test('successful SessionStart clears a prior activation failure marker', (t) => {
  const root = createRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  markSessionActivationFailure(root, 'session-1');
  markSetupDeferral(root);
  assert.equal(hasSessionActivationFailure(root, 'session-1'), true);
  assert.equal(hasSetupDeferral(root), true);

  const start = invoke(root, { hook_event_name: 'SessionStart' });
  assert.equal(start.status, 0);
  assert.equal(hasSessionActivationFailure(root, 'session-1'), false);
  assert.equal(hasSetupDeferral(root), false);
});

test('PreToolUse denies protected apply_patch targets', (t) => {
  const root = createRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const result = invoke(root, {
    hook_event_name: 'PreToolUse',
    tool_name: 'apply_patch',
    tool_input: { command: '*** Begin Patch\n*** Add File: .env\n+x\n*** End Patch' }
  });
  assert.equal(result.status, 0);
  const output = JSON.parse(result.stdout);
  assert.equal(output.hookSpecificOutput.permissionDecision, 'deny');
  assert.match(output.hookSpecificOutput.permissionDecisionReason, /\.env/);
});

test('PreToolUse protects paths before session activation and during setup deferral', (t) => {
  const root = createRepo({ activate: false });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const input = {
    hook_event_name: 'PreToolUse',
    session_id: 'inactive-session',
    tool_name: 'apply_patch',
    tool_input: { command: '*** Begin Patch\n*** Add File: .env\n+x\n*** End Patch' }
  };
  const inactive = JSON.parse(invoke(root, input).stdout);
  assert.equal(inactive.hookSpecificOutput.permissionDecision, 'deny');

  markSetupDeferral(root);
  const deferred = JSON.parse(invoke(root, input).stdout);
  assert.equal(deferred.hookSpecificOutput.permissionDecision, 'deny');
});

test('inactive sessions cannot register or consume Claude review ledger entries', (t) => {
  const root = createRepo({ activate: false });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'app.js'), 'const value = 2;\n');
  const current = refreshState(root);
  const fingerprint = current.worktree.fingerprint;
  const toolUseId = 'inactive-claude-review';

  invoke(root, {
    hook_event_name: 'PreToolUse',
    session_id: 'inactive-session',
    tool_name: 'mcp__sd0x_claude_review__review_worktree',
    tool_use_id: toolUseId,
    tool_input: { cwd: root, fingerprint }
  });
  invoke(root, {
    hook_event_name: 'PostToolUse',
    session_id: 'inactive-session',
    tool_name: 'mcp__sd0x_claude_review__review_worktree',
    tool_use_id: toolUseId,
    tool_input: { cwd: root, fingerprint },
    tool_response: {
      structuredContent: {
        schema_version: 1,
        reviewer: 'claude_mcp',
        perspective: 'primary',
        repository_root: root,
        fingerprint,
        outcome: 'clean',
        summary: 'No findings.',
        findings: [],
        duration_ms: 1
      },
      isError: false
    }
  });

  const state = readState(root);
  assert.deepEqual(state.external_review.started, []);
  assert.deepEqual(state.external_review.completed, []);
});

test('Stop requests review for a dirty worktree', (t) => {
  const root = createRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'app.js'), 'const value = 2;\n');
  const result = invoke(root, {
    hook_event_name: 'Stop',
    session_id: 'session-1',
    stop_hook_active: false
  });
  assert.equal(result.status, 0);
  const output = JSON.parse(result.stdout);
  assert.equal(output.decision, 'block');
  assert.match(output.reason, /review/i);
});

test('Stop keeps the review loop active without a continuation ceiling', (t) => {
  const root = createRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'app.js'), 'const value = 2;\n');

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const output = JSON.parse(invoke(root, {
      hook_event_name: 'Stop',
      stop_hook_active: false
    }).stdout);
    assert.equal(output.decision, 'block');
    assert.match(output.reason, /review/i);
  }
});

test('Stop fails closed when runtime state cannot be locked', (t) => {
  const root = createRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'app.js'), 'const value = 2;\n');
  const lockPath = `${resolveStatePath(root)}.lock`;
  fs.mkdirSync(lockPath, { recursive: true });
  fs.writeFileSync(path.join(lockPath, 'owner'), String(process.pid));

  const result = invoke(root, {
    hook_event_name: 'Stop',
    stop_hook_active: false
  });
  assert.equal(result.status, 0);
  assert.match(result.stderr, /Timed out waiting/);
  const output = JSON.parse(result.stdout);
  assert.equal(output.decision, 'block');
  assert.match(output.reason, /doctor/);
});

test('multiple activated sessions retain hook enforcement', (t) => {
  const root = createRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  invoke(root, {
    hook_event_name: 'SessionStart',
    session_id: 'session-2'
  });
  fs.writeFileSync(path.join(root, 'app.js'), 'const value = 2;\n');

  for (const sessionId of ['session-1', 'session-2']) {
    const result = invoke(root, {
      hook_event_name: 'Stop',
      session_id: sessionId,
      stop_hook_active: false
    });
    assert.equal(JSON.parse(result.stdout).decision, 'block');
  }
});

test('Subagent hooks record completion and return valid event JSON', (t) => {
  const root = createRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'app.js'), 'const value = 2;\n');
  const start = invoke(root, {
    hook_event_name: 'SubagentStart',
    agent_id: 'agent-1',
    agent_type: 'sd0x_reviewer'
  });
  assert.match(JSON.parse(start.stdout).hookSpecificOutput.additionalContext, /read-only/);
  const stop = invoke(root, {
    hook_event_name: 'SubagentStop',
    agent_id: 'agent-1',
    agent_type: 'sd0x_reviewer'
  });
  assert.equal(JSON.parse(stop.stdout).decision, 'block');
  assert.equal(readState(root).review_agents.completed.length, 0);

  const completed = invoke(root, {
    hook_event_name: 'SubagentStop',
    agent_id: 'agent-1',
    agent_type: 'sd0x_reviewer',
    stop_hook_active: true,
    last_assistant_message: 'No actionable findings remain.'
  });
  assert.deepEqual(JSON.parse(completed.stdout), { continue: true });
  assert.match(
    readState(root).review_agents.completed[0].result_sha256,
    /^[a-f0-9]{64}$/
  );
});

test('reviewer failures provide finding-or-reset remediation', (t) => {
  const root = createRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'app.js'), 'const value = 2;\n');
  invoke(root, {
    hook_event_name: 'SubagentStart',
    agent_id: 'failed-reviewer',
    agent_type: 'sd0x_reviewer'
  });
  invoke(root, {
    hook_event_name: 'SubagentStop',
    agent_id: 'failed-reviewer',
    agent_type: 'sd0x_reviewer',
    last_assistant_message: 'Reviewer process failed before producing a verdict.'
  });

  const stop = invoke(root, {
    hook_event_name: 'Stop',
    stop_hook_active: false
  });
  const reason = JSON.parse(stop.stdout).reason;
  assert.match(reason, /fix actionable findings/i);
  assert.match(reason, /reviewer failed or its ledger is stale/i);
  assert.match(reason, /ask the user[^\n]+reset/i);
});

test('Stop yields to the user when reviewer infrastructure is unavailable', (t) => {
  const root = createRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'app.js'), 'const value = 2;\n');
  refreshState(root);
  invoke(root, {
    hook_event_name: 'SubagentStart',
    agent_id: 'stale-primary',
    agent_type: 'sd0x_codex_primary_reviewer'
  });
  markGate(root, 'review', 'fail', {
    provider: 'codex',
    reviewers: 3,
    agents: [
      'sd0x_codex_primary_reviewer',
      'sd0x_reviewer',
      'sd0x_test_reviewer'
    ],
    findings: 0,
    reviewer_failure: true,
    summary: 'custom reviewer identities were unavailable'
  });

  const stop = invoke(root, {
    hook_event_name: 'Stop',
    stop_hook_active: false
  });
  const output = JSON.parse(stop.stdout);
  assert.equal(output.continue, true);
  assert.match(output.systemMessage, /reviewer infrastructure is unavailable/i);
  assert.match(output.systemMessage, /ask the user[^\n]+reset/i);
  assert.doesNotMatch(output.systemMessage, /or start a new Codex task/i);
  assert.match(output.systemMessage, /same fingerprint/i);
  const state = readState(root);
  assert.equal(state.gates.review.status, 'fail');
  assert.equal(state.review_agents.started.length, 1);
});

test('PostToolUse records successful structured Claude MCP evidence', (t) => {
  const root = createRepo({ provider: 'claude' });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'app.js'), 'const value = 2;\n');
  const current = refreshState(root);
  const fingerprint = current.worktree.fingerprint;
  const started = invoke(root, {
    hook_event_name: 'PreToolUse',
    tool_name: 'mcp__sd0x_claude_review__review_worktree',
    tool_use_id: 'claude-call-1',
    tool_input: { cwd: root, fingerprint }
  });
  assert.match(started.stdout, /Bound Claude review start/);
  const result = invoke(root, {
    hook_event_name: 'PostToolUse',
    tool_name: 'mcp__sd0x_claude_review__review_worktree',
    tool_use_id: 'claude-call-1',
    tool_input: { cwd: root, fingerprint },
    tool_response: {
      content: [{ type: 'text', text: 'No actionable findings remain.' }],
      structuredContent: {
        schema_version: 1,
        reviewer: 'claude_mcp',
        perspective: 'primary',
        repository_root: root,
        fingerprint,
        outcome: 'clean',
        summary: 'No findings.',
        findings: [],
        duration_ms: 5
      },
      isError: false
    }
  });
  assert.equal(result.status, 0);
  assert.match(
    JSON.parse(result.stdout).hookSpecificOutput.additionalContext,
    /Recorded Claude MCP clean evidence/
  );
  const state = readState(root);
  assert.equal(state.external_review.fingerprint, fingerprint);
  assert.equal(state.external_review.completed[0].tool_use_id, 'claude-call-1');
  assert.equal(state.external_review.completed[0].outcome, 'clean');
});

test('Codex review provider blocks Claude before any external review starts', (t) => {
  const root = createRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'app.js'), 'const value = 2;\n');
  const fingerprint = refreshState(root).worktree.fingerprint;
  const result = invoke(root, {
    hook_event_name: 'PreToolUse',
    tool_name: 'mcp__sd0x_claude_review__review_worktree',
    tool_use_id: 'blocked-claude-call',
    tool_input: { cwd: root, fingerprint }
  });
  const output = JSON.parse(result.stdout);
  assert.equal(output.hookSpecificOutput.permissionDecision, 'deny');
  assert.match(output.hookSpecificOutput.permissionDecisionReason, /disabled/);
  assert.deepEqual(readState(root).external_review.started, []);
});

test('reset rejects a late Claude result from another session runtime epoch', (t) => {
  const root = createRepo({ provider: 'claude' });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  invoke(root, { hook_event_name: 'SessionStart', session_id: 'session-2' });
  fs.writeFileSync(path.join(root, 'app.js'), 'const value = 2;\n');
  const beforeReset = refreshState(root);
  const fingerprint = beforeReset.worktree.fingerprint;
  invoke(root, {
    hook_event_name: 'PreToolUse',
    session_id: 'session-2',
    tool_name: 'mcp__sd0x_claude_review__review_worktree',
    tool_use_id: 'claude-before-reset',
    tool_input: { cwd: root, fingerprint }
  });
  const afterReset = resetState(root);
  assert.notEqual(afterReset.runtime_epoch, beforeReset.runtime_epoch);

  const reviewResult = (durationMs) => ({
    schema_version: 1,
    reviewer: 'claude_mcp',
    perspective: 'primary',
    repository_root: root,
    fingerprint,
    outcome: 'clean',
    summary: 'No findings.',
    findings: [],
    duration_ms: durationMs
  });
  const late = invoke(root, {
    hook_event_name: 'PostToolUse',
    session_id: 'session-2',
    tool_name: 'mcp__sd0x_claude_review__review_worktree',
    tool_use_id: 'claude-before-reset',
    tool_input: { cwd: root, fingerprint },
    tool_response: {
      structuredContent: reviewResult(60_000),
      isError: false
    }
  });
  assert.match(late.stderr, /no matching start in the current runtime epoch/);
  assert.deepEqual(readState(root).external_review.completed, []);

  invoke(root, {
    hook_event_name: 'PreToolUse',
    session_id: 'session-2',
    tool_name: 'mcp__sd0x_claude_review__review_worktree',
    tool_use_id: 'claude-after-reset',
    tool_input: { cwd: root, fingerprint }
  });
  const current = invoke(root, {
    hook_event_name: 'PostToolUse',
    session_id: 'session-2',
    tool_name: 'mcp__sd0x_claude_review__review_worktree',
    tool_use_id: 'claude-after-reset',
    tool_input: { cwd: root, fingerprint },
    tool_response: {
      structuredContent: reviewResult(0),
      isError: false
    }
  });
  assert.match(current.stdout, /Recorded Claude MCP clean evidence/);
  assert.equal(
    readState(root).external_review.completed[0].tool_use_id,
    'claude-after-reset'
  );
});

test('failed or malformed Claude MCP output records no evidence', (t) => {
  const root = createRepo({ provider: 'claude' });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'app.js'), 'const value = 2;\n');
  const fingerprint = refreshState(root).worktree.fingerprint;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const toolUseId = `claude-call-failed-${attempt}`;
    invoke(root, {
      hook_event_name: 'PreToolUse',
      tool_name: 'mcp__sd0x_claude_review__review_worktree',
      tool_use_id: toolUseId,
      tool_input: { cwd: root, fingerprint }
    });
    const failed = invoke(root, {
      hook_event_name: 'PostToolUse',
      tool_name: 'mcp__sd0x_claude_review__review_worktree',
      tool_use_id: toolUseId,
      tool_input: { cwd: root, fingerprint },
      tool_response: {
        content: [{ type: 'text', text: 'Claude review failed: unavailable' }],
        isError: true
      }
    });
    assert.match(
      JSON.parse(failed.stdout).hookSpecificOutput.additionalContext,
      /No review evidence was recorded/
    );
  }
  assert.equal(readState(root).external_review.completed.length, 0);
  assert.equal(readState(root).external_review.started.length, 0);
  const malformedId = 'claude-call-malformed';
  invoke(root, {
    hook_event_name: 'PreToolUse',
    tool_name: 'mcp__sd0x_claude_review__review_worktree',
    tool_use_id: malformedId,
    tool_input: { cwd: root, fingerprint }
  });
  const malformed = invoke(root, {
    hook_event_name: 'PostToolUse',
    tool_name: 'mcp__sd0x_claude_review__review_worktree',
    tool_use_id: malformedId,
    tool_input: { cwd: root, fingerprint },
    tool_response: {
      structuredContent: { schema_version: 1 },
      isError: false
    }
  });
  assert.match(malformed.stderr, /Unexpected external reviewer identity/);
  assert.equal(readState(root).external_review.started.length, 0);

  const replay = invoke(root, {
    hook_event_name: 'PostToolUse',
    tool_name: 'mcp__sd0x_claude_review__review_worktree',
    tool_use_id: malformedId,
    tool_input: { cwd: root, fingerprint },
    tool_response: {
      structuredContent: {
        schema_version: 1,
        reviewer: 'claude_mcp',
        perspective: 'primary',
        repository_root: root,
        fingerprint,
        outcome: 'clean',
        summary: 'No findings.',
        findings: [],
        duration_ms: 1
      },
      isError: false
    }
  });
  assert.match(replay.stderr, /no matching start/);
});

test('Claude review ledger requires exact session and tool-use identity', (t) => {
  const root = createRepo({ provider: 'claude' });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  invoke(root, { hook_event_name: 'SessionStart', session_id: 'session-2' });
  fs.writeFileSync(path.join(root, 'app.js'), 'const value = 2;\n');
  const current = refreshState(root);
  const fingerprint = current.worktree.fingerprint;
  const missingId = invoke(root, {
    hook_event_name: 'PreToolUse',
    tool_name: 'mcp__sd0x_claude_review__review_worktree',
    tool_input: { cwd: root, fingerprint }
  });
  assert.match(missingId.stderr, /requires session and tool-use identity/);

  invoke(root, {
    hook_event_name: 'PreToolUse',
    tool_name: 'mcp__sd0x_claude_review__review_worktree',
    tool_use_id: 'expected-tool',
    tool_input: { cwd: root, fingerprint }
  });
  const structuredContent = {
    schema_version: 1,
    reviewer: 'claude_mcp',
    perspective: 'primary',
    repository_root: root,
    fingerprint,
    outcome: 'clean',
    summary: 'No findings.',
    findings: [],
    duration_ms: 1
  };
  const wrongTool = invoke(root, {
    hook_event_name: 'PostToolUse',
    tool_name: 'mcp__sd0x_claude_review__review_worktree',
    tool_use_id: 'wrong-tool',
    tool_input: { cwd: root, fingerprint },
    tool_response: { structuredContent, isError: false }
  });
  assert.match(wrongTool.stderr, /no matching start/);
  assert.equal(readState(root).external_review.started.length, 1);

  const wrongSession = invoke(root, {
    hook_event_name: 'PostToolUse',
    session_id: 'session-2',
    tool_name: 'mcp__sd0x_claude_review__review_worktree',
    tool_use_id: 'expected-tool',
    tool_input: { cwd: root, fingerprint },
    tool_response: { structuredContent, isError: false }
  });
  assert.match(wrongSession.stderr, /no matching start/);
  assert.equal(readState(root).external_review.started.length, 1);
});
