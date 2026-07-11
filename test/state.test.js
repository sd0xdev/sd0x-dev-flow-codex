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
  recordExternalReview,
  recordExternalReviewStart,
  recordSubagent,
  refreshState,
  resetState,
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

function setReviewProvider(root, provider) {
  fs.appendFileSync(path.join(root, '.git', 'info', 'exclude'), '\n.codex/\n');
  fs.mkdirSync(path.join(root, '.codex'), { recursive: true });
  fs.writeFileSync(
    path.join(root, '.codex', 'sd0x-dev-flow.json'),
    JSON.stringify({ schema_version: 1, enabled: true, review: { provider } })
  );
}

function createChangedRepo(provider = 'claude') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-state-'));
  initRepository(root);
  setReviewProvider(root, provider);
  fs.writeFileSync(path.join(root, 'app.js'), 'module.exports = 1;\n');
  git(root, ['add', '.']);
  commit(root, 'baseline');
  fs.writeFileSync(path.join(root, 'app.js'), 'module.exports = 2;\n');
  return root;
}

function reviewEvidence(provider = 'claude') {
  const primary = provider === 'claude'
    ? 'sd0x_claude_primary_reviewer'
    : 'sd0x_codex_primary_reviewer';
  const agents = [primary, 'sd0x_reviewer', 'sd0x_test_reviewer'];
  if (provider === 'claude') agents.push('claude_mcp_primary');
  return {
    provider,
    reviewers: 3,
    agents,
    findings: 0
  };
}

function recordClaude(root, outcome = 'clean') {
  const current = refreshState(root);
  const fingerprint = current.worktree.fingerprint;
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
  recordExternalReviewStart(root, {
    input_fingerprint: fingerprint,
    input_root: root,
    session_id: 'state-test-session',
    tool_use_id: 'tool-1'
  });
  return recordExternalReview(root, {
    input_fingerprint: fingerprint,
    input_root: root,
    session_id: 'state-test-session',
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
  const provider = require('../plugin/sd0x-dev-flow-codex/scripts/runtime/config')
    .reviewProvider(root);
  const primary = provider === 'claude'
    ? 'sd0x_claude_primary_reviewer'
    : 'sd0x_codex_primary_reviewer';
  for (const agentType of [primary, 'sd0x_reviewer', 'sd0x_test_reviewer']) {
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

test('Codex is the default primary provider and does not require Claude evidence', (t) => {
  const root = createChangedRepo('codex');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  let state = refreshState(root);
  assert.equal(state.review_provider, 'codex');
  recordCleanCodexReviewers(root, 'codex-default');
  state = markGate(root, 'review', 'pass', reviewEvidence('codex'));
  assert.equal(state.gates.review.status, 'pass');
  assert.equal(state.external_review.completed.length, 0);
  assert.throws(
    () => recordExternalReviewStart(root, {
      input_fingerprint: state.worktree.fingerprint,
      input_root: root,
      session_id: 'unexpected-claude',
      tool_use_id: 'unexpected-claude'
    }),
    /review\.provider="claude"/
  );
});

test('changing review provider invalidates gates and reviewer evidence', (t) => {
  const root = createChangedRepo('claude');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  refreshState(root);
  recordCleanCodexReviewers(root, 'before-provider-change');
  recordClaude(root);
  let state = markGate(root, 'review', 'pass', reviewEvidence());
  assert.equal(state.gates.review.status, 'pass');

  setReviewProvider(root, 'codex');
  state = refreshState(root);
  assert.equal(state.review_provider, 'codex');
  assert.equal(state.gates.review.status, 'pending');
  assert.equal(state.gates.verify.status, 'pending');
  assert.deepEqual(state.review_agents.completed, []);
  assert.deepEqual(state.external_review.completed, []);
});

test('similarly named agents cannot contribute authoritative review evidence', (t) => {
  const root = createChangedRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  refreshState(root);
  recordCleanCodexReviewers(root);
  recordClaude(root);
  const passed = markGate(root, 'review', 'pass', reviewEvidence());
  const reviewerEvidence = structuredClone(passed.review_agents);
  const gates = structuredClone(passed.gates);

  recordSubagent(root, 'start', {
    agent_id: 'lookalike-reviewer',
    agent_type: 'sd0x_reviewer_helper'
  });
  recordSubagent(root, 'stop', {
    agent_id: 'lookalike-reviewer',
    agent_type: 'sd0x_reviewer_helper',
    last_assistant_message: '[P1] app.js:1 Untrusted result.'
  });

  const state = readState(root);
  assert.deepEqual(state.review_agents, reviewerEvidence);
  assert.deepEqual(state.gates, gates);
});

test('inactive primary reviewers cannot alter provider-scoped gate evidence', (t) => {
  for (const provider of ['codex', 'claude']) {
    const root = createChangedRepo(provider);
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    refreshState(root);
    recordCleanCodexReviewers(root, `${provider}-active`);
    if (provider === 'claude') recordClaude(root);
    let state = markGate(root, 'review', 'pass', reviewEvidence(provider));
    state = runVerification(root).state;
    const reviewerEvidence = structuredClone(state.review_agents);
    const gates = structuredClone(state.gates);
    const inactivePrimary = provider === 'codex'
      ? 'sd0x_claude_primary_reviewer'
      : 'sd0x_codex_primary_reviewer';

    recordSubagent(root, 'start', {
      agent_id: `${provider}-inactive-primary`,
      agent_type: inactivePrimary
    });
    recordSubagent(root, 'stop', {
      agent_id: `${provider}-inactive-primary`,
      agent_type: inactivePrimary,
      last_assistant_message: '[P1] app.js:1 Inactive reviewer finding.'
    });

    state = readState(root);
    assert.deepEqual(state.review_agents, reviewerEvidence);
    assert.deepEqual(state.gates, gates);
    assert.deepEqual(nextAction(state), {
      action: 'complete',
      reason: 'all-required-gates-pass'
    });
  }
});

test('non-clean reviewer output remains blocking on the same fingerprint', (t) => {
  for (const [index, message] of [
    '[P1] app.js:1 Bracketed finding.',
    'P1 app.js:1 Unbracketed finding.',
    '- P1 — app.js:1 List finding.',
    '## P1\n\napp.js:1 Heading finding.',
    'Reviewer process failed before producing a verdict.'
  ].entries()) {
    const root = createChangedRepo('codex');
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    refreshState(root);
    const firstId = `primary-non-clean-${index}`;
    recordSubagent(root, 'start', {
      agent_id: firstId,
      agent_type: 'sd0x_codex_primary_reviewer'
    });
    let state = recordSubagent(root, 'stop', {
      agent_id: firstId,
      agent_type: 'sd0x_codex_primary_reviewer',
      last_assistant_message: message
    });
    assert.equal(state.review_agents.completed.at(-1).outcome, 'findings');

    recordCleanCodexReviewers(root, `retry-${index}`);
    assert.throws(
      () => markGate(root, 'review', 'pass', reviewEvidence('codex')),
      /unresolved findings/
    );
  }
});

test('overlapping same-type reviewers remain independently blocking', (t) => {
  const root = createChangedRepo('codex');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  refreshState(root);
  recordSubagent(root, 'start', {
    agent_id: 'primary-slow',
    agent_type: 'sd0x_codex_primary_reviewer'
  });
  recordCleanCodexReviewers(root, 'replacement');
  assert.throws(
    () => markGate(root, 'review', 'pass', reviewEvidence('codex')),
    /still running/
  );

  const state = recordSubagent(root, 'stop', {
    agent_id: 'primary-slow',
    agent_type: 'sd0x_codex_primary_reviewer',
    last_assistant_message: 'P1 app.js:1 Late overlapping finding.'
  });
  assert.equal(state.gates.review.status, 'fail');
  assert.throws(
    () => markGate(root, 'review', 'pass', reviewEvidence('codex')),
    /unresolved findings/
  );
});

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

  for (const agentType of [
    'sd0x_claude_primary_reviewer',
    'sd0x_reviewer',
    'sd0x_test_reviewer'
  ]) {
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

  recordSubagent(root, 'start', {
    agent_id: 'still-running-reviewer',
    agent_type: 'sd0x_reviewer'
  });
  assert.throws(
    () => markGate(root, 'review', 'pass', reviewEvidence()),
    /still running/
  );
  recordSubagent(root, 'stop', {
    agent_id: 'still-running-reviewer',
    agent_type: 'sd0x_reviewer',
    last_assistant_message: 'No actionable findings remain.'
  });

  const fingerprint = refreshState(root).worktree.fingerprint;
  recordExternalReviewStart(root, {
    input_fingerprint: fingerprint,
    input_root: root,
    session_id: 'session-1',
    tool_use_id: 'still-running-claude'
  });
  assert.throws(
    () => markGate(root, 'review', 'pass', reviewEvidence()),
    /still running/
  );
  recordExternalReview(root, {
    input_fingerprint: fingerprint,
    input_root: root,
    session_id: 'session-1',
    tool_use_id: 'still-running-claude',
    result: {
      schema_version: 1,
      reviewer: 'claude_mcp',
      perspective: 'primary',
      repository_root: root,
      fingerprint,
      outcome: 'clean',
      summary: 'No findings.',
      findings: [],
      duration_ms: 1
    }
  });

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

  recordSubagent(root, 'start', {
    agent_id: 'post-pass-codex-reviewer',
    agent_type: 'sd0x_reviewer'
  });
  recordExternalReviewStart(root, {
    input_fingerprint: fingerprint,
    input_root: root,
    session_id: 'session-1',
    tool_use_id: 'post-pass-claude-reviewer'
  });
  state = readState(root);
  assert.deepEqual(nextAction(state), {
    action: 'review',
    reason: 'review-in-progress'
  });
  recordSubagent(root, 'stop', {
    agent_id: 'post-pass-codex-reviewer',
    agent_type: 'sd0x_reviewer',
    last_assistant_message: 'No actionable findings remain.'
  });
  assert.equal(nextAction(readState(root)).reason, 'review-in-progress');
  state = recordExternalReview(root, {
    input_fingerprint: fingerprint,
    input_root: root,
    session_id: 'session-1',
    tool_use_id: 'post-pass-claude-reviewer',
    result: {
      schema_version: 1,
      reviewer: 'claude_mcp',
      perspective: 'primary',
      repository_root: root,
      fingerprint,
      outcome: 'clean',
      summary: 'No findings.',
      findings: [],
      duration_ms: 1
    }
  });
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
  assert.equal(nextAction(state).action, 'review');
});

test('late Claude findings revoke passed review and verification gates', (t) => {
  const root = createChangedRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  refreshState(root, { sessionId: 'late-claude-session' });
  recordCleanCodexReviewers(root, 'late-claude');
  recordClaude(root);
  markGate(root, 'review', 'pass', reviewEvidence());
  let state = runVerification(root).state;
  assert.equal(state.gates.verify.status, 'pass');
  const fingerprint = state.worktree.fingerprint;
  recordExternalReviewStart(root, {
    input_fingerprint: fingerprint,
    input_root: root,
    session_id: 'late-claude-session',
    tool_use_id: 'late-claude-finding'
  });
  state = recordExternalReview(root, {
    input_fingerprint: fingerprint,
    input_root: root,
    session_id: 'late-claude-session',
    tool_use_id: 'late-claude-finding',
    result: {
      schema_version: 1,
      reviewer: 'claude_mcp',
      perspective: 'primary',
      repository_root: root,
      fingerprint,
      outcome: 'findings',
      summary: 'A late finding remains.',
      findings: [{
        severity: 'P1',
        category: 'implementation',
        file: 'app.js',
        line: 1,
        title: 'Late regression',
        evidence: 'The current fingerprint still contains a regression.',
        root_cause: 'A concurrent reviewer completed after the gate passed.',
        recommendation: 'Fix the regression and rerun all reviewers.',
        regression_protection: 'Keep the late-finding revocation test.'
      }],
      duration_ms: 1
    }
  });

  assert.equal(state.gates.review.status, 'fail');
  assert.equal(state.gates.verify.status, 'pending');
  assert.deepEqual(nextAction(state), {
    action: 'review',
    reason: 'review-findings-remain'
  });
});

test('late Codex findings revoke passed review and verification gates', (t) => {
  const root = createChangedRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  refreshState(root, { sessionId: 'late-codex-session' });
  recordCleanCodexReviewers(root, 'late-codex');
  recordClaude(root);
  markGate(root, 'review', 'pass', reviewEvidence());
  let state = runVerification(root).state;
  assert.equal(state.gates.verify.status, 'pass');

  recordSubagent(root, 'start', {
    agent_id: 'late-codex-finding',
    agent_type: 'sd0x_test_reviewer'
  });
  state = recordSubagent(root, 'stop', {
    agent_id: 'late-codex-finding',
    agent_type: 'sd0x_test_reviewer',
    last_assistant_message: '[P1] app.js:1 A late regression remains.'
  });

  assert.equal(state.gates.review.status, 'fail');
  assert.equal(state.gates.verify.status, 'pending');
  assert.deepEqual(state.review_agents.started, []);
  assert.deepEqual(nextAction(state), {
    action: 'review',
    reason: 'review-findings-remain'
  });
});

test('ordinary edits before a gate remain reviewable', (t) => {
  const root = createChangedRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  refreshState(root);
  fs.writeFileSync(path.join(root, 'app.js'), 'module.exports = 4;\n');
  const state = refreshState(root);
  assert.deepEqual(nextAction(state), {
    action: 'review',
    reason: 'review-required'
  });
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

test('review loop remains active across arbitrarily many failed fingerprints', (t) => {
  const root = createChangedRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  refreshState(root);
  for (let index = 0; index < 20; index += 1) {
    let state = markGate(root, 'review', 'fail', { findings: 1 });
    assert.deepEqual(nextAction(state), {
      action: 'review',
      reason: 'review-findings-remain'
    });
    fs.writeFileSync(
      path.join(root, 'app.js'),
      `module.exports = ${index + 3};\n`
    );
    state = refreshState(root);
    assert.deepEqual(nextAction(state), {
      action: 'review',
      reason: 'review-required'
    });
  }
});

test('reviewer infrastructure failures require user action without completing', (t) => {
  const root = createChangedRepo('codex');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  refreshState(root);
  recordSubagent(root, 'start', {
    agent_id: 'stale-primary',
    agent_type: 'sd0x_codex_primary_reviewer'
  });

  const state = markGate(root, 'review', 'fail', {
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

  assert.deepEqual(nextAction(state), {
    action: 'review',
    reason: 'reviewer-unavailable'
  });
  assert.equal(state.gates.review.status, 'fail');
  assert.equal(state.review_agents.started.length, 1);
});

test('new sessions preserve reviewer-failure gates and stale ledgers', (t) => {
  const nativeRoot = createChangedRepo('codex');
  t.after(() => fs.rmSync(nativeRoot, { recursive: true, force: true }));
  refreshState(nativeRoot, { sessionId: 'native-before-restart' });
  recordSubagent(nativeRoot, 'start', {
    agent_id: 'native-stale',
    agent_type: 'sd0x_codex_primary_reviewer'
  });
  markGate(nativeRoot, 'review', 'fail', {
    ...reviewEvidence('codex'),
    reviewer_failure: true,
    summary: 'native reviewer unavailable'
  });
  let state = refreshState(nativeRoot, { sessionId: 'native-after-restart' });
  assert.equal(nextAction(state).reason, 'reviewer-unavailable');
  assert.equal(state.gates.review.status, 'fail');
  assert.equal(state.review_agents.started.length, 1);

  const externalRoot = createChangedRepo('claude');
  t.after(() => fs.rmSync(externalRoot, { recursive: true, force: true }));
  const current = refreshState(externalRoot, {
    sessionId: 'external-before-restart'
  });
  recordExternalReviewStart(externalRoot, {
    input_fingerprint: current.worktree.fingerprint,
    input_root: externalRoot,
    session_id: 'external-before-restart',
    tool_use_id: 'external-stale'
  });
  markGate(externalRoot, 'review', 'fail', {
    ...reviewEvidence('claude'),
    reviewer_failure: true,
    summary: 'external reviewer unavailable'
  });
  state = refreshState(externalRoot, { sessionId: 'external-after-restart' });
  assert.equal(nextAction(state).reason, 'reviewer-unavailable');
  assert.equal(state.gates.review.status, 'fail');
  assert.equal(state.external_review.started.length, 1);
});

test('reset clears gate evidence, preserves sessions, and requires review again', (t) => {
  const root = createChangedRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  refreshState(root, { sessionId: 'reset-session' });
  recordCleanCodexReviewers(root, 'before-reset');
  recordClaude(root);
  markGate(root, 'review', 'pass', reviewEvidence());
  const beforeReset = runVerification(root).state;
  assert.equal(beforeReset.gates.review.status, 'pass');
  assert.equal(beforeReset.gates.verify.status, 'pass');
  assert.ok(beforeReset.gates.verify.evidence.commands.length > 0);
  recordSubagent(root, 'start', {
    agent_id: 'reviewer-in-flight-at-reset',
    agent_type: 'sd0x_reviewer'
  });

  const state = resetState(root);

  assert.equal(state.worktree.fingerprint, refreshState(root).worktree.fingerprint);
  assert.equal(state.worktree.requires_review, true);
  assert.equal(state.gates.review.status, 'pending');
  assert.equal(state.gates.verify.status, 'pending');
  assert.equal(state.gates.review.fingerprint, null);
  assert.equal(state.gates.verify.fingerprint, null);
  assert.equal(state.gates.review.evidence, null);
  assert.equal(state.gates.verify.evidence, null);
  assert.deepEqual(state.review_agents.completed, []);
  assert.deepEqual(state.review_agents.started, []);
  assert.deepEqual(state.external_review.completed, []);
  assert.deepEqual(state.external_review.started, []);
  assert.deepEqual(state.sessions.map((entry) => entry.session_id), [
    'reset-session'
  ]);
  assert.deepEqual(nextAction(state, { sessionId: 'reset-session' }), {
    action: 'review',
    reason: 'review-required'
  });
  recordSubagent(root, 'stop', {
    agent_id: 'reviewer-in-flight-at-reset',
    agent_type: 'sd0x_reviewer',
    last_assistant_message: 'No actionable findings remain.'
  });
  assert.deepEqual(readState(root).review_agents.completed, []);
  assert.throws(
    () => markGate(root, 'review', 'pass', reviewEvidence()),
    /clean terminal results/
  );
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

test('abandoned external review starts remain bounded', (t) => {
  const root = createChangedRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const fingerprint = refreshState(root).worktree.fingerprint;
  for (let index = 0; index < 70; index += 1) {
    recordExternalReviewStart(root, {
      input_fingerprint: fingerprint,
      input_root: root,
      session_id: 'bounded-ledger-session',
      tool_use_id: `abandoned-${index}`
    });
  }
  const started = readState(root).external_review.started;
  assert.equal(started.length, 64);
  assert.equal(started[0].tool_use_id, 'abandoned-6');
  assert.equal(started.at(-1).tool_use_id, 'abandoned-69');
});

test('aged Codex reviewer starts block until their exact terminal result', (t) => {
  const root = createChangedRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  refreshState(root, { sessionId: 'aged-codex-session' });
  recordCleanCodexReviewers(root, 'before-aged-start');
  recordClaude(root);
  markGate(root, 'review', 'pass', reviewEvidence());
  let state = runVerification(root).state;
  assert.equal(nextAction(state).action, 'complete');
  recordSubagent(root, 'start', {
    agent_id: 'aged-codex-reviewer',
    agent_type: 'sd0x_reviewer'
  });
  assert.equal(nextAction(readState(root)).reason, 'review-in-progress');
  const statePath = resolveStatePath(root);
  const persisted = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  persisted.review_agents.started[0].recorded_at = '2000-01-01T00:00:00.000Z';
  fs.writeFileSync(statePath, JSON.stringify(persisted));

  state = readState(root);
  assert.equal(state.review_agents.started.length, 1);
  assert.equal(nextAction(state).reason, 'review-in-progress');
  state = recordSubagent(root, 'stop', {
    agent_id: 'aged-codex-reviewer',
    agent_type: 'sd0x_reviewer',
    last_assistant_message: '[P1] app.js:1 An aged reviewer found a regression.'
  });
  assert.equal(state.gates.review.status, 'fail');
  assert.equal(state.gates.verify.status, 'pending');
  assert.equal(nextAction(state).reason, 'review-findings-remain');
});

test('expired external review starts cannot record late evidence', (t) => {
  const root = createChangedRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const current = refreshState(root);
  const fingerprint = current.worktree.fingerprint;
  recordExternalReviewStart(root, {
    input_fingerprint: fingerprint,
    input_root: root,
    session_id: 'expired-ledger-session',
    tool_use_id: 'expired-tool'
  });
  const statePath = resolveStatePath(root);
  const persisted = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  persisted.external_review.started[0].recorded_at = '2000-01-01T00:00:00.000Z';
  fs.writeFileSync(statePath, JSON.stringify(persisted));

  assert.throws(
    () => recordExternalReview(root, {
      input_fingerprint: fingerprint,
      input_root: root,
      session_id: 'expired-ledger-session',
      tool_use_id: 'expired-tool',
      result: {
        schema_version: 1,
        reviewer: 'claude_mcp',
        perspective: 'primary',
        repository_root: root,
        fingerprint,
        outcome: 'clean',
        summary: 'No findings.',
        findings: [],
        duration_ms: 1
      }
    }),
    /no matching start/
  );
  const state = readState(root);
  assert.deepEqual(state.external_review.started, []);
  assert.deepEqual(state.external_review.completed, []);
});

test('external review starts reject stale fingerprints and repository roots', (t) => {
  const root = createChangedRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const fingerprint = refreshState(root).worktree.fingerprint;
  assert.throws(
    () => recordExternalReviewStart(root, {
      input_fingerprint: '0'.repeat(64),
      input_root: root,
      session_id: 'invalid-start-session',
      tool_use_id: 'stale-start'
    }),
    /fingerprint is stale/
  );
  assert.throws(
    () => recordExternalReviewStart(root, {
      input_fingerprint: fingerprint,
      input_root: `${root}-different-clone`,
      session_id: 'invalid-start-session',
      tool_use_id: 'wrong-root-start'
    }),
    /repository root mismatch/
  );
  assert.deepEqual(readState(root).external_review.started, []);
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

test('session activation preserves other active sessions', (t) => {
  const root = createChangedRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  refreshState(root, { sessionId: 'session-1' });
  refreshState(root, { sessionId: 'session-2' });
  const state = refreshState(root, { sessionId: 'session-1' });

  assert.deepEqual(state.sessions.map((entry) => entry.session_id), [
    'session-1',
    'session-2'
  ]);
});

test('completed gates remain complete when obsolete retry counters are present', () => {
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
  state.iteration = { round: 999, max_rounds: 1, max_continuations: 1 };
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

test('legacy state invalidates old gates and discards retry counters', (t) => {
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
  assert.equal(state.schema_version, 6);
  assert.equal(state.gates.review.status, 'pending');
  assert.equal(state.gates.verify.status, 'pending');
  assert.equal('iteration' in state, false);
  assert.deepEqual(state.sessions.map((entry) => entry.session_id), [
    'legacy-session'
  ]);
});

test('schema v4 migration invalidates pre-provider evidence and removes exhausted limits', (t) => {
  const root = createChangedRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  refreshState(root, { sessionId: 'v4-session' });
  markGate(root, 'review', 'fail', { findings: 1 });
  const statePath = resolveStatePath(root);
  const legacy = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  legacy.schema_version = 4;
  legacy.iteration = {
    round: 100,
    max_rounds: 8,
    max_continuations: 8
  };
  legacy.sessions[0].continuations = 100;
  fs.writeFileSync(statePath, JSON.stringify(legacy));

  const state = readState(root);
  assert.equal(state.schema_version, 6);
  assert.equal('iteration' in state, false);
  assert.equal('continuations' in state.sessions[0], false);
  assert.equal(state.gates.review.status, 'pending');
  assert.deepEqual(nextAction(state, { sessionId: 'v4-session' }), {
    action: 'review',
    reason: 'review-required'
  });
});

test('schema v4 migration clears all pre-provider reviewer evidence', (t) => {
  const root = createChangedRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  refreshState(root, { sessionId: 'v4-evidence-session' });
  recordCleanCodexReviewers(root, 'v4-evidence');
  recordClaude(root);
  const statePath = resolveStatePath(root);
  const legacy = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  legacy.schema_version = 4;
  legacy.review_agents.started = legacy.review_agents.completed.map((entry) => ({
    agent_id: entry.agent_id,
    agent_type: entry.agent_type,
    recorded_at: entry.started_at
  }));
  fs.writeFileSync(statePath, JSON.stringify(legacy));

  let state = readState(root);
  assert.deepEqual(state.review_agents.started, []);
  assert.equal(state.review_agents.completed.length, 0);
  assert.equal(state.external_review.completed.length, 0);
  assert.throws(
    () => markGate(root, 'review', 'pass', reviewEvidence()),
    /clean terminal results/
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
  assert.equal(state.schema_version, 6);
  assert.deepEqual(state.sessions.map((entry) => entry.session_id), [
    'v3-session'
  ]);
  assert.equal(state.gates.review.status, 'pending');
  assert.equal(state.gates.verify.status, 'pending');
  assert.deepEqual(state.review_agents.completed, []);
  assert.deepEqual(state.external_review.completed, []);
  assert.equal('iteration' in state, false);
});

test('state lock immediately reclaims a dead owner', (t) => {
  const root = createChangedRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const lockPath = `${resolveStatePath(root)}.lock`;
  fs.mkdirSync(lockPath, { recursive: true });
  fs.writeFileSync(path.join(lockPath, 'owner'), '99999999');

  const state = refreshState(root, { sessionId: 'session-after-crash' });
  assert.equal(state.schema_version, 6);
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

  for (const agentType of [
    'sd0x_claude_primary_reviewer',
    'sd0x_reviewer',
    'sd0x_test_reviewer'
  ]) {
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

  const staleState = refreshState(root);
  const stale = staleState.worktree.fingerprint;
  fs.writeFileSync(path.join(root, 'app.js'), 'module.exports = 9;\n');
  assert.throws(
    () => recordExternalReview(root, {
      input_fingerprint: stale,
      input_root: root,
      session_id: 'state-test-session',
      tool_use_id: 'stale-tool',
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
  const current = refreshState(root);
  const fingerprint = current.worktree.fingerprint;
  assert.throws(
    () => recordExternalReview(root, {
      input_fingerprint: fingerprint,
      input_root: `${root}-different-clone`,
      session_id: 'state-test-session',
      tool_use_id: 'wrong-root-tool',
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
    schema_version: 5,
    sessions: [
      {
        session_id: 'stale',
        started_at: '2000-01-01T00:00:00.000Z',
        updated_at: '2000-01-01T00:00:00.000Z'
      },
      {
        session_id: 'recent',
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ]
  }));

  let state = readState(root);
  assert.deepEqual(state.sessions.map((entry) => entry.session_id), ['recent']);
  state = refreshState(root, { sessionId: 'stale' });
  assert.deepEqual(state.sessions.map((entry) => entry.session_id), [
    'recent',
    'stale'
  ]);
});
