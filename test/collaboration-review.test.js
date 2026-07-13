'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const test = require('node:test');
const {
  beginCollaborationReview,
  completeCollaborationReview,
  importCollaborationReview,
  markerPath,
  parseCollaborationEvents,
  withMarkerLock
} = require('../plugin/sd0x-dev-flow-codex/scripts/runtime/collaboration');
const {
  runReviewGate
} = require('../plugin/sd0x-dev-flow-codex/skills/review/scripts/gate');
const {
  beginCommitClosureReview,
  isCurrentPass,
  markGate,
  nextAction,
  readState,
  recordCollaborationFailure,
  recordSubagent,
  recordVerification,
  refreshState,
  resolveStatePath,
  resetState
} = require('../plugin/sd0x-dev-flow-codex/scripts/runtime/state');
const { commit, git, initRepository, isolateGitEnvironment } = require('./helpers/git');

isolateGitEnvironment();

const REVIEWERS = [
  'sd0x_codex_primary_reviewer',
  'sd0x_test_reviewer'
];
const GATE = path.resolve(
  __dirname,
  '..',
  'plugin',
  'sd0x-dev-flow-codex',
  'skills',
  'review',
  'scripts',
  'gate.js'
);

function passEvidence() {
  return {
    provider: 'codex',
    reviewers: 2,
    agents: REVIEWERS,
    findings: 0,
    summary: 'no actionable findings'
  };
}

function runGate(values, evidence = passEvidence()) {
  return spawnSync(process.execPath, [
    GATE,
    'pass',
    '--evidence',
    JSON.stringify(evidence)
  ], {
    cwd: values.root,
    encoding: 'utf8',
    env: { ...process.env, ...values.env }
  });
}

function runGateAsync(values, evidence = passEvidence()) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [
      GATE,
      'pass',
      '--evidence',
      JSON.stringify(evidence)
    ], {
      cwd: values.root,
      env: { ...process.env, ...values.env }
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.once('close', (status) => resolve({ status, stdout, stderr }));
  });
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-collaboration-'));
  initRepository(root);
  fs.mkdirSync(path.join(root, '.codex'), { recursive: true });
  fs.writeFileSync(path.join(root, '.codex', 'sd0x-dev-flow.json'), JSON.stringify({
    schema_version: 1,
    enabled: true,
    review: { provider: 'codex' }
  }));
  fs.writeFileSync(path.join(root, 'app.js'), 'const value = 1;\n');
  git(root, ['add', '.']);
  commit(root, 'baseline');
  fs.writeFileSync(path.join(root, 'app.js'), 'const value = 2;\n');

  const codexHome = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-codex-home-'));
  const threadId = '019f51d5-3300-73a0-ac86-8d67c7b4e173';
  const transcript = path.join(
    codexHome,
    'sessions',
    '2026',
    '07',
    '12',
    `rollout-2026-07-12T00-00-00-${threadId}.jsonl`
  );
  fs.mkdirSync(path.dirname(transcript), { recursive: true });
  fs.writeFileSync(transcript, `${JSON.stringify({
    timestamp: '2026-07-12T00:00:00.000Z',
    type: 'event_msg',
    payload: { type: 'baseline' }
  })}\n`);
  const env = { CODEX_HOME: codexHome, CODEX_THREAD_ID: threadId };
  return {
    root,
    transcript,
    env,
    cleanup() {
      fs.rmSync(root, { recursive: true, force: true });
      fs.rmSync(codexHome, { recursive: true, force: true });
    }
  };
}

function activity(agentType, kind = 'interacted', suffix = '') {
  return {
    timestamp: `2026-07-12T00:00:0${suffix || '1'}.000Z`,
    type: 'event_msg',
    payload: {
      type: 'sub_agent_activity',
      event_id: `call-${agentType}-${suffix || '1'}`,
      agent_thread_id: `thread-${agentType}`,
      agent_path: `/root/${agentType}`,
      kind
    }
  };
}

function finalMessage(agentType, result, options = {}) {
  const author = options.author || `/root/${agentType}`;
  const sender = options.sender || author;
  return {
    timestamp: '2026-07-12T00:00:02.000Z',
    type: 'response_item',
    payload: {
      type: 'agent_message',
      author,
      recipient: options.recipient || '/root',
      content: [{
        type: 'input_text',
        text: [
          'Message Type: FINAL_ANSWER',
          'Task name: /root',
          `Sender: ${sender}`,
          'Payload:',
          result
        ].join('\n')
      }]
    }
  };
}

function appendRows(transcript, rows) {
  fs.appendFileSync(transcript, `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`);
}

function cleanRows(commitSubjectSha256 = null) {
  return REVIEWERS.flatMap((agentType) => [
    activity(agentType),
    finalMessage(agentType, [
      'No actionable findings remain.',
      commitSubjectSha256
        ? `Commit-Subject-SHA256: ${commitSubjectSha256}`
        : null
    ].filter(Boolean).join('\n'))
  ]);
}

test('collaboration adapter imports two canonical terminal reviewer results', (t) => {
  const values = fixture();
  t.after(() => values.cleanup());
  const started = beginCollaborationReview(values.root, { env: values.env });
  assert.equal(started.available, true);
  assert.equal(started.transcript_offset, fs.statSync(values.transcript).size);

  appendRows(values.transcript, cleanRows());
  const imported = importCollaborationReview(values.root, { env: values.env });
  assert.equal(imported.imported, true);
  assert.deepEqual(imported.results, REVIEWERS.map((agentType) => ({
    agent_type: agentType,
    outcome: 'clean'
  })));
  assert.equal(fs.existsSync(markerPath(values.root)), true);

  const state = readState(values.root);
  assert.equal(state.review_agents.collaboration_round_id, started.round_id);
  assert.equal(state.review_agents.completed.length, 2);
  assert.ok(state.review_agents.completed.every((entry) =>
    entry.outcome === 'clean' && entry.has_transcript === true
  ));
  const gated = runGate(values);
  assert.equal(gated.status, 0, gated.stderr);
  assert.equal(fs.existsSync(markerPath(values.root)), false);
  assert.equal(isCurrentPass(readState(values.root), 'review'), true);
});

test('collaboration adapter reviews a clean commit subject with durable identity', (t) => {
  const values = fixture();
  t.after(() => values.cleanup());
  git(values.root, ['add', 'app.js']);
  commit(values.root, 'implementation');
  const subject = {
    kind: 'commit',
    base_sha: String(git(values.root, ['rev-parse', 'HEAD^'])).trim(),
    head_sha: String(git(values.root, ['rev-parse', 'HEAD'])).trim(),
    tree_sha: String(git(values.root, ['rev-parse', 'HEAD^{tree}'])).trim()
  };
  const closure = beginCommitClosureReview(values.root, subject);
  const started = beginCollaborationReview(values.root, {
    env: values.env,
    commitSubjectSha256: closure.subject_sha256
  });
  assert.equal(started.available, true);
  assert.equal(started.fingerprint, 'clean');
  assert.equal(started.commit_subject_sha256, closure.subject_sha256);
  const repeatedClosure = beginCommitClosureReview(values.root, subject);
  const repeatedRound = beginCollaborationReview(values.root, {
    env: values.env,
    commitSubjectSha256: repeatedClosure.subject_sha256
  });
  assert.equal(repeatedClosure.generation, closure.generation);
  assert.equal(repeatedRound.round_id, started.round_id);
  assert.equal(repeatedRound.reused, true);
  assert.equal(readState(values.root).review_agents.started.length, 2);

  appendRows(values.transcript, cleanRows(closure.subject_sha256));
  const imported = importCollaborationReview(values.root, { env: values.env });
  assert.equal(imported.imported, true);
  assert.equal(readState(values.root).review_agents.completed.length, 2);
  const gated = runGate(values);
  assert.equal(gated.status, 0, gated.stderr);
  assert.equal(isCurrentPass(readState(values.root), 'review'), true);
});

test('schema v6 active collaboration round invalidates pre-two-view ownership', (t) => {
  const values = fixture();
  t.after(() => values.cleanup());
  const started = beginCollaborationReview(values.root, { env: values.env });
  const statePath = resolveStatePath(values.root);
  const legacy = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  legacy.schema_version = 6;
  delete legacy.review_agents.collaboration_round_id;
  legacy.review_agents.started.push({
    agent_id: `collaboration:${started.round_id}:sd0x_reviewer`,
    agent_type: 'sd0x_reviewer',
    recorded_at: new Date().toISOString()
  });
  fs.writeFileSync(statePath, JSON.stringify(legacy));

  const migrated = readState(values.root);
  assert.equal(migrated.review_agents.collaboration_round_id, null);
  assert.deepEqual(migrated.review_agents.started, []);
  assert.deepEqual(migrated.review_agents.completed, []);
  assert.equal(migrated.gates.review.status, 'pending');
});

test('schema v6 imported three-view round invalidates gates and results', (t) => {
  const values = fixture();
  t.after(() => values.cleanup());
  const started = beginCollaborationReview(values.root, { env: values.env });
  appendRows(values.transcript, cleanRows());
  importCollaborationReview(values.root, { env: values.env });
  markGate(values.root, 'review', 'pass', passEvidence());
  const statePath = resolveStatePath(values.root);
  const legacy = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  legacy.schema_version = 6;
  delete legacy.review_agents.collaboration_round_id;
  legacy.gates.review.evidence.reviewers = 3;
  legacy.gates.review.evidence.agents = [
    'sd0x_codex_primary_reviewer',
    'sd0x_reviewer',
    'sd0x_test_reviewer'
  ];
  legacy.review_agents.completed.push({
    agent_id: `collaboration-result:${started.round_id}:legacy-implementation`,
    agent_type: 'sd0x_reviewer',
    recorded_at: new Date().toISOString(),
    started_at: new Date().toISOString(),
    result_sha256: '3'.repeat(64),
    outcome: 'clean',
    has_transcript: true
  });
  fs.writeFileSync(statePath, JSON.stringify(legacy));

  const migrated = readState(values.root);
  assert.equal(migrated.review_agents.collaboration_round_id, null);
  assert.deepEqual(migrated.review_agents.completed, []);
  assert.equal(migrated.gates.review.status, 'pending');
});

test('schema v6 migration discards ordered completed-round history', (t) => {
  const values = fixture();
  t.after(() => values.cleanup());
  beginCollaborationReview(values.root, { env: values.env });
  appendRows(values.transcript, cleanRows());
  assert.equal(runGate(values).status, 0);
  const second = beginCollaborationReview(values.root, { env: values.env });
  appendRows(values.transcript, cleanRows());
  assert.equal(runGate(values).status, 0);

  const statePath = resolveStatePath(values.root);
  const legacy = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  legacy.schema_version = 6;
  delete legacy.review_agents.collaboration_round_id;
  fs.writeFileSync(statePath, JSON.stringify(legacy));

  const migrated = readState(values.root);
  assert.equal(migrated.review_agents.collaboration_round_id, null);
  assert.deepEqual(migrated.review_agents.completed, []);
  assert.equal(isCurrentPass(migrated, 'review'), false);
});

test('schema v6 migration invalidates conflicting active collaboration rounds', (t) => {
  const values = fixture();
  t.after(() => values.cleanup());
  beginCollaborationReview(values.root, { env: values.env });
  const statePath = resolveStatePath(values.root);
  const legacy = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  legacy.schema_version = 6;
  delete legacy.review_agents.collaboration_round_id;
  legacy.review_agents.started.push({
    agent_id: `collaboration:conflicting-round:${REVIEWERS[0]}`,
    agent_type: REVIEWERS[0],
    recorded_at: new Date().toISOString()
  });
  fs.writeFileSync(statePath, JSON.stringify(legacy));

  const migrated = readState(values.root);
  assert.equal(migrated.review_agents.collaboration_round_id, null);
  assert.deepEqual(migrated.review_agents.started, []);
  assert.deepEqual(migrated.review_agents.completed, []);
  assert.equal(migrated.gates.review.status, 'pending');
});

test('collaboration adapter rejects interrupted, forged, and missing reviewers', (t) => {
  const values = fixture();
  t.after(() => values.cleanup());
  beginCollaborationReview(values.root, { env: values.env });
  appendRows(values.transcript, [
    activity(REVIEWERS[0]),
    finalMessage(REVIEWERS[0], 'No actionable findings remain.', {
      sender: '/root/sd0x_reviewer'
    }),
    activity(REVIEWERS[1]),
    activity(REVIEWERS[1], 'interrupted', '2'),
    finalMessage(REVIEWERS[1], 'No actionable findings remain.'),
  ]);
  assert.throws(
    () => importCollaborationReview(values.root, { env: values.env }),
    /no terminal result: sd0x_codex_primary_reviewer/
  );
  assert.equal(readState(values.root).review_agents.completed.length, 0);
});

test('collaboration adapter binds evidence to transcript identity and worktree fingerprint', (t) => {
  const values = fixture();
  t.after(() => values.cleanup());
  beginCollaborationReview(values.root, { env: values.env });
  appendRows(values.transcript, cleanRows());
  fs.writeFileSync(path.join(values.root, 'other.js'), 'module.exports = true;\n');
  assert.throws(
    () => importCollaborationReview(values.root, { env: values.env }),
    /marker is stale for the current worktree/
  );
  fs.rmSync(path.join(values.root, 'other.js'));

  const otherHome = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-other-home-'));
  t.after(() => fs.rmSync(otherHome, { recursive: true, force: true }));
  const otherTranscript = path.join(
    otherHome,
    'sessions',
    '2026',
    '07',
    '12',
    path.basename(values.transcript)
  );
  fs.mkdirSync(path.dirname(otherTranscript), { recursive: true });
  fs.copyFileSync(values.transcript, otherTranscript);
  assert.throws(
    () => importCollaborationReview(values.root, {
      env: { ...values.env, CODEX_HOME: otherHome }
    }),
    /transcript identity changed/
  );

  assert.throws(
    () => importCollaborationReview(values.root, {
      env: values.env,
      beforeRecord() {
        fs.writeFileSync(path.join(values.root, 'raced.js'), 'module.exports = true;\n');
      }
    }),
    /stale for the current runtime state/
  );
  assert.equal(readState(values.root).review_agents.completed.length, 0);
  fs.rmSync(path.join(values.root, 'raced.js'));
});

test('collaboration adapter rejects prefix replacement and reset-era replay', (t) => {
  const values = fixture();
  t.after(() => values.cleanup());
  beginCollaborationReview(values.root, { env: values.env });
  const original = fs.readFileSync(values.transcript);
  const replaced = Buffer.from(original);
  replaced[0] = replaced[0] === 123 ? 91 : 123;
  fs.writeFileSync(values.transcript, replaced);
  appendRows(values.transcript, cleanRows());
  assert.throws(
    () => importCollaborationReview(values.root, { env: values.env }),
    /transcript prefix changed/
  );

  fs.writeFileSync(values.transcript, original);
  resetState(values.root);
  beginCollaborationReview(values.root, { env: values.env });
  appendRows(values.transcript, cleanRows());
  resetState(values.root);
  assert.equal(fs.existsSync(markerPath(values.root)), true);
  assert.throws(
    () => importCollaborationReview(values.root, { env: values.env }),
    /stale for the current runtime state/
  );
  assert.equal(readState(values.root).review_agents.completed.length, 0);
});

test('collaboration begin preserves an active round until fingerprint change', (t) => {
  const values = fixture();
  t.after(() => values.cleanup());
  const first = beginCollaborationReview(values.root, { env: values.env });
  appendRows(values.transcript, [
    activity(REVIEWERS[1]),
    finalMessage(REVIEWERS[1], '[P1] app.js:1 finding must not be skipped.')
  ]);
  assert.throws(
    () => beginCollaborationReview(values.root, { env: values.env }),
    /already active for this fingerprint/
  );
  assert.equal(
    JSON.parse(fs.readFileSync(markerPath(values.root), 'utf8')).transcript_offset,
    first.transcript_offset
  );

  fs.writeFileSync(path.join(values.root, 'other.js'), 'module.exports = true;\n');
  const replacement = beginCollaborationReview(values.root, { env: values.env });
  assert.notEqual(replacement.fingerprint, first.fingerprint);

  const lockPath = `${markerPath(values.root)}.lock`;
  fs.mkdirSync(lockPath);
  fs.writeFileSync(path.join(lockPath, 'owner'), String(process.pid));
  assert.throws(
    () => beginCollaborationReview(values.root, { env: values.env }),
    /updated concurrently/
  );
  fs.rmSync(lockPath, { recursive: true, force: true });
});

test('collaboration begin reclaims a dead marker-lock owner', (t) => {
  const values = fixture();
  t.after(() => values.cleanup());
  const lockPath = `${markerPath(values.root)}.lock`;
  fs.mkdirSync(lockPath, { recursive: true });
  fs.writeFileSync(path.join(lockPath, 'owner'), '99999999');
  const started = beginCollaborationReview(values.root, { env: values.env });
  assert.equal(started.available, true);
  assert.equal(fs.existsSync(lockPath), false);
});

test('collaboration marker lock never reclaims an old live owner', (t) => {
  const values = fixture();
  t.after(() => values.cleanup());
  const lockPath = `${markerPath(values.root)}.lock`;
  fs.mkdirSync(lockPath, { recursive: true });
  fs.writeFileSync(path.join(lockPath, 'owner'), String(process.pid));
  const old = new Date(Date.now() - 60_000);
  fs.utimesSync(lockPath, old, old);
  assert.throws(
    () => beginCollaborationReview(values.root, { env: values.env }),
    /updated concurrently/
  );
  assert.equal(
    fs.readFileSync(path.join(lockPath, 'owner'), 'utf8'),
    String(process.pid)
  );
  fs.rmSync(lockPath, { recursive: true, force: true });
});

test('collaboration marker lock retries when the lock disappears before inspection',
  (t) => {
    const values = fixture();
    t.after(() => values.cleanup());
    const lockPath = `${markerPath(values.root)}.lock`;
    fs.mkdirSync(lockPath, { recursive: true });
    fs.writeFileSync(path.join(lockPath, 'owner'), '99999999');
    let removed = false;
    const result = withMarkerLock(values.root, () => 'acquired', {
      beforeInspect(candidate) {
        if (removed) return;
        removed = true;
        fs.rmSync(candidate, { recursive: true, force: true });
      }
    });
    assert.equal(result, 'acquired');
    assert.equal(removed, true);
    assert.equal(fs.existsSync(lockPath), false);
  });

test('collaboration marker lock retries when the lock disappears before reclaim',
  (t) => {
    const values = fixture();
    t.after(() => values.cleanup());
    const lockPath = `${markerPath(values.root)}.lock`;
    fs.mkdirSync(lockPath, { recursive: true });
    fs.writeFileSync(path.join(lockPath, 'owner'), '99999999');
    let removed = false;
    const result = withMarkerLock(values.root, () => 'acquired', {
      beforeReclaim(candidate) {
        if (removed) return;
        removed = true;
        fs.rmSync(candidate, { recursive: true, force: true });
      }
    });
    assert.equal(result, 'acquired');
    assert.equal(removed, true);
    assert.equal(fs.existsSync(lockPath), false);
  });

test('collaboration parser requires exact direct paths and terminal latest attempts', () => {
  const nested = REVIEWERS.flatMap((agentType) => {
    const rows = [activity(agentType), finalMessage(agentType,
      'No actionable findings remain.')];
    rows[0].payload.agent_path = `/root/decoy/${agentType}`;
    rows[1].payload.author = `/root/decoy/${agentType}`;
    rows[1].payload.recipient = '/root/decoy';
    rows[1].payload.content[0].text = rows[1].payload.content[0].text
      .replace('Task name: /root', 'Task name: /root/decoy')
      .replace(`Sender: /root/${agentType}`, `Sender: /root/decoy/${agentType}`);
    return rows;
  });
  assert.throws(
    () => parseCollaborationEvents(
      `${nested.map((row) => JSON.stringify(row)).join('\n')}\n`,
      REVIEWERS,
      '/root'
    ),
    /no terminal result/
  );

  const pending = cleanRows();
  pending.push(activity(REVIEWERS[0], 'interacted', '3'));
  assert.throws(
    () => parseCollaborationEvents(
      `${pending.map((row) => JSON.stringify(row)).join('\n')}\n`,
      REVIEWERS
    ),
    /has no terminal result/
  );

  const interrupted = cleanRows();
  interrupted.push(
    activity(REVIEWERS[0], 'interacted', '3'),
    activity(REVIEWERS[0], 'interrupted', '4'),
    activity(REVIEWERS[0], 'interacted', '5'),
    finalMessage(REVIEWERS[0], 'No actionable findings remain.')
  );
  assert.throws(
    () => parseCollaborationEvents(
      `${interrupted.map((row) => JSON.stringify(row)).join('\n')}\n`,
      REVIEWERS
    ),
    /was interrupted/
  );

  const overlapping = cleanRows();
  overlapping.push(
    activity(REVIEWERS[0], 'interacted', '3'),
    activity(REVIEWERS[0], 'interacted', '4'),
    finalMessage(REVIEWERS[0], 'No actionable findings remain.')
  );
  assert.throws(
    () => parseCollaborationEvents(
      `${overlapping.map((row) => JSON.stringify(row)).join('\n')}\n`,
      REVIEWERS
    ),
    /overlapping starts/
  );

  const missingIdentity = cleanRows();
  const malformed = activity(REVIEWERS[0], 'interrupted', '8');
  delete malformed.payload.event_id;
  missingIdentity.push(malformed);
  assert.throws(
    () => parseCollaborationEvents(
      `${missingIdentity.map((row) => JSON.stringify(row)).join('\n')}\n`,
      REVIEWERS
    ),
    /Malformed collaboration activity/
  );

  const unknownKind = cleanRows();
  unknownKind.push(activity(REVIEWERS[0], 'paused', '9'));
  assert.throws(
    () => parseCollaborationEvents(
      `${unknownKind.map((row) => JSON.stringify(row)).join('\n')}\n`,
      REVIEWERS
    ),
    /Malformed collaboration activity/
  );

  const renamedPayload = cleanRows();
  const drifted = activity(REVIEWERS[0], 'interrupted', '8');
  drifted.payload.type = 'sub_agent_state';
  renamedPayload.push(drifted);
  assert.throws(
    () => parseCollaborationEvents(
      `${renamedPayload.map((row) => JSON.stringify(row)).join('\n')}\n`,
      REVIEWERS
    ),
    /Malformed collaboration activity/
  );
});

test('a new collaboration round suspends an existing review pass', (t) => {
  const values = fixture();
  t.after(() => values.cleanup());
  beginCollaborationReview(values.root, { env: values.env });
  appendRows(values.transcript, cleanRows());
  const first = runGate(values);
  assert.equal(first.status, 0, first.stderr);
  assert.equal(isCurrentPass(readState(values.root), 'review'), true);

  beginCollaborationReview(values.root, { env: values.env });
  const state = readState(values.root);
  assert.equal(isCurrentPass(state, 'review'), false);
  assert.equal(state.review_agents.started.length, 2);
  assert.deepEqual(nextAction(state), {
    action: 'review',
    reason: 'review-in-progress'
  });
  assert.throws(() => recordVerification(values.root, 'pass', {
    runner: 'sd0x-deterministic-v1',
    commands: [{ command: 'node --test fixture', exit_code: 0 }]
  }, state.worktree.fingerprint, 'codex'), /requires a current review pass/);
});

test('native reviewer hooks can complete an unavailable collaboration round', (t) => {
  const values = fixture();
  t.after(() => values.cleanup());
  beginCollaborationReview(values.root, { env: values.env });
  appendRows(values.transcript, cleanRows());
  assert.equal(runGate(values).status, 0);

  const unavailable = beginCollaborationReview(values.root, { env: {} });
  assert.equal(unavailable.available, false);
  assert.equal(isCurrentPass(readState(values.root), 'review'), false);
  for (const agentType of REVIEWERS) {
    const agentId = `native-${agentType}`;
    recordSubagent(values.root, 'start', { agent_id: agentId, agent_type: agentType });
    recordSubagent(values.root, 'stop', {
      agent_id: agentId,
      agent_type: agentType,
      last_assistant_message: 'No actionable findings remain.'
    });
  }
  assert.equal(readState(values.root).review_agents.started.length, 0);
  assert.equal(isCurrentPass(readState(values.root), 'review'), true);
});

test('reset-stale and malformed markers do not block native fallback rounds', (t) => {
  const values = fixture();
  t.after(() => values.cleanup());
  beginCollaborationReview(values.root, { env: values.env });
  resetState(values.root);
  const unavailable = beginCollaborationReview(values.root, { env: {} });
  assert.equal(unavailable.available, false);
  assert.equal(fs.existsSync(markerPath(values.root)), false);
  for (const agentType of REVIEWERS) {
    const agentId = `fallback-${agentType}`;
    recordSubagent(values.root, 'start', { agent_id: agentId, agent_type: agentType });
    recordSubagent(values.root, 'stop', {
      agent_id: agentId,
      agent_type: agentType,
      last_assistant_message: 'No actionable findings remain.'
    });
  }
  assert.equal(runGate(values).status, 0);

  resetState(values.root);
  fs.writeFileSync(markerPath(values.root), '{malformed');
  const recovered = beginCollaborationReview(values.root, { env: {} });
  assert.equal(recovered.available, false);
  assert.equal(fs.existsSync(markerPath(values.root)), false);
  assert.ok(fs.readdirSync(path.dirname(markerPath(values.root))).some((name) =>
    name.startsWith('collaboration-review.json.corrupt.')
  ));
});

test('concurrent valid gate attempts complete idempotently', async (t) => {
  const values = fixture();
  t.after(() => values.cleanup());
  beginCollaborationReview(values.root, { env: values.env });
  appendRows(values.transcript, cleanRows());
  const results = await Promise.all([
    runGateAsync(values),
    runGateAsync(values)
  ]);
  assert.deepEqual(results.map((result) => result.status), [0, 0],
    results.map((result) => result.stderr).join('\n'));
  assert.equal(isCurrentPass(readState(values.root), 'review'), true);
  assert.equal(fs.existsSync(markerPath(values.root)), false);
});

test('delayed completion cannot remove a newer same-fingerprint round', (t) => {
  const values = fixture();
  t.after(() => values.cleanup());
  const first = beginCollaborationReview(values.root, { env: values.env });
  appendRows(values.transcript, cleanRows());
  const imported = importCollaborationReview(values.root, { env: values.env });
  markGate(values.root, 'review', 'pass', passEvidence());
  completeCollaborationReview(values.root, {
    expectedFingerprint: imported.fingerprint,
    expectedProvider: imported.provider,
    expectedRuntimeEpoch: imported.runtime_epoch,
    expectedRoundId: imported.round_id
  });

  const second = beginCollaborationReview(values.root, { env: values.env });
  assert.notEqual(second.round_id, first.round_id);
  assert.throws(() => completeCollaborationReview(values.root, {
    expectedFingerprint: imported.fingerprint,
    expectedProvider: imported.provider,
    expectedRuntimeEpoch: imported.runtime_epoch,
    expectedRoundId: imported.round_id
  }), /cannot finalize before its gate passes/);
  assert.equal(
    JSON.parse(fs.readFileSync(markerPath(values.root), 'utf8')).round_id,
    second.round_id
  );
});

test('delayed gate recovery cannot fail a newer same-fingerprint round', (t) => {
  const values = fixture();
  t.after(() => values.cleanup());
  beginCollaborationReview(values.root, { env: values.env });
  appendRows(values.transcript, cleanRows());
  let successor;
  const status = runReviewGate('pass', [
    '--evidence',
    JSON.stringify(passEvidence())
  ], values.root, {
    env: values.env,
    beforeRescan(imported) {
      completeCollaborationReview(values.root, {
        expectedFingerprint: imported.fingerprint,
        expectedProvider: imported.provider,
        expectedRuntimeEpoch: imported.runtime_epoch,
        expectedRoundId: imported.round_id
      });
      successor = beginCollaborationReview(values.root, { env: values.env });
      appendRows(values.transcript, cleanRows());
      const successorImport = importCollaborationReview(values.root, {
        env: values.env
      });
      markGate(values.root, 'review', 'pass', passEvidence());
      completeCollaborationReview(values.root, {
        expectedFingerprint: successorImport.fingerprint,
        expectedProvider: successorImport.provider,
        expectedRuntimeEpoch: successorImport.runtime_epoch,
        expectedRoundId: successorImport.round_id
      });
    }
  });
  const state = readState(values.root);
  assert.equal(status, 0);
  assert.equal(state.gates.review.status, 'pass');
  assert.equal(isCurrentPass(state, 'review'), true);
  assert.equal(state.review_agents.collaboration_round_id, successor.round_id);
  assert.equal(fs.existsSync(markerPath(values.root)), false);
});

test('superseded gate returns nonzero when its late finding revokes the successor',
  (t) => {
    const values = fixture();
    t.after(() => values.cleanup());
    beginCollaborationReview(values.root, { env: values.env });
    appendRows(values.transcript, cleanRows());
    let original;
    let successor;
    const status = runReviewGate('pass', [
      '--evidence',
      JSON.stringify(passEvidence())
    ], values.root, {
      env: values.env,
      beforeRescan(imported) {
        original = imported;
        appendRows(values.transcript, [
          activity(REVIEWERS[0], 'interacted', '8'),
          finalMessage(REVIEWERS[0], '[P1] app.js:1 late prior-round finding.')
        ]);
      },
      beforeRescanRecord() {
        completeCollaborationReview(values.root, {
          expectedFingerprint: original.fingerprint,
          expectedProvider: original.provider,
          expectedRuntimeEpoch: original.runtime_epoch,
          expectedRoundId: original.round_id
        });
        successor = beginCollaborationReview(values.root, { env: values.env });
        appendRows(values.transcript, cleanRows());
        const successorImport = importCollaborationReview(values.root, {
          env: values.env
        });
        markGate(values.root, 'review', 'pass', passEvidence());
        completeCollaborationReview(values.root, {
          expectedFingerprint: successorImport.fingerprint,
          expectedProvider: successorImport.provider,
          expectedRuntimeEpoch: successorImport.runtime_epoch,
          expectedRoundId: successorImport.round_id
        });
      }
    });
    const state = readState(values.root);
    assert.equal(status, 1);
    assert.equal(state.review_agents.collaboration_round_id, successor.round_id);
    assert.equal(state.gates.review.status, 'fail');
    assert.equal(state.gates.verify.status, 'pending');
    assert.equal(fs.existsSync(markerPath(values.root)), false);
});

test('delayed import cannot reclaim ownership from a completed successor round',
  (t) => {
    const values = fixture();
    t.after(() => values.cleanup());
    const first = beginCollaborationReview(values.root, { env: values.env });
    appendRows(values.transcript, cleanRows());
    const firstImport = importCollaborationReview(values.root, { env: values.env });
    markGate(values.root, 'review', 'pass', passEvidence());
    appendRows(values.transcript, [
      activity(REVIEWERS[0], 'interacted', '8'),
      finalMessage(REVIEWERS[0], '[P1] app.js:1 delayed prior-round finding.')
    ]);
    let second;
    let completedBefore;
    const delayed = importCollaborationReview(values.root, {
      env: values.env,
      beforeRecord() {
        completeCollaborationReview(values.root, {
          expectedFingerprint: firstImport.fingerprint,
          expectedProvider: firstImport.provider,
          expectedRuntimeEpoch: firstImport.runtime_epoch,
          expectedRoundId: firstImport.round_id
        });
        second = beginCollaborationReview(values.root, { env: values.env });
        appendRows(values.transcript, cleanRows());
        const secondImport = importCollaborationReview(values.root, {
          env: values.env
        });
        markGate(values.root, 'review', 'pass', passEvidence());
        completeCollaborationReview(values.root, {
          expectedFingerprint: secondImport.fingerprint,
          expectedProvider: secondImport.provider,
          expectedRuntimeEpoch: secondImport.runtime_epoch,
          expectedRoundId: secondImport.round_id
        });
        completedBefore = readState(values.root).review_agents.completed.length;
      }
    });
    assert.equal(delayed.results.some((entry) => entry.outcome === 'findings'), true);

    const failure = recordCollaborationFailure(values.root, {
      expected_fingerprint: first.fingerprint,
      expected_provider: first.provider,
      expected_runtime_epoch: first.runtime_epoch,
      expected_round_id: first.round_id
    }, {
      provider: first.provider,
      reviewers: 2,
      agents: REVIEWERS,
      findings: 1,
      summary: 'delayed superseded round failure'
    });
    const state = readState(values.root);
    assert.equal(failure.recorded, false);
    assert.equal(failure.reason, 'round-superseded');
    assert.equal(state.review_agents.collaboration_round_id, second.round_id);
    assert.equal(state.review_agents.completed.length, completedBefore + 1);
    assert.equal(state.gates.review.status, 'fail');
    assert.equal(state.gates.verify.status, 'pending');
  });

test('marker-missing completion rechecks the physical worktree', (t) => {
  const values = fixture();
  t.after(() => values.cleanup());
  beginCollaborationReview(values.root, { env: values.env });
  appendRows(values.transcript, cleanRows());
  const imported = importCollaborationReview(values.root, { env: values.env });
  markGate(values.root, 'review', 'pass', passEvidence());
  completeCollaborationReview(values.root, {
    expectedFingerprint: imported.fingerprint,
    expectedProvider: imported.provider,
    expectedRuntimeEpoch: imported.runtime_epoch,
    expectedRoundId: imported.round_id
  });
  fs.writeFileSync(path.join(values.root, 'changed.js'), 'module.exports = true;\n');
  assert.deepEqual(completeCollaborationReview(values.root, {
    expectedFingerprint: imported.fingerprint,
    expectedProvider: imported.provider,
    expectedRuntimeEpoch: imported.runtime_epoch,
    expectedRoundId: imported.round_id
  }), { completed: false, reason: 'marker-missing' });
});

test('concurrent reset prevents marker completion without restoring stale gates', (t) => {
  const values = fixture();
  t.after(() => values.cleanup());
  beginCollaborationReview(values.root, { env: values.env });
  appendRows(values.transcript, cleanRows());
  importCollaborationReview(values.root, { env: values.env });
  markGate(values.root, 'review', 'pass', passEvidence());
  const before = readState(values.root).runtime_epoch;
  assert.throws(
    () => completeCollaborationReview(values.root, {
      beforeRemove() {
        resetState(values.root);
      }
    }),
    /changed before marker completion/
  );
  const after = readState(values.root);
  assert.notEqual(after.runtime_epoch, before);
  assert.equal(after.gates.review.status, 'pending');
  assert.equal(fs.existsSync(markerPath(values.root)), true);
});

test('worktree edit during completion returns the new fingerprint to review-required', (t) => {
  const values = fixture();
  t.after(() => values.cleanup());
  beginCollaborationReview(values.root, { env: values.env });
  appendRows(values.transcript, cleanRows());
  importCollaborationReview(values.root, { env: values.env });
  markGate(values.root, 'review', 'pass', passEvidence());
  const previousFingerprint = readState(values.root).worktree.fingerprint;
  assert.throws(
    () => completeCollaborationReview(values.root, {
      beforeRemove() {
        fs.writeFileSync(path.join(values.root, 'raced.js'), 'module.exports = true;\n');
      }
    }),
    /changed before marker completion/
  );
  const current = refreshState(values.root);
  assert.notEqual(current.worktree.fingerprint, previousFingerprint);
  assert.equal(current.gates.review.status, 'pending');
  assert.equal(fs.existsSync(markerPath(values.root)), true);
});

test('conditional collaboration failure never binds to edited bytes', (t) => {
  const values = fixture();
  t.after(() => values.cleanup());
  const started = beginCollaborationReview(values.root, { env: values.env });
  const result = recordCollaborationFailure(values.root, {
    expected_fingerprint: started.fingerprint,
    expected_provider: started.provider,
    expected_runtime_epoch: started.runtime_epoch,
    expected_round_id: started.round_id,
    before_record() {
      fs.writeFileSync(path.join(values.root, 'changed.js'), 'module.exports = true;\n');
    }
  }, {
    provider: 'codex',
    reviewers: 2,
    agents: REVIEWERS,
    findings: 1,
    summary: 'collaboration evidence changed'
  });
  assert.equal(result.recorded, false);
  assert.equal(result.state.gates.review.status, 'pending');
  assert.notEqual(result.state.worktree.fingerprint, started.fingerprint);
});

test('collaboration finalization observes late reviewer findings', (t) => {
  const values = fixture();
  t.after(() => values.cleanup());
  beginCollaborationReview(values.root, { env: values.env });
  appendRows(values.transcript, cleanRows());
  importCollaborationReview(values.root, { env: values.env });
  markGate(values.root, 'review', 'pass', passEvidence());
  appendRows(values.transcript, [
    activity(REVIEWERS[1], 'interacted', '7'),
    finalMessage(REVIEWERS[1], '[P1] app.js:1 late regression remains.')
  ]);
  const gated = runGate(values);
  assert.notEqual(gated.status, 0);
  assert.equal(isCurrentPass(readState(values.root), 'review'), false);
  assert.equal(readState(values.root).gates.review.status, 'fail');
});

test('failed gate evidence retains the round boundary for a corrected retry', (t) => {
  const values = fixture();
  t.after(() => values.cleanup());
  beginCollaborationReview(values.root, { env: values.env });
  appendRows(values.transcript, cleanRows());
  const invalid = runGate(values, {
    provider: 'codex',
    reviewers: 2,
    agents: REVIEWERS.slice(0, 1),
    findings: 0
  });
  assert.notEqual(invalid.status, 0);
  assert.equal(fs.existsSync(markerPath(values.root)), true);

  appendRows(values.transcript, [
    activity(REVIEWERS[1], 'interacted', '7'),
    finalMessage(REVIEWERS[1], '[P1] app.js:1 late regression remains.')
  ]);
  const corrected = runGate(values);
  assert.notEqual(corrected.status, 0);
  assert.equal(readState(values.root).gates.review.status, 'fail');
  assert.equal(fs.existsSync(markerPath(values.root)), true);
});

test('collaboration findings remain blocking and malformed JSONL fails closed', (t) => {
  const values = fixture();
  t.after(() => values.cleanup());
  beginCollaborationReview(values.root, { env: values.env });
  appendRows(values.transcript, REVIEWERS.flatMap((agentType, index) => [
    activity(agentType),
    finalMessage(agentType, index === 1
      ? '[P2] app.js:1 regression remains.'
      : 'No actionable findings remain.')
  ]));
  const imported = importCollaborationReview(values.root, { env: values.env });
  assert.equal(imported.results[1].outcome, 'findings');
  assert.throws(() => markGate(values.root, 'review', 'pass', {
    provider: 'codex',
    reviewers: 2,
    agents: REVIEWERS,
    findings: 0
  }), /unresolved findings|terminal findings|clean terminal results/);

  assert.throws(
    () => parseCollaborationEvents('{not json}\n', REVIEWERS),
    /malformed JSONL/
  );
});
