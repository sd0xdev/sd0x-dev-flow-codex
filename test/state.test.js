'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  activationFailurePath,
  claimSetupDeferral,
  clearSessionActivationFailure,
  defaultState,
  hasSessionActivationFailure,
  markGate,
  markSetupDeferral,
  markSessionActivationFailure,
  nextAction,
  readState,
  recordContinuation,
  recordExternalReview,
  recordSubagent,
  refreshState,
  resolveStatePath,
  setupDeferralPath
} = require('../plugin/sd0x-dev-flow-codex/scripts/runtime/state');
const { runVerification } = require('../plugin/sd0x-dev-flow-codex/scripts/runtime/verify');
const {
  commit,
  git,
  initRepository,
  isolateGitEnvironment
} = require('./helpers/git');

isolateGitEnvironment();

function createChangedRepo(options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-state-'));
  initRepository(root);
  fs.writeFileSync(path.join(root, 'app.js'), 'module.exports = 1;\n');
  if (options.maxRounds || options.maxContinuations) {
    fs.mkdirSync(path.join(root, '.codex'), { recursive: true });
    fs.writeFileSync(
      path.join(root, '.codex', 'sd0x-dev-flow.json'),
      JSON.stringify({
        schema_version: 1,
        enabled: true,
        limits: {
          max_rounds: options.maxRounds || 8,
          max_continuations: options.maxContinuations || 8
        }
      })
    );
  }
  git(root, ['add', '.']);
  commit(root, 'baseline');
  fs.writeFileSync(path.join(root, 'app.js'), 'module.exports = 2;\n');
  return root;
}

function reviewEvidence() {
  return {
    reviewers: 3,
    agents: ['claude_mcp_primary', 'sd0x_reviewer', 'sd0x_test_reviewer'],
    findings: 0
  };
}

function recordClaude(root, outcome = 'clean') {
  const fingerprint = refreshState(root).worktree.fingerprint;
  const findings = outcome === 'clean' ? [] : [{
    severity: 'P1',
    category: 'implementation',
    file: 'app.js',
    line: 1,
    title: 'Regression',
    evidence: 'Changed behavior is incorrect.',
    root_cause: 'The new branch violates the established behavior contract.',
    recommendation: 'Restore the expected behavior.',
    regression_protection: 'Add a focused regression assertion.'
  }];
  return recordExternalReview(root, {
    input_fingerprint: fingerprint,
    input_root: root,
    tool_use_id: 'tool-1',
    result: {
      schema_version: 1,
      reviewer: 'claude_mcp',
      perspective: 'primary',
      repository_root: root,
      fingerprint,
      outcome,
      summary: outcome === 'clean' ? 'No findings.' : 'One finding.',
      findings,
      duration_ms: 10
    }
  });
}

function recordCleanCodexReviewers(root, suffix = 'clean') {
  for (const agentType of ['sd0x_reviewer', 'sd0x_test_reviewer']) {
    const agentId = `${agentType}-${suffix}`;
    recordSubagent(root, 'start', { agent_id: agentId, agent_type: agentType });
    recordSubagent(root, 'stop', {
      agent_id: agentId,
      agent_type: agentType,
      stop_hook_active: false,
      last_assistant_message: 'No actionable findings remain.'
    });
  }
}

test('gates require Claude plus dual Codex review and bind to one fingerprint', (t) => {
  const root = createChangedRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  let state = refreshState(root, { sessionId: 'session-1' });
  assert.deepEqual(nextAction(state), { action: 'review', reason: 'review-required' });
  assert.ok(resolveStatePath(root).includes(`${path.sep}.git${path.sep}`));

  assert.throws(
    () => markGate(root, 'review', 'pass', reviewEvidence()),
    /clean terminal results/
  );

  recordSubagent(root, 'stop', {
    agent_id: 'orphan',
    agent_type: 'sd0x_reviewer'
  });
  assert.equal(refreshState(root).review_agents.completed.length, 0);

  for (const agentType of ['sd0x_reviewer', 'sd0x_test_reviewer']) {
    recordSubagent(root, 'start', { agent_id: `${agentType}-1`, agent_type: agentType });
    recordSubagent(root, 'stop', {
      agent_id: `${agentType}-1`,
      agent_type: agentType,
      stop_hook_active: false,
      last_assistant_message: 'No actionable findings remain.'
    });
  }

  assert.throws(
    () => markGate(root, 'review', 'pass', reviewEvidence()),
    /Claude MCP primary/
  );
  recordClaude(root);

  state = markGate(root, 'review', 'pass', reviewEvidence());
  assert.deepEqual(nextAction(state), {
    action: 'verify',
    reason: 'verification-required'
  });

  assert.throws(
    () => markGate(root, 'verify', 'pass', {
      commands: [{ command: 'npm test', exit_code: 0 }]
    }),
    /deterministic verify runner/
  );
  state = runVerification(root).state;
  assert.deepEqual(nextAction(state), {
    action: 'complete',
    reason: 'all-required-gates-pass'
  });

  fs.writeFileSync(path.join(root, 'app.js'), 'module.exports = 3;\n');
  state = refreshState(root);
  assert.equal(state.gates.review.status, 'pending');
  assert.equal(state.gates.verify.status, 'pending');
  assert.equal(state.review_agents.completed.length, 0);
  assert.equal(state.external_review.completed.length, 0);
  assert.equal(state.iteration.round, 1);
  assert.equal(nextAction(state).action, 'review');
});

test('ordinary edits before a gate do not consume loop rounds', (t) => {
  const root = createChangedRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  refreshState(root);
  fs.writeFileSync(path.join(root, 'app.js'), 'module.exports = 4;\n');
  const state = refreshState(root);
  assert.equal(state.iteration.round, 0);
});

test('an invalid setup nonce is rejected before the marker is renamed', (t) => {
  const root = createChangedRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const token = markSetupDeferral(root);
  const markerPath = setupDeferralPath(root);
  const originalRename = fs.renameSync;
  let markerRenames = 0;
  fs.renameSync = (source, destination) => {
    if (source === markerPath) markerRenames += 1;
    return originalRename(source, destination);
  };
  try {
    assert.equal(claimSetupDeferral(
      root,
      'unrelated-session',
      '00000000-0000-4000-8000-000000000000'
    ), false);
  } finally {
    fs.renameSync = originalRename;
  }

  assert.equal(markerRenames, 0);
  assert.equal(claimSetupDeferral(root, 'setup-session', token), true);
});

test('docs-only work completes after review without a verification gate', (t) => {
  const root = createChangedRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'app.js'), 'module.exports = 1;\n');
  fs.writeFileSync(path.join(root, 'notes.md'), '# Reviewed documentation\n');

  let state = refreshState(root);
  assert.deepEqual(state.worktree.files, ['notes.md']);
  assert.equal(state.worktree.requires_verify, false);
  recordCleanCodexReviewers(root, 'docs');
  recordClaude(root);
  state = markGate(root, 'review', 'pass', reviewEvidence());

  assert.equal(state.gates.verify.status, 'pending');
  assert.deepEqual(nextAction(state), {
    action: 'complete',
    reason: 'all-required-gates-pass'
  });
});

test('clean work resets the round limit for later tasks', (t) => {
  const root = createChangedRepo({ maxRounds: 1 });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  refreshState(root);
  markGate(root, 'review', 'fail', { findings: 1 });

  fs.writeFileSync(path.join(root, 'app.js'), 'module.exports = 3;\n');
  let state = refreshState(root);
  assert.equal(state.iteration.round, 1);
  assert.equal(nextAction(state).reason, 'max-rounds-reached');

  fs.writeFileSync(path.join(root, 'app.js'), 'module.exports = 1;\n');
  state = refreshState(root);
  assert.equal(state.worktree.fingerprint, 'clean');
  assert.equal(state.iteration.round, 0);

  fs.writeFileSync(path.join(root, 'app.js'), 'module.exports = 4;\n');
  state = refreshState(root);
  assert.equal(state.iteration.round, 0);
  assert.equal(nextAction(state).action, 'review');
});

test('reviewer stops without terminal output do not satisfy review', (t) => {
  const root = createChangedRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  refreshState(root);
  recordSubagent(root, 'start', {
    agent_id: 'reviewer-1',
    agent_type: 'sd0x_reviewer'
  });
  recordSubagent(root, 'stop', {
    agent_id: 'reviewer-1',
    agent_type: 'sd0x_reviewer'
  });
  assert.equal(refreshState(root).review_agents.completed.length, 0);
});

test('reviewer result is discarded when the fingerprint changes after start', (t) => {
  const root = createChangedRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const started = refreshState(root).worktree.fingerprint;
  recordSubagent(root, 'start', {
    agent_id: 'reviewer-stale',
    agent_type: 'sd0x_reviewer'
  });

  fs.writeFileSync(path.join(root, 'app.js'), 'module.exports = 7;\n');
  recordSubagent(root, 'stop', {
    agent_id: 'reviewer-stale',
    agent_type: 'sd0x_reviewer',
    last_assistant_message: 'No actionable findings remain.'
  });

  const state = readState(root);
  assert.notEqual(state.worktree.fingerprint, started);
  assert.equal(state.review_agents.fingerprint, state.worktree.fingerprint);
  assert.deepEqual(state.review_agents.completed, []);
});

test('session activation preserves other sessions and resume limits', (t) => {
  const root = createChangedRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  refreshState(root, { sessionId: 'session-1' });
  recordContinuation(root, 'session-1');
  refreshState(root, { sessionId: 'session-2' });
  const state = refreshState(root, { sessionId: 'session-1' });

  assert.deepEqual(
    state.sessions.map((entry) => [entry.session_id, entry.continuations]),
    [['session-1', 1], ['session-2', 0]]
  );
});

test('session continuation limit escalates the current session', (t) => {
  const root = createChangedRepo({ maxContinuations: 2 });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  let state = refreshState(root, { sessionId: 'limited-session' });

  recordContinuation(root, 'limited-session');
  state = readState(root);
  assert.deepEqual(nextAction(state, { sessionId: 'limited-session' }), {
    action: 'review',
    reason: 'review-required'
  });

  recordContinuation(root, 'limited-session');
  state = readState(root);
  assert.deepEqual(nextAction(state, { sessionId: 'limited-session' }), {
    action: 'escalate',
    reason: 'max-continuations-reached'
  });
});

test('completed gates take precedence over exhausted retry limits', () => {
  const state = defaultState();
  state.worktree = {
    ...state.worktree,
    root: '/repo',
    fingerprint: 'a'.repeat(64),
    files: ['app.js'],
    code_files: ['app.js'],
    requires_review: true,
    requires_verify: true
  };
  state.gates.review = {
    status: 'pass',
    fingerprint: state.worktree.fingerprint,
    evidence: {},
    updated_at: new Date().toISOString()
  };
  state.gates.verify = {
    status: 'pass',
    fingerprint: state.worktree.fingerprint,
    evidence: {},
    updated_at: new Date().toISOString()
  };
  state.iteration = { round: 1, max_rounds: 1, max_continuations: 1 };
  state.sessions = [{
    session_id: 'limited',
    continuations: 1,
    started_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }];
  assert.deepEqual(nextAction(state, { sessionId: 'limited' }), {
    action: 'complete',
    reason: 'all-required-gates-pass'
  });
});

test('legacy state invalidates old gates and exhausted rounds', (t) => {
  const root = createChangedRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const statePath = resolveStatePath(root);
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, JSON.stringify({
    schema_version: 1,
    session_id: 'legacy-session',
    worktree: { fingerprint: 'clean', requires_review: false },
    gates: {
      review: { status: 'pass', fingerprint: 'clean' },
      verify: { status: 'pass', fingerprint: 'clean' }
    },
    iteration: {
      round: 8,
      continuations: 7,
      max_rounds: 8,
      max_continuations: 8
    }
  }));

  const state = readState(root);
  assert.equal(state.schema_version, 4);
  assert.equal(state.gates.review.status, 'pending');
  assert.equal(state.gates.verify.status, 'pending');
  assert.equal(state.iteration.round, 0);
  assert.deepEqual(
    state.sessions.map((entry) => [entry.session_id, entry.continuations]),
    [['legacy-session', 7]]
  );
});

test('schema v3 migration clears gate evidence and preserves sessions', (t) => {
  const root = createChangedRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const statePath = resolveStatePath(root);
  const recordedAt = new Date().toISOString();
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, JSON.stringify({
    schema_version: 3,
    sessions: [{
      session_id: 'v3-session',
      continuations: 4,
      started_at: recordedAt,
      updated_at: recordedAt
    }],
    gates: {
      review: { status: 'pass', fingerprint: 'v3-fingerprint' },
      verify: { status: 'pass', fingerprint: 'v3-fingerprint' }
    },
    review_agents: {
      fingerprint: 'v3-fingerprint',
      started: [{ agent_id: 'reviewer-1' }],
      completed: [{ agent_id: 'reviewer-1', outcome: 'clean' }]
    },
    external_review: {
      fingerprint: 'v3-fingerprint',
      completed: [{ reviewer: 'claude_mcp', outcome: 'clean' }]
    },
    iteration: {
      round: 3,
      max_rounds: 8,
      max_continuations: 8
    }
  }));

  const state = readState(root);
  assert.equal(state.schema_version, 4);
  assert.deepEqual(
    state.sessions.map((entry) => [entry.session_id, entry.continuations]),
    [['v3-session', 4]]
  );
  assert.equal(state.gates.review.status, 'pending');
  assert.equal(state.gates.verify.status, 'pending');
  assert.deepEqual(state.review_agents.completed, []);
  assert.deepEqual(state.external_review.completed, []);
  assert.equal(state.iteration.round, 0);
});

test('state lock immediately reclaims a dead owner', (t) => {
  const root = createChangedRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const lockPath = `${resolveStatePath(root)}.lock`;
  fs.mkdirSync(lockPath, { recursive: true });
  fs.writeFileSync(path.join(lockPath, 'owner'), '99999999');

  const state = refreshState(root, { sessionId: 'session-after-crash' });
  assert.equal(state.schema_version, 4);
  assert.equal(state.sessions[0].session_id, 'session-after-crash');
  assert.equal(fs.existsSync(lockPath), false);
});

test('session activation failure markers stay in runtime metadata', (t) => {
  const root = createChangedRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const markerPath = activationFailurePath(root, 'failed-session');

  assert.equal(markSessionActivationFailure(root, 'failed-session'), true);
  assert.ok(
    fs.realpathSync(markerPath).startsWith(
      fs.realpathSync(path.join(root, '.git'))
    )
  );
  assert.equal(hasSessionActivationFailure(root, 'failed-session'), true);
  assert.equal(clearSessionActivationFailure(root, 'failed-session'), true);
  assert.equal(hasSessionActivationFailure(root, 'failed-session'), false);
});

test('review pass rejects terminal reviewer findings', (t) => {
  const root = createChangedRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  refreshState(root);
  for (const [agentType, message] of [
    ['sd0x_reviewer', 'No actionable findings remain.'],
    ['sd0x_test_reviewer', 'High - a regression remains.']
  ]) {
    const agentId = `${agentType}-1`;
    recordSubagent(root, 'start', { agent_id: agentId, agent_type: agentType });
    recordSubagent(root, 'stop', {
      agent_id: agentId,
      agent_type: agentType,
      stop_hook_active: false,
      last_assistant_message: message
    });
  }
  recordClaude(root);
  const cleanTestId = 'sd0x_test_reviewer-clean-after-finding';
  recordSubagent(root, 'start', {
    agent_id: cleanTestId,
    agent_type: 'sd0x_test_reviewer'
  });
  recordSubagent(root, 'stop', {
    agent_id: cleanTestId,
    agent_type: 'sd0x_test_reviewer',
    last_assistant_message: 'No actionable findings remain.'
  });

  assert.throws(
    () => markGate(root, 'review', 'pass', reviewEvidence()),
    /unresolved findings/
  );
});

test('Claude MCP findings and stale fingerprints cannot satisfy review', (t) => {
  const root = createChangedRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  refreshState(root);
  recordClaude(root, 'findings');
  assert.equal(readState(root).external_review.completed[0].outcome, 'findings');
  recordClaude(root, 'clean');
  assert.deepEqual(
    readState(root).external_review.completed.map((entry) => entry.outcome),
    ['findings', 'clean']
  );

  for (const agentType of ['sd0x_reviewer', 'sd0x_test_reviewer']) {
    const agentId = `${agentType}-clean`;
    recordSubagent(root, 'start', { agent_id: agentId, agent_type: agentType });
    recordSubagent(root, 'stop', {
      agent_id: agentId,
      agent_type: agentType,
      last_assistant_message: 'No actionable findings remain.'
    });
  }
  assert.throws(
    () => markGate(root, 'review', 'pass', reviewEvidence()),
    /unresolved findings/
  );

  const stale = refreshState(root).worktree.fingerprint;
  fs.writeFileSync(path.join(root, 'app.js'), 'module.exports = 9;\n');
  assert.throws(
    () => recordExternalReview(root, {
      input_fingerprint: stale,
      input_root: root,
      result: {
        schema_version: 1,
        reviewer: 'claude_mcp',
        perspective: 'primary',
        repository_root: root,
        fingerprint: stale,
        outcome: 'clean',
        summary: 'No findings.',
        findings: [],
        duration_ms: 1
      }
    }),
    /stale/
  );
});

test('external review evidence is bound to the repository root', (t) => {
  const root = createChangedRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const fingerprint = refreshState(root).worktree.fingerprint;
  assert.throws(
    () => recordExternalReview(root, {
      input_fingerprint: fingerprint,
      input_root: `${root}-different-clone`,
      result: {
        schema_version: 1,
        reviewer: 'claude_mcp',
        perspective: 'primary',
        repository_root: `${root}-different-clone`,
        fingerprint,
        outcome: 'clean',
        summary: 'No findings.',
        findings: [],
        duration_ms: 1
      }
    }),
    /repository root mismatch/
  );
});

test('stale sessions are pruned and can be reactivated', (t) => {
  const root = createChangedRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const statePath = resolveStatePath(root);
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, JSON.stringify({
    schema_version: 4,
    sessions: [
      {
        session_id: 'stale',
        continuations: 3,
        started_at: '2000-01-01T00:00:00.000Z',
        updated_at: '2000-01-01T00:00:00.000Z'
      },
      {
        session_id: 'recent',
        continuations: 1,
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ]
  }));

  let state = readState(root);
  assert.deepEqual(state.sessions.map((entry) => entry.session_id), ['recent']);
  state = refreshState(root, { sessionId: 'stale' });
  assert.deepEqual(
    state.sessions.map((entry) => [entry.session_id, entry.continuations]),
    [['recent', 1], ['stale', 0]]
  );
});
