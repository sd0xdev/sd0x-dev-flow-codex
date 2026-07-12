'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { execFileSync } = require('node:child_process');
const {
  EVIDENCE_REF,
  appendEvidenceRevision,
  auditEvidenceLedger,
  canonicalEvidenceBlob,
  canonicalJson,
  finalizeRequestClosure,
  markGate,
  prepareRequestClosure,
  recordPromotionEvidence,
  recordSubagent,
  recordVerification,
  refreshState,
  readEvidenceRecord
} = require('../plugin/sd0x-dev-flow-codex/scripts/runtime/state');
const { snapshot } = require('../plugin/sd0x-dev-flow-codex/scripts/runtime/worktree');
const { commit, git, initRepository, isolateGitEnvironment } = require('./helpers/git');

isolateGitEnvironment();

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function repository() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-evidence-'));
  initRepository(root);
  fs.writeFileSync(path.join(root, 'app.js'), 'module.exports = 1;\n');
  fs.mkdirSync(path.join(root, 'docs', 'features', 'fixture', 'requests'), {
    recursive: true
  });
  fs.writeFileSync(path.join(root, 'docs', 'features', 'fixture', 'requests',
    '2026-07-12-fixture.md'), [
    '# Fixture',
    '',
    '> **Status**: In Progress',
    '',
    '## Scope',
    '',
    'Exercise closure.',
    '',
    '## Acceptance Criteria',
    '',
    '- [ ] Evidence is durable.',
    ''
  ].join('\n'));
  git(root, ['add', '.']);
  commit(root, 'baseline');
  fs.writeFileSync(path.join(root, 'app.js'), 'module.exports = 2;\n');
  return root;
}

function completedRequestBytes() {
  return [
    '# Fixture',
    '',
    '> **Status**: Completed',
    '',
    '## Scope',
    '',
    'Exercise closure.',
    '',
    '## Acceptance Criteria',
    '',
    '- [x] Evidence is durable.',
    ''
  ].join('\n');
}

function recordCleanReview(root) {
  refreshState(root);
  for (const agentType of [
    'sd0x_codex_primary_reviewer', 'sd0x_reviewer', 'sd0x_test_reviewer'
  ]) {
    recordSubagent(root, 'start', { agent_id: agentType, agent_type: agentType });
    recordSubagent(root, 'stop', {
      agent_id: agentType,
      agent_type: agentType,
      last_assistant_message: 'No actionable findings remain.'
    });
  }
  return markGate(root, 'review', 'pass', {
    provider: 'codex',
    reviewers: 3,
    agents: ['sd0x_codex_primary_reviewer', 'sd0x_reviewer', 'sd0x_test_reviewer'],
    findings: 0
  });
}

function evidenceGit(root, args, options = {}) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    input: options.input,
    env: options.env || process.env
  }).trim();
}

function record(root, details = {}) {
  const blobs = {
    'subject-review.json': { field: 'subject_review_evidence_sha256', value: { clean: true } },
    'verify.json': { field: 'verify_evidence_sha256', value: { exit_code: 0 } },
    'ac.json': { field: 'ac_evidence_sha256', value: { complete: true } },
    'checks.json': { field: 'checks_evidence_sha256', value: { exit_code: 0 } }
  };
  const value = {
    schema_version: 1,
    kind: details.kind || 'request-closure-pending',
    promotion_unit_id: details.unit || 'fixture/default',
    request_path: 'docs/features/fixture/requests/2026-07-12-fixture.md',
    prior_request_content_sha256: '1'.repeat(64),
    proposed_request_content_sha256: '2'.repeat(64),
    ac_definition_sha256: '3'.repeat(64),
    non_request_projection_sha256: '4'.repeat(64),
    subject: { kind: 'fixture' },
    subject_review_evidence_sha256: sha256(canonicalEvidenceBlob(root, blobs['subject-review.json'].value)),
    verify_evidence_sha256: sha256(canonicalEvidenceBlob(root, blobs['verify.json'].value)),
    ac_evidence_sha256: sha256(canonicalEvidenceBlob(root, blobs['ac.json'].value)),
    checks_evidence_sha256: sha256(canonicalEvidenceBlob(root, blobs['checks.json'].value)),
    recorded_at: details.recordedAt || '2026-07-12T00:00:00.000Z',
    supersedes_record_sha256: details.supersedes || null
  };
  value.record_sha256 = sha256(canonicalJson(value));
  return { value, blobs };
}

test('evidence revisions are canonical, parent-linked, CAS-protected, and worktree-neutral', (t) => {
  const root = repository();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const before = snapshot(root).fingerprint;
  const firstBundle = record(root);
  const firstRecord = firstBundle.value;
  const first = appendEvidenceRevision(root, firstRecord, firstBundle.blobs, {
    expected_old_oid: null
  });
  assert.equal(first.old_oid, null);
  assert.equal(snapshot(root).fingerprint, before);
  assert.deepEqual(readEvidenceRecord(root, firstRecord.record_sha256).record, firstRecord);

  const secondBundle = record(root, {
    supersedes: firstRecord.record_sha256,
    recordedAt: '2026-07-12T00:01:00.000Z'
  });
  const secondRecord = secondBundle.value;
  const second = appendEvidenceRevision(root, secondRecord, secondBundle.blobs, {
    expected_old_oid: first.oid
  });
  assert.match(String(git(root, ['rev-list', '--parents', '-n', '1', second.oid])),
    new RegExp(`^${second.oid} ${first.oid}`));
  assert.equal(snapshot(root).fingerprint, before);
  const staleBundle = record(root, {
    recordedAt: '2026-07-12T00:02:00.000Z'
  });
  assert.throws(() => appendEvidenceRevision(root, staleBundle.value,
    staleBundle.blobs, { expected_old_oid: first.oid }),
  /compare-and-swap expectation is stale/);
});

test('redaction removes repository, account, and secret data and refuses private keys', (t) => {
  const root = repository();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const blob = canonicalEvidenceBlob(root, {
    path: `${root}/app.js`,
    account: 'person@example.com',
    token: `Bearer ${'a'.repeat(24)}`
  });
  assert.doesNotMatch(blob, new RegExp(root.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(blob, /person@example\.com|Bearer a/);
  assert.match(blob, /<repo>|<account>|<secret>/);
  assert.throws(() => canonicalEvidenceBlob(root, {
    key: '-----BEGIN PRIVATE KEY-----\nunsafe'
  }), /cannot be safely redacted/);
});

test('an explicit fetch transfers the evidence ref to a fresh clone', (t) => {
  const root = repository();
  const clone = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-evidence-clone-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  t.after(() => fs.rmSync(clone, { recursive: true, force: true }));
  const bundle = record(root);
  const value = bundle.value;
  appendEvidenceRevision(root, value, bundle.blobs, { expected_old_oid: null });
  fs.rmSync(clone, { recursive: true });
  git(path.dirname(clone), ['clone', '--quiet', root, clone]);
  assert.throws(() => readEvidenceRecord(clone, value.record_sha256), /Evidence ref is missing/);
  git(clone, ['fetch', 'origin', `${EVIDENCE_REF}:${EVIDENCE_REF}`]);
  assert.deepEqual(readEvidenceRecord(clone, value.record_sha256).record, value);
});

test('an explicit Git bundle transfers the evidence ref offline', (t) => {
  const root = repository();
  const imported = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-evidence-bundle-'));
  const bundlePath = path.join(os.tmpdir(), `sd0x-evidence-${crypto.randomUUID()}.bundle`);
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  t.after(() => fs.rmSync(imported, { recursive: true, force: true }));
  t.after(() => fs.rmSync(bundlePath, { force: true }));
  const bundle = record(root);
  appendEvidenceRevision(root, bundle.value, bundle.blobs, { expected_old_oid: null });
  evidenceGit(root, ['bundle', 'create', bundlePath, EVIDENCE_REF]);
  initRepository(imported);
  evidenceGit(imported, ['fetch', bundlePath, `${EVIDENCE_REF}:${EVIDENCE_REF}`]);
  assert.deepEqual(readEvidenceRecord(imported, bundle.value.record_sha256).record,
    bundle.value);
});

test('request closure prepare and finalize bind proposal, projection, and two reviews', (t) => {
  const root = repository();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const requestPath = 'docs/features/fixture/requests/2026-07-12-fixture.md';
  const pending = prepareRequestClosure(root, {
    promotion_unit_id: 'fixture/default',
    request_path: requestPath,
    proposed_request: completedRequestBytes(),
    subject: { kind: 'dirty', fingerprint: snapshot(root).fingerprint },
    evidence: {
      subject_review: { outcome: 'clean', reviewers: 3 },
      verify: { runner: 'fixture', exit_code: 0 },
      ac: { verdicts: [{ ac: 1, status: 'Complete', confidence: 'High' }] },
      checks: { commands: [{ argv: ['node', '--test'], exit_code: 0 }] }
    },
    recorded_at: '2026-07-12T01:00:00.000Z',
    supersedes_record_sha256: null
  });
  assert.equal(pending.record.kind, 'request-closure-pending');
  fs.writeFileSync(path.join(root, requestPath), completedRequestBytes());
  recordCleanReview(root);
  const closure = finalizeRequestClosure(root, {
    pending_record_sha256: pending.record_sha256,
    recorded_at: '2026-07-12T01:01:00.000Z',
    supersedes_record_sha256: null
  });
  assert.equal(closure.record.kind, 'request-closure');
  assert.equal(closure.record.pending_record_sha256, pending.record_sha256);
  assert.deepEqual(readEvidenceRecord(root, closure.record_sha256).record,
    closure.record);
});

test('closure finalization rejects proposed request and non-request drift', (t) => {
  for (const drift of ['request', 'projection']) {
    const root = repository();
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const requestPath = 'docs/features/fixture/requests/2026-07-12-fixture.md';
    const pending = prepareRequestClosure(root, {
      promotion_unit_id: 'fixture/default',
      request_path: requestPath,
      proposed_request: completedRequestBytes(),
      subject: { kind: 'dirty', fingerprint: snapshot(root).fingerprint },
      evidence: {
        subject_review: { outcome: 'clean' },
        verify: { exit_code: 0 },
        ac: { verdicts: ['Complete'] },
        checks: { exit_code: 0 }
      },
      recorded_at: '2026-07-12T02:00:00.000Z',
      supersedes_record_sha256: null
    });
    fs.writeFileSync(path.join(root, requestPath), completedRequestBytes());
    if (drift === 'request') fs.appendFileSync(path.join(root, requestPath), '\ndrift\n');
    else fs.writeFileSync(path.join(root, 'app.js'), 'module.exports = 3;\n');
    assert.throws(() => finalizeRequestClosure(root, {
      pending_record_sha256: pending.record_sha256,
      recorded_at: '2026-07-12T02:01:00.000Z',
      supersedes_record_sha256: null
    }), drift === 'request' ? /request bytes drifted/ : /projection drifted/);
  }
});

test('promotion records require final closure and current review/verify gates', (t) => {
  const root = repository();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const requestPath = 'docs/features/fixture/requests/2026-07-12-fixture.md';
  const pending = prepareRequestClosure(root, {
    promotion_unit_id: 'fixture/default',
    request_path: requestPath,
    proposed_request: completedRequestBytes(),
    subject: { kind: 'dirty', fingerprint: snapshot(root).fingerprint },
    evidence: {
      subject_review: { outcome: 'clean' },
      verify: { exit_code: 0 },
      ac: { verdicts: ['Complete'] },
      checks: { exit_code: 0 }
    },
    recorded_at: '2026-07-12T03:00:00.000Z',
    supersedes_record_sha256: null
  });
  fs.writeFileSync(path.join(root, requestPath), completedRequestBytes());
  let state = recordCleanReview(root);
  const closure = finalizeRequestClosure(root, {
    pending_record_sha256: pending.record_sha256,
    recorded_at: '2026-07-12T03:01:00.000Z',
    supersedes_record_sha256: null
  });
  assert.throws(() => recordPromotionEvidence(root, {
    kind: 'promotion',
    promotion_unit_id: 'fixture/default',
    request_closure_record_sha256: closure.record_sha256,
    disposition_row: {
      promotion_unit_id: 'fixture/default', target_package: 'core',
      delivery_state: 'candidate'
    },
    payload_tree_sha256: 'a'.repeat(64),
    reason: null,
    recorded_at: '2026-07-12T03:02:00.000Z',
    supersedes_record_sha256: null
  }), /verification pass/);
  state = recordVerification(root, 'pass', {
    runner: 'sd0x-deterministic-v1',
    commands: [{ command: 'node --test', exit_code: 0 }]
  }, state.worktree.fingerprint, 'codex');
  assert.equal(state.gates.verify.status, 'pass');
  const promotion = recordPromotionEvidence(root, {
    kind: 'promotion',
    promotion_unit_id: 'fixture/default',
    request_closure_record_sha256: closure.record_sha256,
    disposition_row: {
      promotion_unit_id: 'fixture/default', target_package: 'core',
      delivery_state: 'candidate'
    },
    payload_tree_sha256: 'a'.repeat(64),
    reason: null,
    recorded_at: '2026-07-12T03:03:00.000Z',
    supersedes_record_sha256: null
  });
  assert.equal(promotion.record.kind, 'promotion');
  assert.equal(promotion.record.request_closure_record_sha256,
    closure.record_sha256);
  assert.equal(snapshot(root).fingerprint, state.worktree.fingerprint);
  const audit = auditEvidenceLedger(root, {
    promotion_unit_id: 'fixture/default',
    kind: 'promotion',
    payload_tree_sha256: 'a'.repeat(64)
  });
  assert.equal(audit.ok, true);
  assert.equal(audit.selected.record_sha256, promotion.record_sha256);
  const retirement = recordPromotionEvidence(root, {
    kind: 'retirement',
    promotion_unit_id: 'fixture/default',
    request_closure_record_sha256: closure.record_sha256,
    disposition_row: {
      promotion_unit_id: 'fixture/default',
      target_package: 'retired',
      delivery_state: 'retired',
      disposition: 'retire',
      license_status: 'approved'
    },
    payload_tree_sha256: null,
    reason: 'Approved fixture retirement.',
    recorded_at: '2026-07-12T03:04:00.000Z',
    supersedes_record_sha256: null
  });
  assert.equal(retirement.record.verify_evidence_sha256, null);
  assert.equal(retirement.record.payload_tree_sha256, null);
  assert.equal(auditEvidenceLedger(root, {
    promotion_unit_id: 'fixture/default', kind: 'retirement'
  }).selected.record_sha256, retirement.record_sha256);
});

test('ledger writer rejects unknown record kinds', (t) => {
  const root = repository();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const bundle = record(root, { kind: 'unknown-transition' });
  assert.throws(() => appendEvidenceRevision(root, bundle.value, bundle.blobs, {
    expected_old_oid: null
  }), /Unsupported evidence record kind/);
});

test('ledger re-audit rejects blob tamper, missing metadata, and divergent history', (t) => {
  for (const corruption of ['blob', 'missing-ref', 'divergence']) {
    const root = repository();
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const bundle = record(root);
    const appended = appendEvidenceRevision(root, bundle.value, bundle.blobs, {
      expected_old_oid: null
    });
    assert.equal(auditEvidenceLedger(root).ok, true);
    if (corruption === 'missing-ref') {
      evidenceGit(root, ['update-ref', '-d', EVIDENCE_REF, appended.oid]);
      assert.throws(() => auditEvidenceLedger(root), /Evidence ref is missing/);
      continue;
    }
    if (corruption === 'divergence') {
      const tree = evidenceGit(root, ['rev-parse', `${appended.oid}^{tree}`]);
      const head = evidenceGit(root, ['rev-parse', 'HEAD']);
      const commitOid = evidenceGit(root, [
        'commit-tree', tree, '-p', appended.oid, '-p', head, '-m', 'divergent evidence'
      ]);
      evidenceGit(root, ['update-ref', EVIDENCE_REF, commitOid, appended.oid]);
      assert.throws(() => auditEvidenceLedger(root), /one parent-linked append chain/);
      continue;
    }
    const indexPath = path.join(root, '.git', `tamper-index-${process.pid}`);
    const env = { ...process.env, GIT_INDEX_FILE: indexPath };
    evidenceGit(root, ['read-tree', `${appended.oid}^{tree}`], { env });
    const blobOid = evidenceGit(root, ['hash-object', '-w', '--stdin'], {
      env,
      input: '{"redactor_version":"sd0x-redactor-v1","value":{"tampered":true}}\n'
    });
    evidenceGit(root, [
      'update-index', '--add', '--cacheinfo',
      `100644,${blobOid},evidence/${bundle.value.record_sha256}/subject-review.json`
    ], { env });
    const tree = evidenceGit(root, ['write-tree'], { env });
    const commitOid = evidenceGit(root, [
      'commit-tree', tree, '-p', appended.oid, '-m', 'tampered evidence'
    ], { env });
    evidenceGit(root, ['update-ref', EVIDENCE_REF, commitOid, appended.oid]);
    fs.rmSync(indexPath, { force: true });
    assert.throws(() => auditEvidenceLedger(root), /blob is missing or corrupt/);
  }
});
