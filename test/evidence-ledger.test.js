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
  attestCommitClosureReview,
  appendEvidenceRevision,
  applyRequestClosure,
  auditEvidenceLedger,
  beginCommitClosureReview,
  canonicalEvidenceBlob,
  canonicalJson,
  commitClosureReviewerContext,
  finalizeRequestClosure,
  markGate,
  prepareRequestClosure,
  recordPromotionEvidence,
  recordSubagent,
  recordVerification,
  recoverRequestClosure,
  refreshState,
  readEvidenceRecord,
  resolveRuntimeMetadataPath,
  resetState
} = require('../plugin/sd0x-dev-flow-codex/scripts/runtime/state');
const { snapshot } = require('../plugin/sd0x-dev-flow-codex/scripts/runtime/worktree');
const { commit, git, initRepository, isolateGitEnvironment } = require('./helpers/git');

isolateGitEnvironment();

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function privateKeyFixture(suffix = '') {
  return `${['-----BEGIN PRIVATE', ' KEY-----'].join('')}${suffix}`;
}

function absoluteFixture(...segments) {
  return ['', ...segments].join('/');
}

function accountFixture() {
  return ['person', 'example.com'].join('@');
}

function bearerFixture(suffix = '') {
  return `${['Bear', 'er '].join('')}${'a'.repeat(24)}${suffix}`;
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
    '',
    '## Progress',
    '',
    '| Phase | Status |',
    '|---|---|',
    '| Acceptance | Pending |',
    ''
  ].join('\n'));
  fs.mkdirSync(path.join(root, 'migration'), { recursive: true });
  fs.mkdirSync(path.join(root, 'plugin', 'sd0x-dev-flow-codex', 'skills', 'fixture'), {
    recursive: true
  });
  fs.writeFileSync(path.join(root, 'plugin', 'sd0x-dev-flow-codex', 'skills',
    'fixture', 'SKILL.md'), '# Fixture skill\n');
  fs.writeFileSync(path.join(root, 'migration', 'source-disposition.json'),
    `${JSON.stringify({ skills: [fixtureDisposition()] }, null, 2)}\n`);
  git(root, ['add', '.']);
  commit(root, 'baseline');
  const implementationBase = String(git(root, ['rev-parse', 'HEAD'])).trim();
  const requestPath = path.join(root, 'docs', 'features', 'fixture', 'requests',
    '2026-07-12-fixture.md');
  const request = fs.readFileSync(requestPath, 'utf8').replace(
    '> **Status**: In Progress',
    `> **Status**: In Progress\n\n> **Implementation Base SHA**: \`${implementationBase}\``
  );
  fs.writeFileSync(requestPath, request);
  git(root, ['add', 'docs/features/fixture/requests/2026-07-12-fixture.md']);
  commit(root, 'add request ticket');
  fs.writeFileSync(path.join(root, 'app.js'), 'module.exports = 2;\n');
  return root;
}

function fixtureDisposition(overrides = {}) {
  return {
    source_name: 'fixture',
    disposition: 'adapt',
    target_package: 'core',
    target_skill: 'fixture',
    target_mode: null,
    delivery_state: 'candidate',
    alias_candidate: false,
    alias_policy: 'none',
    capabilities: ['core'],
    operations: ['read'],
    license_status: 'approved',
    routing_owner: 'fixture',
    promotion_unit_id: 'fixture/default',
    promotion_request: 'docs/features/fixture/requests/2026-07-12-fixture.md',
    wave: 1,
    rationale: 'Fixture.',
    ...overrides
  };
}

function dirtySubject(root) {
  return {
    kind: 'dirty',
    fingerprint: snapshot(root).fingerprint,
    head_sha: String(git(root, ['rev-parse', 'HEAD'])).trim()
  };
}

function durableReviewEvidence(state) {
  return {
    gate: state.gates.review.evidence,
    native_results: state.review_agents.completed,
    external_results: state.external_review.completed,
    subject_bindings: []
  };
}

function passingClosureEvidence(root, subject = dirtySubject(root)) {
  let state = recordCleanReview(root);
  state = recordVerification(root, 'pass', {
    runner: 'sd0x-deterministic-v1',
    commands: [{ command: 'node --test', exit_code: 0 }]
  }, state.worktree.fingerprint, 'codex');
  return {
    subject_review: {
      binding: subject,
      provider: 'codex',
      evidence: durableReviewEvidence(state)
    },
    verify: {
      binding: subject,
      provider: 'codex',
      evidence: state.gates.verify.evidence
    },
    ac: {
      verdicts: [{
        ac: 1,
        status: 'Complete',
        confidence: 'High',
        evidence: ['app.js:1']
      }]
    },
    checks: { commands: [{ argv: ['node', '--test'], exit_code: 0 }] }
  };
}

function passingCommitClosureEvidence(subject) {
  const nativeResults = [
    'sd0x_codex_primary_reviewer', 'sd0x_test_reviewer'
  ].map((agentType, index) => ({
    agent_id: `fixture-${index}`,
    agent_type: agentType,
    recorded_at: '2026-07-12T01:44:00.000Z',
    started_at: '2026-07-12T01:43:00.000Z',
    result_sha256: String(index + 1).repeat(64),
    outcome: 'clean',
    has_transcript: true
  }));
  return {
    subject_review: {
      binding: subject,
      provider: 'codex',
      evidence: {
        gate: { provider: 'codex', reviewers: 2, findings: 0 },
        native_results: nativeResults,
        external_results: [],
        subject_bindings: []
      }
    },
    verify: {
      binding: subject,
      provider: 'codex',
      evidence: { runner: 'fixture', argv: ['node', '--test'], exit_code: 0 }
    },
    ac: {
      verdicts: [{
        ac: 1,
        status: 'Complete',
        confidence: 'High',
        evidence: ['app.js:1']
      }]
    },
    checks: { commands: [{ argv: ['node', '--test'], exit_code: 0 }] }
  };
}

function payloadTreeSha(root) {
  const relative = 'SKILL.md';
  return sha256(Buffer.concat([
    Buffer.from(`${relative}\0`),
    fs.readFileSync(path.join(root, 'plugin', 'sd0x-dev-flow-codex', 'skills',
      'fixture', relative)),
    Buffer.from('\0')
  ]));
}

function completedRequestBytes(rootOrBase) {
  const implementationBase = /^[a-f0-9]{40}$/.test(rootOrBase || '')
    ? rootOrBase
    : /^> \*\*Implementation Base SHA\*\*: `([a-f0-9]{40})`$/m.exec(
      fs.readFileSync(path.join(rootOrBase, 'docs', 'features', 'fixture', 'requests',
        '2026-07-12-fixture.md'), 'utf8')
    )?.[1];
  if (!implementationBase) throw new Error('Fixture requires an implementation base');
  return [
    '# Fixture',
    '',
    '> **Status**: Completed',
    '',
    `> **Implementation Base SHA**: \`${implementationBase}\``,
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

function requestImplementationBase(root) {
  return /^> \*\*Implementation Base SHA\*\*: `([a-f0-9]{40})`$/m.exec(
    fs.readFileSync(path.join(root, 'docs', 'features', 'fixture', 'requests',
      '2026-07-12-fixture.md'), 'utf8')
  )?.[1] || null;
}

function recordCleanReview(root) {
  refreshState(root);
  const commitContext = commitClosureReviewerContext(root);
  const subjectSha = /Commit closure subject SHA-256: ([a-f0-9]{64})\./
    .exec(commitContext || '')?.[1];
  for (const agentType of [
    'sd0x_codex_primary_reviewer', 'sd0x_test_reviewer'
  ]) {
    recordSubagent(root, 'start', { agent_id: agentType, agent_type: agentType });
    recordSubagent(root, 'stop', {
      agent_id: agentType,
      agent_type: agentType,
      last_assistant_message: [
        'No actionable findings remain.',
        subjectSha ? `Commit-Subject-SHA256: ${subjectSha}` : null
      ].filter(Boolean).join('\n'),
      agent_transcript_path: `/tmp/${agentType}.jsonl`
    });
  }
  return markGate(root, 'review', 'pass', {
    provider: 'codex',
    reviewers: 2,
    agents: ['sd0x_codex_primary_reviewer', 'sd0x_test_reviewer'],
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
  const subject = {
    kind: 'dirty',
    fingerprint: '4'.repeat(64),
    head_sha: String(git(root, ['rev-parse', 'HEAD'])).trim()
  };
  const proposedBytes = Buffer.from(completedRequestBytes(root));
  const priorBytes = fs.readFileSync(path.join(root, 'docs', 'features', 'fixture',
    'requests', '2026-07-12-fixture.md'));
  const acFileBytes = Buffer.from('fixture evidence line\n');
  const nativeResults = [
    'sd0x_codex_primary_reviewer', 'sd0x_test_reviewer'
  ].map((agentType, index) => ({
    agent_type: agentType,
    outcome: 'clean',
    has_transcript: true,
    result_sha256: String(index + 1).repeat(64)
  }));
  const blobs = {
    'subject-review.json': {
      field: 'subject_review_evidence_sha256',
      value: {
        binding: subject,
        provider: 'codex',
        evidence: {
          gate: { provider: 'codex', reviewers: 2, findings: 0 },
          native_results: nativeResults,
          external_results: [],
          subject_bindings: []
        }
      }
    },
    'verify.json': {
      field: 'verify_evidence_sha256',
      value: {
        binding: subject,
        provider: 'codex',
        evidence: { runner: 'fixture', argv: ['node', '--test'], exit_code: 0 }
      }
    },
    'ac.json': {
      field: 'ac_evidence_sha256',
      value: {
        verdicts: [{
          ac: 1,
          status: 'Complete',
          confidence: 'High',
          evidence: [{
            location: 'app.js:1',
            path: 'app.js',
            line: 1,
            column: null,
            file_sha256: sha256(acFileBytes),
            line_sha256: sha256(Buffer.from('fixture evidence line')),
            commit_blob_oid: null,
            file_bytes_base64: acFileBytes.toString('base64')
          }]
        }]
      }
    },
    'checks.json': {
      field: 'checks_evidence_sha256',
      value: { commands: [{ argv: ['node', '--test'], exit_code: 0 }] }
    },
    'request.json': {
      field: 'proposed_request_blob_sha256',
      value: {
        encoding: 'base64',
        prior_bytes_base64: priorBytes.toString('base64'),
        prior_sha256: sha256(priorBytes),
        proposed_bytes_base64: proposedBytes.toString('base64'),
        proposed_sha256: sha256(proposedBytes)
      }
    }
  };
  const value = {
    schema_version: 2,
    kind: details.kind || 'request-closure-pending',
    promotion_unit_id: details.unit || 'fixture/default',
    request_path: 'docs/features/fixture/requests/2026-07-12-fixture.md',
    prior_request_content_sha256: sha256(priorBytes),
    proposed_request_content_sha256: sha256(proposedBytes),
    implementation_base_sha: requestImplementationBase(root),
    ac_definition_sha256: sha256(canonicalJson({
      title: 'Fixture', scope: 'Exercise closure.', criteria: ['Evidence is durable.']
    })),
    non_request_projection_sha256: '4'.repeat(64),
    subject,
    verify_required: true,
    subject_review_evidence_sha256: sha256(canonicalEvidenceBlob(root, blobs['subject-review.json'].value)),
    verify_evidence_sha256: sha256(canonicalEvidenceBlob(root, blobs['verify.json'].value)),
    ac_evidence_sha256: sha256(canonicalEvidenceBlob(root, blobs['ac.json'].value)),
    checks_evidence_sha256: sha256(canonicalEvidenceBlob(root, blobs['checks.json'].value)),
    proposed_request_blob_sha256: sha256(canonicalEvidenceBlob(
      root, blobs['request.json'].value
    )),
    recorded_at: details.recordedAt || '2026-07-12T00:00:00.000Z',
    supersedes_record_sha256: details.supersedes || null
  };
  value.record_sha256 = sha256(canonicalJson(value));
  return { value, blobs };
}

function rewriteEvidenceCommitOrder(root, sourceOid, orderedRecords) {
  const indexPath = path.join(root, '.git', `reorder-index-${process.pid}-${crypto.randomUUID()}`);
  const env = { ...process.env, GIT_INDEX_FILE: indexPath };
  evidenceGit(root, ['read-tree', '--empty'], { env });
  let parent = null;
  for (const recordValue of orderedRecords) {
    const prefix = `evidence/${recordValue.record_sha256}/`;
    const paths = String(evidenceGit(root, [
      'ls-tree', '-r', '--name-only', sourceOid
    ])).trim().split('\n').filter((entry) =>
      entry === `records/${recordValue.kind}/${recordValue.record_sha256}.json` ||
      entry.startsWith(prefix)
    );
    for (const filePath of paths) {
      const bytes = execFileSync('git', ['show', `${sourceOid}:${filePath}`], {
        cwd: root,
        encoding: null,
        env: process.env
      });
      const blobOid = evidenceGit(root, ['hash-object', '-w', '--stdin'], {
        env,
        input: bytes
      });
      evidenceGit(root, [
        'update-index', '--add', '--cacheinfo', `100644,${blobOid},${filePath}`
      ], { env });
    }
    const tree = evidenceGit(root, ['write-tree'], { env });
    const args = ['commit-tree', tree];
    if (parent) args.push('-p', parent);
    args.push('-m', `reordered ${recordValue.kind}`);
    parent = evidenceGit(root, args, { env });
  }
  evidenceGit(root, ['update-ref', EVIDENCE_REF, parent, sourceOid]);
  fs.rmSync(indexPath, { force: true });
}

function rehashEvidenceBundle(root, bundle) {
  for (const supplied of Object.values(bundle.blobs)) {
    bundle.value[supplied.field] = sha256(canonicalEvidenceBlob(root, supplied.value));
  }
  delete bundle.value.record_sha256;
  bundle.value.record_sha256 = sha256(canonicalJson(bundle.value));
  return bundle;
}

function useRequestOnlyAcEvidence(root, bundle) {
  const requestPath = bundle.value.request_path;
  const requestBytes = fs.readFileSync(path.join(root, requestPath));
  const lines = requestBytes.toString('utf8').replace(/\r\n/g, '\n').split('\n');
  const line = lines.findIndex((value) => /^- \[ \]/.test(value)) + 1;
  bundle.blobs['ac.json'].value.verdicts[0].evidence = [{
    location: `${requestPath}:${line}`,
    path: requestPath,
    line,
    column: null,
    file_sha256: sha256(requestBytes),
    line_sha256: sha256(Buffer.from(lines[line - 1])),
    commit_blob_oid: null,
    file_bytes_base64: requestBytes.toString('base64')
  }];
  return rehashEvidenceBundle(root, bundle);
}

function installRawEvidenceBundle(root, bundle) {
  const indexPath = path.join(root, '.git', `raw-index-${crypto.randomUUID()}`);
  const env = { ...process.env, GIT_INDEX_FILE: indexPath };
  evidenceGit(root, ['read-tree', '--empty'], { env });
  const files = new Map([[
    `records/${bundle.value.kind}/${bundle.value.record_sha256}.json`,
    canonicalJson(bundle.value)
  ]]);
  for (const [name, supplied] of Object.entries(bundle.blobs)) {
    files.set(`evidence/${bundle.value.record_sha256}/${name}`,
      canonicalEvidenceBlob(root, supplied.value));
  }
  for (const [filePath, bytes] of files) {
    const oid = evidenceGit(root, ['hash-object', '-w', '--stdin'], {
      env,
      input: bytes
    });
    evidenceGit(root, [
      'update-index', '--add', '--cacheinfo', `100644,${oid},${filePath}`
    ], { env });
  }
  const tree = evidenceGit(root, ['write-tree'], { env });
  const commitOid = evidenceGit(root, ['commit-tree', tree, '-m', 'raw evidence'], { env });
  evidenceGit(root, ['update-ref', EVIDENCE_REF, commitOid, '0'.repeat(40)]);
  fs.rmSync(indexPath, { force: true });
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
  const unlinkedBundle = record(root, {
    recordedAt: '2026-07-12T00:00:30.000Z'
  });
  assert.throws(() => appendEvidenceRevision(root, unlinkedBundle.value,
    unlinkedBundle.blobs, { expected_old_oid: first.oid }),
  /must supersede the latest matching kind\/unit/);
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

  rewriteEvidenceCommitOrder(root, second.oid, [secondRecord, firstRecord]);
  assert.throws(() => auditEvidenceLedger(root), /prior commit-order record/);
});

test('redaction removes repository, account, and secret data and refuses private keys', (t) => {
  const root = repository();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const blob = canonicalEvidenceBlob(root, {
    path: `${root}/app.js`,
    external_path: absoluteFixture('srv', 'private', 'build.log'),
    account: accountFixture(),
    [['pass', 'word'].join('')]: 'not-pattern-shaped-but-sensitive',
    [['to', 'ken'].join('')]: bearerFixture()
  });
  assert.doesNotMatch(blob, new RegExp(root.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  for (const unsafe of [
    accountFixture(), bearerFixture(), 'not-pattern-shaped-but-sensitive',
    absoluteFixture('srv', 'private')
  ]) assert.doesNotMatch(blob, new RegExp(unsafe.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(blob, /<repo>|<account>|<secret>|<absolute-path>/);
  assert.throws(() => canonicalEvidenceBlob(root, {
    key: privateKeyFixture('\nunsafe')
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
  evidenceGit(root, ['bundle', 'create', bundlePath, '--all']);
  initRepository(imported);
  evidenceGit(imported, ['fetch', bundlePath, `${EVIDENCE_REF}:${EVIDENCE_REF}`]);
  assert.deepEqual(readEvidenceRecord(imported, bundle.value.record_sha256).record,
    bundle.value);
});

test('request closure prepare and finalize bind proposal, projection, and two reviews', (t) => {
  const root = repository();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const requestPath = 'docs/features/fixture/requests/2026-07-12-fixture.md';
  const subject = dirtySubject(root);
  const prepareInput = {
    promotion_unit_id: 'fixture/default',
    request_path: requestPath,
    proposed_request: completedRequestBytes(root),
    subject,
    evidence: passingClosureEvidence(root, subject),
    recorded_at: '2026-07-12T01:00:00.000Z',
    supersedes_record_sha256: null
  };
  const pending = prepareRequestClosure(root, prepareInput);
  assert.equal(pending.record.kind, 'request-closure-pending');
  const replayedPrepare = prepareRequestClosure(root, prepareInput);
  assert.equal(replayedPrepare.reused, true);
  assert.equal(replayedPrepare.record_sha256, pending.record_sha256);
  assert.equal(replayedPrepare.oid, pending.oid);
  const applied = applyRequestClosure(root, {
    pending_record_sha256: pending.record_sha256
  });
  assert.equal(applied.request_content_sha256, pending.record.proposed_request_content_sha256);
  assert.equal(applyRequestClosure(root, {
    pending_record_sha256: pending.record_sha256
  }).reused, true);
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
  assert.equal(auditEvidenceLedger(root).ok, true);
  const closedRequest = fs.readFileSync(path.join(root, requestPath));
  fs.appendFileSync(path.join(root, requestPath), '\npost-closure edit\n');
  assert.throws(() => auditEvidenceLedger(root),
    /Current request no longer matches durable completion evidence/);
  fs.writeFileSync(path.join(root, requestPath), closedRequest);
  const restarted = finalizeRequestClosure(root, {
    pending_record_sha256: pending.record_sha256,
    recorded_at: '2026-07-12T01:02:00.000Z',
    supersedes_record_sha256: null
  });
  assert.equal(restarted.reused, true);
  assert.equal(restarted.record_sha256, closure.record_sha256);
});

test('closure apply preserves unowned edits and restores every failed write stage', (t) => {
  const requestPath = 'docs/features/fixture/requests/2026-07-12-fixture.md';
  for (const interposition of ['before-apply', 'write-boundary']) {
    const root = repository();
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const pending = prepareRequestClosure(root, {
      promotion_unit_id: 'fixture/default',
      request_path: requestPath,
      proposed_request: completedRequestBytes(root),
      subject: dirtySubject(root),
      evidence: passingClosureEvidence(root),
      recorded_at: interposition === 'before-apply'
        ? '2026-07-12T01:02:10.000Z' : '2026-07-12T01:02:20.000Z',
      supersedes_record_sha256: null
    });
    const request = path.join(root, requestPath);
    const userBytes = Buffer.from(`user edit survives ${interposition}\n`);
    const statePath = resolveRuntimeMetadataPath(root, 'runtime-state.json');
    const evidenceOid = evidenceGit(root, ['rev-parse', EVIDENCE_REF]);
    if (interposition === 'before-apply') fs.writeFileSync(request, userBytes);
    const stateBytes = fs.readFileSync(statePath);
    assert.throws(() => applyRequestClosure(root, {
      pending_record_sha256: pending.record_sha256
    }, interposition === 'write-boundary' ? {
      beforeWrite() {
        fs.writeFileSync(request, userBytes);
      }
    } : {}), /drifted after prepare|changed at the write boundary/);
    assert.deepEqual(fs.readFileSync(request), userBytes);
    assert.equal(evidenceGit(root, ['rev-parse', EVIDENCE_REF]), evidenceOid);
    assert.deepEqual(fs.readFileSync(statePath), stateBytes);
  }

  for (const failure of ['truncate', 'write', 'fsync']) {
    const root = repository();
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const request = path.join(root, requestPath);
    const priorBytes = fs.readFileSync(request);
    const priorMode = fs.statSync(request).mode & 0o7777;
    const pending = prepareRequestClosure(root, {
      promotion_unit_id: 'fixture/default',
      request_path: requestPath,
      proposed_request: completedRequestBytes(root),
      subject: dirtySubject(root),
      evidence: passingClosureEvidence(root),
      recorded_at: failure === 'truncate' ? '2026-07-12T01:02:30.000Z'
        : failure === 'write' ? '2026-07-12T01:02:40.000Z'
          : '2026-07-12T01:02:50.000Z',
      supersedes_record_sha256: null
    });
    let writes = 0;
    const hooks = failure === 'truncate' ? {
      truncate() { throw new Error('injected truncate failure'); }
    } : failure === 'write' ? {
      write(descriptor, bytes, offset, length, position) {
        if (writes++ > 0) throw new Error('injected write failure');
        return fs.writeSync(descriptor, bytes, offset, Math.min(5, length), position);
      }
    } : {
      fsync() { throw new Error('injected fsync failure'); }
    };
    assert.throws(() => applyRequestClosure(root, {
      pending_record_sha256: pending.record_sha256
    }, hooks), /injected .* failure/);
    const interruptedBytes = fs.readFileSync(request);
    assert.equal(fs.existsSync(resolveRuntimeMetadataPath(root, path.join(
      'closure-apply-journals', `${pending.record_sha256}.json`
    ))), true);
    recoverRequestClosure(root, {
      pending_record_sha256: pending.record_sha256,
      action: 'restore-prior',
      expected_current_sha256: sha256(interruptedBytes)
    });
    assert.deepEqual(fs.readFileSync(request), priorBytes);
    assert.equal(fs.statSync(request).mode & 0o7777, priorMode);
    assert.equal(fs.existsSync(resolveRuntimeMetadataPath(root, path.join(
      'closure-apply-journals', `${pending.record_sha256}.json`
    ))), false);
  }

  const recoveryRoot = repository();
  t.after(() => fs.rmSync(recoveryRoot, { recursive: true, force: true }));
  const recoveryRequest = path.join(recoveryRoot, requestPath);
  fs.chmodSync(recoveryRequest, 0o755);
  const recoveryPriorBytes = fs.readFileSync(recoveryRequest);
  const recoveryPending = prepareRequestClosure(recoveryRoot, {
    promotion_unit_id: 'fixture/default',
    request_path: requestPath,
    proposed_request: completedRequestBytes(recoveryRoot),
    subject: dirtySubject(recoveryRoot),
    evidence: passingClosureEvidence(recoveryRoot),
    recorded_at: '2026-07-12T01:03:00.000Z',
    supersedes_record_sha256: null
  });
  const recoveryIdentity = fs.statSync(recoveryRequest, { bigint: true });
  const recoveryJournal = resolveRuntimeMetadataPath(recoveryRoot, path.join(
    'closure-apply-journals', `${recoveryPending.record_sha256}.json`
  ));
  fs.mkdirSync(path.dirname(recoveryJournal), { recursive: true });
  fs.writeFileSync(recoveryJournal, `${JSON.stringify({
    schema_version: 1,
    pending_record_sha256: recoveryPending.record_sha256,
    request_path: requestPath,
    prior_sha256: recoveryPending.record.prior_request_content_sha256,
    proposed_sha256: recoveryPending.record.proposed_request_content_sha256,
    dev: recoveryIdentity.dev.toString(),
    ino: recoveryIdentity.ino.toString(),
    recorded_at: '2026-07-12T01:03:01.000Z'
  })}\n`);
  const postJournalUserBytes = Buffer.from('user edit after journal fsync\n');
  fs.writeFileSync(recoveryRequest, postJournalUserBytes);
  assert.throws(() => applyRequestClosure(recoveryRoot, {
    pending_record_sha256: recoveryPending.record_sha256
  }), /drifted after prepare/);
  assert.deepEqual(fs.readFileSync(recoveryRequest), postJournalUserBytes);
  assert.equal(fs.existsSync(recoveryJournal), true);
  const restored = recoverRequestClosure(recoveryRoot, {
    pending_record_sha256: recoveryPending.record_sha256,
    action: 'restore-prior',
    expected_current_sha256: sha256(postJournalUserBytes)
  });
  assert.equal(restored.request_content_sha256,
    recoveryPending.record.prior_request_content_sha256);
  assert.equal(typeof restored.displaced_backup_path, 'string');
  assert.deepEqual(fs.readFileSync(path.join(recoveryRoot,
    restored.displaced_backup_path)), postJournalUserBytes);
  assert.deepEqual(fs.readFileSync(recoveryRequest), recoveryPriorBytes);
  assert.equal(fs.statSync(recoveryRequest).mode & 0o7777, 0o755);
  assert.equal(fs.existsSync(recoveryJournal), false);
  assert.equal(applyRequestClosure(recoveryRoot, {
    pending_record_sha256: recoveryPending.record_sha256
  }).request_content_sha256, recoveryPending.record.proposed_request_content_sha256);
  const replayIdentity = fs.statSync(recoveryRequest, { bigint: true });
  fs.writeFileSync(recoveryJournal, `${JSON.stringify({
    schema_version: 1,
    pending_record_sha256: recoveryPending.record_sha256,
    request_path: requestPath,
    prior_sha256: recoveryPending.record.prior_request_content_sha256,
    proposed_sha256: recoveryPending.record.proposed_request_content_sha256,
    dev: replayIdentity.dev.toString(),
    ino: replayIdentity.ino.toString(),
    recorded_at: '2026-07-12T01:03:20.000Z'
  })}\n`);
  const replayReplacement = Buffer.from('atomic replacement during proposed replay\n');
  assert.throws(() => applyRequestClosure(recoveryRoot, {
    pending_record_sha256: recoveryPending.record_sha256
  }, {
    beforeJournalRemove() {
      const replacement = `${recoveryRequest}.replacement`;
      fs.writeFileSync(replacement, replayReplacement);
      fs.renameSync(replacement, recoveryRequest);
    }
  }), /path identity changed|proposed replay changed/);
  assert.deepEqual(fs.readFileSync(recoveryRequest), replayReplacement);
  assert.equal(fs.existsSync(recoveryJournal), true);
  recoverRequestClosure(recoveryRoot, {
    pending_record_sha256: recoveryPending.record_sha256,
    action: 'abandon',
    expected_current_sha256: sha256(replayReplacement)
  });

  const concurrentRoot = repository();
  t.after(() => fs.rmSync(concurrentRoot, { recursive: true, force: true }));
  const concurrentRequest = path.join(concurrentRoot, requestPath);
  const concurrentPending = prepareRequestClosure(concurrentRoot, {
    promotion_unit_id: 'fixture/default',
    request_path: requestPath,
    proposed_request: completedRequestBytes(concurrentRoot),
    subject: dirtySubject(concurrentRoot),
    evidence: passingClosureEvidence(concurrentRoot),
    recorded_at: '2026-07-12T01:03:30.000Z',
    supersedes_record_sha256: null
  });
  const concurrentUserBytes = Buffer.from('concurrent user bytes during fsync\n');
  assert.throws(() => applyRequestClosure(concurrentRoot, {
    pending_record_sha256: concurrentPending.record_sha256
  }, {
    fsync(descriptor) {
      fs.ftruncateSync(descriptor, 0);
      fs.writeSync(descriptor, concurrentUserBytes, 0, concurrentUserBytes.length, 0);
      fs.fsyncSync(descriptor);
      throw new Error('injected fsync concurrency');
    }
  }), /recovery remains journaled/);
  assert.deepEqual(fs.readFileSync(concurrentRequest), concurrentUserBytes);
  const concurrentJournal = resolveRuntimeMetadataPath(concurrentRoot, path.join(
      'closure-apply-journals', `${concurrentPending.record_sha256}.json`
  ));
  assert.equal(fs.existsSync(concurrentJournal), true);
  const beforeIncorrectExpectation = fs.readFileSync(concurrentRequest);
  const journalBeforeIncorrectExpectation = fs.readFileSync(concurrentJournal);
  for (const action of ['restore-prior', 'abandon']) {
    assert.throws(() => recoverRequestClosure(concurrentRoot, {
      pending_record_sha256: concurrentPending.record_sha256,
      action,
      expected_current_sha256: '0'.repeat(64)
    }), /operator expectation/);
    assert.deepEqual(fs.readFileSync(concurrentRequest), beforeIncorrectExpectation);
    assert.deepEqual(fs.readFileSync(concurrentJournal),
      journalBeforeIncorrectExpectation);
    assert.equal(fs.existsSync(path.join(
      concurrentRoot, '.sd0x', 'closure-recovery'
    )), false);
  }
  const replacement = `${concurrentRequest}.replacement`;
  const replacementBytes = Buffer.from('atomic-save replacement survives abandon\n');
  fs.writeFileSync(replacement, replacementBytes);
  fs.renameSync(replacement, concurrentRequest);
  assert.throws(() => recoverRequestClosure(concurrentRoot, {
    pending_record_sha256: concurrentPending.record_sha256,
    action: 'restore-prior',
    expected_current_sha256: sha256(replacementBytes)
  }), /does not match the request identity/);
  const abandoned = recoverRequestClosure(concurrentRoot, {
    pending_record_sha256: concurrentPending.record_sha256,
    action: 'abandon',
    expected_current_sha256: sha256(replacementBytes)
  });
  assert.equal(abandoned.request_content_sha256, sha256(replacementBytes));
  assert.deepEqual(fs.readFileSync(concurrentRequest), replacementBytes);
  assert.equal(fs.existsSync(concurrentJournal), false);

  const suffixRoot = repository();
  t.after(() => fs.rmSync(suffixRoot, { recursive: true, force: true }));
  const suffixRequest = path.join(suffixRoot, requestPath);
  const suffixProposed = Buffer.from(completedRequestBytes(suffixRoot));
  const suffixPending = prepareRequestClosure(suffixRoot, {
    promotion_unit_id: 'fixture/default',
    request_path: requestPath,
    proposed_request: suffixProposed.toString('utf8'),
    subject: dirtySubject(suffixRoot),
    evidence: passingClosureEvidence(suffixRoot),
    recorded_at: '2026-07-12T01:03:40.000Z',
    supersedes_record_sha256: null
  });
  const suffixBytes = Buffer.from('concurrent suffix\n');
  assert.throws(() => applyRequestClosure(suffixRoot, {
    pending_record_sha256: suffixPending.record_sha256
  }, {
    fsync(descriptor) {
      fs.fsyncSync(descriptor);
      fs.writeSync(descriptor, suffixBytes, 0, suffixBytes.length, suffixProposed.length);
      fs.fsyncSync(descriptor);
    }
  }), /did not preserve.*remains journaled/);
  assert.deepEqual(fs.readFileSync(suffixRequest),
    Buffer.concat([suffixProposed, suffixBytes]));

  const finalRaceRoot = repository();
  t.after(() => fs.rmSync(finalRaceRoot, { recursive: true, force: true }));
  const finalRaceRequest = path.join(finalRaceRoot, requestPath);
  const finalRacePending = prepareRequestClosure(finalRaceRoot, {
    promotion_unit_id: 'fixture/default',
    request_path: requestPath,
    proposed_request: completedRequestBytes(finalRaceRoot),
    subject: dirtySubject(finalRaceRoot),
    evidence: passingClosureEvidence(finalRaceRoot),
    recorded_at: '2026-07-12T01:03:50.000Z',
    supersedes_record_sha256: null
  });
  assert.throws(() => applyRequestClosure(finalRaceRoot, {
    pending_record_sha256: finalRacePending.record_sha256
  }, {
    fsync() { throw new Error('journal recovery fixture'); }
  }), /remains journaled/);
  const recoveryObserved = fs.readFileSync(finalRaceRequest);
  const authorizationRaceBytes = Buffer.from('edit after operator authorization\n');
  assert.throws(() => recoverRequestClosure(finalRaceRoot, {
    pending_record_sha256: finalRacePending.record_sha256,
    action: 'restore-prior',
    expected_current_sha256: sha256(recoveryObserved)
  }, {
    beforeMutation() {
      fs.writeFileSync(finalRaceRequest, authorizationRaceBytes);
    }
  }), /changed before recovery/);
  assert.deepEqual(fs.readFileSync(finalRaceRequest), authorizationRaceBytes);
  const afterAuthorizationBytes = Buffer.from('edit after final authorization check\n');
  const finalRaceUserBytes = Buffer.from('edit before recovery journal removal\n');
  assert.throws(() => recoverRequestClosure(finalRaceRoot, {
    pending_record_sha256: finalRacePending.record_sha256,
    action: 'restore-prior',
    expected_current_sha256: sha256(authorizationRaceBytes)
  }, {
    afterAuthorizationCheck() {
      fs.writeFileSync(finalRaceRequest, afterAuthorizationBytes);
    }
  }), /changed after authorization/);
  assert.deepEqual(fs.readFileSync(finalRaceRequest), afterAuthorizationBytes);
  assert.equal(fs.existsSync(path.join(
    finalRaceRoot, '.sd0x', 'closure-recovery'
  )), false);
  assert.throws(() => recoverRequestClosure(finalRaceRoot, {
    pending_record_sha256: finalRacePending.record_sha256,
    action: 'restore-prior',
    expected_current_sha256: sha256(afterAuthorizationBytes)
  }, {
    beforeJournalRemove() {
      fs.writeFileSync(finalRaceRequest, finalRaceUserBytes);
    }
  }), /changed before journal removal/);
  assert.deepEqual(fs.readFileSync(finalRaceRequest), finalRaceUserBytes);
  const displaced = fs.readdirSync(path.join(finalRaceRoot, '.sd0x', 'closure-recovery'))
    .filter((name) => name.endsWith('.displaced'));
  assert.equal(displaced.length, 1);
  assert.deepEqual(fs.readFileSync(path.join(finalRaceRoot, '.sd0x',
    'closure-recovery', displaced[0])), afterAuthorizationBytes);
  assert.equal(fs.existsSync(resolveRuntimeMetadataPath(finalRaceRoot, path.join(
    'closure-apply-journals', `${finalRacePending.record_sha256}.json`
  ))), true);
});

test('closure recovery resumes crash cuts and rolls back a failed prior install', (t) => {
  const requestPath = 'docs/features/fixture/requests/2026-07-12-fixture.md';
  let recordedMinute = 4;
  const interrupted = () => {
    const root = repository();
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const request = path.join(root, requestPath);
    const priorBytes = fs.readFileSync(request);
    const priorMode = fs.statSync(request).mode & 0o7777;
    const pending = prepareRequestClosure(root, {
      promotion_unit_id: 'fixture/default',
      request_path: requestPath,
      proposed_request: completedRequestBytes(root),
      subject: dirtySubject(root),
      evidence: passingClosureEvidence(root),
      recorded_at: `2026-07-12T01:${String(recordedMinute++).padStart(2, '0')}:00.000Z`,
      supersedes_record_sha256: null
    });
    assert.throws(() => applyRequestClosure(root, {
      pending_record_sha256: pending.record_sha256
    }, {
      fsync() { throw new Error('recovery crash-cut fixture'); }
    }), /recovery remains journaled/);
    return {
      root,
      request,
      priorBytes,
      priorMode,
      pending,
      observedBytes: fs.readFileSync(request),
      applyJournal: resolveRuntimeMetadataPath(root, path.join(
        'closure-apply-journals', `${pending.record_sha256}.json`
      )),
      recoveryJournal: path.join(root, '.sd0x', 'closure-recovery',
        `${pending.record_sha256}.json`)
    };
  };

  const preparedCrash = interrupted();
  assert.throws(() => recoverRequestClosure(preparedCrash.root, {
    pending_record_sha256: preparedCrash.pending.record_sha256,
    action: 'restore-prior',
    expected_current_sha256: sha256(preparedCrash.observedBytes)
  }, {
    afterRecoveryPrepared() {
      throw new Error('crash after prepared journal before rename');
    }
  }), /crash after prepared journal before rename/);
  assert.deepEqual(fs.readFileSync(preparedCrash.request), preparedCrash.observedBytes);
  assert.equal(JSON.parse(fs.readFileSync(
    preparedCrash.recoveryJournal, 'utf8'
  )).phase, 'prepared');
  const resumedPrepared = recoverRequestClosure(preparedCrash.root, {
    pending_record_sha256: preparedCrash.pending.record_sha256,
    action: 'restore-prior',
    expected_current_sha256: sha256(preparedCrash.observedBytes)
  });
  assert.deepEqual(fs.readFileSync(preparedCrash.request), preparedCrash.priorBytes);
  assert.deepEqual(fs.readFileSync(path.join(
    preparedCrash.root, resumedPrepared.displaced_backup_path
  )), preparedCrash.observedBytes);

  const displacedCrash = interrupted();
  assert.throws(() => recoverRequestClosure(displacedCrash.root, {
    pending_record_sha256: displacedCrash.pending.record_sha256,
    action: 'restore-prior',
    expected_current_sha256: sha256(displacedCrash.observedBytes)
  }, {
    afterRecoveryRename() {
      throw new Error('crash after rename before displaced phase');
    }
  }), /crash after rename before displaced phase/);
  assert.equal(fs.existsSync(displacedCrash.request), false);
  assert.equal(fs.existsSync(displacedCrash.recoveryJournal), true);
  assert.equal(JSON.parse(fs.readFileSync(
    displacedCrash.recoveryJournal, 'utf8'
  )).phase, 'prepared');
  const resumedDisplacement = recoverRequestClosure(displacedCrash.root, {
    pending_record_sha256: displacedCrash.pending.record_sha256,
    action: 'restore-prior',
    expected_current_sha256: sha256(displacedCrash.observedBytes)
  });
  assert.deepEqual(fs.readFileSync(displacedCrash.request),
    displacedCrash.priorBytes);
  assert.equal(fs.statSync(displacedCrash.request).mode & 0o7777,
    displacedCrash.priorMode);
  assert.deepEqual(fs.readFileSync(path.join(
    displacedCrash.root, resumedDisplacement.displaced_backup_path
  )), displacedCrash.observedBytes);
  assert.equal(fs.existsSync(displacedCrash.applyJournal), false);
  assert.equal(fs.existsSync(displacedCrash.recoveryJournal), false);

  const installedCrash = interrupted();
  assert.throws(() => recoverRequestClosure(installedCrash.root, {
    pending_record_sha256: installedCrash.pending.record_sha256,
    action: 'restore-prior',
    expected_current_sha256: sha256(installedCrash.observedBytes)
  }, {
    afterRecoveryLink() {
      throw new Error('crash after link before installed phase');
    }
  }), /crash after link before installed phase/);
  assert.deepEqual(fs.readFileSync(installedCrash.request), installedCrash.priorBytes);
  assert.equal(fs.existsSync(installedCrash.recoveryJournal), true);
  assert.equal(JSON.parse(fs.readFileSync(
    installedCrash.recoveryJournal, 'utf8'
  )).phase, 'displaced');
  const resumedInstallation = recoverRequestClosure(installedCrash.root, {
    pending_record_sha256: installedCrash.pending.record_sha256,
    action: 'restore-prior',
    expected_current_sha256: sha256(installedCrash.observedBytes)
  });
  assert.deepEqual(fs.readFileSync(path.join(
    installedCrash.root, resumedInstallation.displaced_backup_path
  )), installedCrash.observedBytes);
  assert.equal(fs.existsSync(installedCrash.applyJournal), false);
  assert.equal(fs.existsSync(installedCrash.recoveryJournal), false);

  const failedLink = interrupted();
  assert.throws(() => recoverRequestClosure(failedLink.root, {
    pending_record_sha256: failedLink.pending.record_sha256,
    action: 'restore-prior',
    expected_current_sha256: sha256(failedLink.observedBytes)
  }, {
    linkPrior() { throw new Error('injected prior link failure'); }
  }), /current bytes were reinstalled without overwrite/);
  assert.deepEqual(fs.readFileSync(failedLink.request), failedLink.observedBytes);
  assert.equal(fs.existsSync(failedLink.applyJournal), true);
  assert.equal(fs.existsSync(failedLink.recoveryJournal), false);
  const firstBackups = fs.readdirSync(path.join(
    failedLink.root, '.sd0x', 'closure-recovery'
  )).filter((name) => name.endsWith('.displaced'));
  assert.equal(firstBackups.length, 1);
  assert.deepEqual(fs.readFileSync(path.join(
    failedLink.root, '.sd0x', 'closure-recovery', firstBackups[0]
  )), failedLink.observedBytes);
  const resumedLink = recoverRequestClosure(failedLink.root, {
    pending_record_sha256: failedLink.pending.record_sha256,
    action: 'restore-prior',
    expected_current_sha256: sha256(failedLink.observedBytes)
  });
  assert.deepEqual(fs.readFileSync(failedLink.request), failedLink.priorBytes);
  assert.deepEqual(fs.readFileSync(path.join(
    failedLink.root, resumedLink.displaced_backup_path
  )), failedLink.observedBytes);
  assert.equal(fs.readdirSync(path.join(
    failedLink.root, '.sd0x', 'closure-recovery'
  )).filter((name) => name.endsWith('.displaced')).length, 2);

  const collision = interrupted();
  const editorBytes = Buffer.from('editor-created live bytes during prior link\n');
  assert.throws(() => recoverRequestClosure(collision.root, {
    pending_record_sha256: collision.pending.record_sha256,
    action: 'restore-prior',
    expected_current_sha256: sha256(collision.observedBytes)
  }, {
    linkPrior(priorTemporary, requestAbsolute) {
      fs.writeFileSync(requestAbsolute, editorBytes);
      fs.linkSync(priorTemporary, requestAbsolute);
    }
  }), /prior install failed and remains journaled/);
  assert.deepEqual(fs.readFileSync(collision.request), editorBytes);
  assert.equal(fs.existsSync(collision.applyJournal), true);
  assert.equal(fs.existsSync(collision.recoveryJournal), true);
  const collisionMarker = JSON.parse(fs.readFileSync(
    collision.recoveryJournal, 'utf8'
  ));
  const collisionBackup = path.join(
    collision.root, '.sd0x', 'closure-recovery',
    `${collision.pending.record_sha256}.${collisionMarker.nonce}.displaced`
  );
  assert.deepEqual(fs.readFileSync(collisionBackup), collision.observedBytes);
  const abandonedCollision = recoverRequestClosure(collision.root, {
    pending_record_sha256: collision.pending.record_sha256,
    action: 'abandon',
    expected_current_sha256: sha256(editorBytes)
  });
  assert.deepEqual(fs.readFileSync(collision.request), editorBytes);
  assert.equal(fs.existsSync(collision.applyJournal), false);
  assert.equal(fs.existsSync(collision.recoveryJournal), false);
  assert.equal(path.join(collision.root,
    abandonedCollision.displaced_backup_path), collisionBackup);
  assert.deepEqual(fs.readFileSync(collisionBackup), collision.observedBytes);
});

test('closure recovery rejects symlinked metadata directories without escape', (t) => {
  const requestPath = 'docs/features/fixture/requests/2026-07-12-fixture.md';
  for (const symlink of ['sd0x', 'recovery']) {
    const root = repository();
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-recovery-outside-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    t.after(() => fs.rmSync(outside, { recursive: true, force: true }));
    const request = path.join(root, requestPath);
    const pending = prepareRequestClosure(root, {
      promotion_unit_id: 'fixture/default',
      request_path: requestPath,
      proposed_request: completedRequestBytes(root),
      subject: dirtySubject(root),
      evidence: passingClosureEvidence(root),
      recorded_at: symlink === 'sd0x'
        ? '2026-07-12T01:30:00.000Z'
        : '2026-07-12T01:31:00.000Z',
      supersedes_record_sha256: null
    });
    assert.throws(() => applyRequestClosure(root, {
      pending_record_sha256: pending.record_sha256
    }, {
      fsync() { throw new Error('symlink recovery fixture'); }
    }), /recovery remains journaled/);
    const observed = fs.readFileSync(request);
    const applyJournal = resolveRuntimeMetadataPath(root, path.join(
      'closure-apply-journals', `${pending.record_sha256}.json`
    ));
    const applyJournalBytes = fs.readFileSync(applyJournal);
    if (symlink === 'sd0x') {
      fs.symlinkSync(outside, path.join(root, '.sd0x'));
    } else {
      fs.mkdirSync(path.join(root, '.sd0x'));
      fs.symlinkSync(outside, path.join(root, '.sd0x', 'closure-recovery'));
    }
    const outsideBefore = fs.readdirSync(outside);
    assert.throws(() => recoverRequestClosure(root, {
      pending_record_sha256: pending.record_sha256,
      action: 'restore-prior',
      expected_current_sha256: sha256(observed)
    }), /Contained directory is missing, symlinked, or not a directory/);
    assert.deepEqual(fs.readFileSync(request), observed);
    assert.deepEqual(fs.readFileSync(applyJournal), applyJournalBytes);
    assert.deepEqual(fs.readdirSync(outside), outsideBefore);
  }
});

test('closure apply revalidates projection and HEAD at final journal removal', (t) => {
  const requestPath = 'docs/features/fixture/requests/2026-07-12-fixture.md';
  let recordedMinute = 10;
  for (const replay of [false, true]) {
    for (const drift of ['projection', 'head']) {
      const root = repository();
      t.after(() => fs.rmSync(root, { recursive: true, force: true }));
      const request = path.join(root, requestPath);
      const pending = prepareRequestClosure(root, {
        promotion_unit_id: 'fixture/default',
        request_path: requestPath,
        proposed_request: completedRequestBytes(root),
        subject: dirtySubject(root),
        evidence: passingClosureEvidence(root),
        recorded_at: `2026-07-12T01:${recordedMinute++}:00.000Z`,
        supersedes_record_sha256: null
      });
      if (replay) {
        applyRequestClosure(root, {
          pending_record_sha256: pending.record_sha256
        });
      }
      const journal = resolveRuntimeMetadataPath(root, path.join(
        'closure-apply-journals', `${pending.record_sha256}.json`
      ));
      if (replay) {
        const identity = fs.statSync(request, { bigint: true });
        fs.mkdirSync(path.dirname(journal), { recursive: true });
        fs.writeFileSync(journal, `${JSON.stringify({
          schema_version: 1,
          pending_record_sha256: pending.record_sha256,
          request_path: requestPath,
          prior_sha256: pending.record.prior_request_content_sha256,
          proposed_sha256: pending.record.proposed_request_content_sha256,
          dev: identity.dev.toString(),
          ino: identity.ino.toString(),
          recorded_at: '2026-07-12T01:20:00.000Z'
        })}\n`);
      }
      assert.throws(() => applyRequestClosure(root, {
        pending_record_sha256: pending.record_sha256
      }, {
        beforeJournalRemove() {
          if (drift === 'projection') {
            fs.writeFileSync(path.join(root, 'app.js'),
              `module.exports = ${replay ? 41 : 42};\n`);
          } else {
            git(root, ['commit', '--allow-empty', '-m',
              `late HEAD drift ${replay ? 'replay' : 'fresh'}`]);
          }
        }
      }), /changed before journal removal/);
      assert.equal(fs.existsSync(journal), true);
    }
  }
});

test('ledger audit rejects a closure committed before its pending record', (t) => {
  const root = repository();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const requestPath = 'docs/features/fixture/requests/2026-07-12-fixture.md';
  const subject = dirtySubject(root);
  const pending = prepareRequestClosure(root, {
    promotion_unit_id: 'fixture/default',
    request_path: requestPath,
    proposed_request: completedRequestBytes(root),
    subject,
    evidence: passingClosureEvidence(root, subject),
    recorded_at: '2026-07-12T01:10:00.000Z',
    supersedes_record_sha256: null
  });
  fs.writeFileSync(path.join(root, requestPath), completedRequestBytes(root));
  recordCleanReview(root);
  const closure = finalizeRequestClosure(root, {
    pending_record_sha256: pending.record_sha256,
    recorded_at: '2026-07-12T01:11:00.000Z',
    supersedes_record_sha256: null
  });
  rewriteEvidenceCommitOrder(root, closure.oid, [closure.record, pending.record]);
  assert.throws(() => auditEvidenceLedger(root), /must follow.*pending commit-order/);
});

test('ledger audit can select the latest durable request closure', (t) => {
  const root = repository();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const requestPath = 'docs/features/fixture/requests/2026-07-12-fixture.md';
  const subject = dirtySubject(root);
  const pending = prepareRequestClosure(root, {
    promotion_unit_id: 'fixture/default',
    request_path: requestPath,
    proposed_request: completedRequestBytes(root),
    subject,
    evidence: passingClosureEvidence(root, subject),
    recorded_at: '2026-07-12T01:11:00.000Z',
    supersedes_record_sha256: null
  });
  applyRequestClosure(root, { pending_record_sha256: pending.record_sha256 });
  recordCleanReview(root);
  const closure = finalizeRequestClosure(root, {
    pending_record_sha256: pending.record_sha256,
    recorded_at: '2026-07-12T01:12:00.000Z',
    supersedes_record_sha256: null
  });

  const audit = auditEvidenceLedger(root, {
    promotion_unit_id: 'fixture/default',
    kind: 'request-closure',
    request_path: requestPath
  });
  assert.equal(audit.selected.record_sha256, closure.record_sha256);
  assert.throws(() => auditEvidenceLedger(root, {
    promotion_unit_id: 'missing/default',
    kind: 'request-closure'
  }), /Evidence has no request closure/);
});

test('closure and promotion writers reject superseded pending and closure records', (t) => {
  const root = repository();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const requestPath = 'docs/features/fixture/requests/2026-07-12-fixture.md';
  const request = path.join(root, requestPath);
  const priorBytes = fs.readFileSync(request);
  const subject = dirtySubject(root);
  const input = {
    promotion_unit_id: 'fixture/default',
    request_path: requestPath,
    proposed_request: completedRequestBytes(root),
    subject,
    evidence: passingClosureEvidence(root, subject),
    recorded_at: '2026-07-12T01:12:00.000Z',
    supersedes_record_sha256: null
  };
  const firstPending = prepareRequestClosure(root, input);
  const secondPending = prepareRequestClosure(root, {
    ...input,
    recorded_at: '2026-07-12T01:12:30.000Z',
    supersedes_record_sha256: firstPending.record_sha256
  });
  assert.throws(() => applyRequestClosure(root, {
    pending_record_sha256: firstPending.record_sha256
  }), /superseded or stale/);
  applyRequestClosure(root, { pending_record_sha256: secondPending.record_sha256 });
  recordCleanReview(root);
  assert.throws(() => finalizeRequestClosure(root, {
    pending_record_sha256: firstPending.record_sha256,
    recorded_at: '2026-07-12T01:13:00.000Z',
    supersedes_record_sha256: null
  }), /superseded or stale/);
  const firstClosure = finalizeRequestClosure(root, {
    pending_record_sha256: secondPending.record_sha256,
    recorded_at: '2026-07-12T01:13:30.000Z',
    supersedes_record_sha256: null
  });
  let state = recordCleanReview(root);
  state = recordVerification(root, 'pass', {
    runner: 'sd0x-deterministic-v1',
    commands: [{ command: 'node --test', exit_code: 0 }]
  }, state.worktree.fingerprint, 'codex');
  const firstPromotion = recordPromotionEvidence(root, {
    kind: 'promotion',
    promotion_unit_id: 'fixture/default',
    request_closure_record_sha256: firstClosure.record_sha256,
    disposition_row: fixtureDisposition(),
    payload_tree_sha256: payloadTreeSha(root),
    reason: null,
    recorded_at: '2026-07-12T01:13:45.000Z',
    supersedes_record_sha256: null
  });

  fs.writeFileSync(request, priorBytes);
  const nextSubject = dirtySubject(root);
  const thirdPending = prepareRequestClosure(root, {
    ...input,
    subject: nextSubject,
    evidence: passingClosureEvidence(root, nextSubject),
    recorded_at: '2026-07-12T01:14:00.000Z',
    supersedes_record_sha256: secondPending.record_sha256
  });
  assert.throws(() => auditEvidenceLedger(root, {
    promotion_unit_id: 'fixture/default', kind: 'promotion'
  }), /superseded request closure/);
  applyRequestClosure(root, { pending_record_sha256: thirdPending.record_sha256 });
  state = recordCleanReview(root);
  state = recordVerification(root, 'pass', {
    runner: 'sd0x-deterministic-v1',
    commands: [{ command: 'node --test', exit_code: 0 }]
  }, state.worktree.fingerprint, 'codex');
  assert.throws(() => recordPromotionEvidence(root, {
    kind: 'promotion',
    promotion_unit_id: 'fixture/default',
    request_closure_record_sha256: firstClosure.record_sha256,
    disposition_row: fixtureDisposition(),
    payload_tree_sha256: payloadTreeSha(root),
    reason: null,
    recorded_at: '2026-07-12T01:14:15.000Z',
    supersedes_record_sha256: firstPromotion.record_sha256
  }), /superseded or stale/);
  const secondClosure = finalizeRequestClosure(root, {
    pending_record_sha256: thirdPending.record_sha256,
    recorded_at: '2026-07-12T01:14:30.000Z',
    supersedes_record_sha256: firstClosure.record_sha256
  });
  assert.equal(secondClosure.record.pending_record_sha256, thirdPending.record_sha256);
  assert.throws(() => recordPromotionEvidence(root, {
    kind: 'promotion',
    promotion_unit_id: 'fixture/default',
    request_closure_record_sha256: firstClosure.record_sha256,
    disposition_row: fixtureDisposition(),
    payload_tree_sha256: payloadTreeSha(root),
    reason: null,
    recorded_at: '2026-07-12T01:15:00.000Z',
    supersedes_record_sha256: firstPromotion.record_sha256
  }), /superseded or stale/);
});

test('prepare replay re-audits the complete evidence ref', (t) => {
  const root = repository();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const subject = dirtySubject(root);
  const input = {
    promotion_unit_id: 'fixture/default',
    request_path: 'docs/features/fixture/requests/2026-07-12-fixture.md',
    proposed_request: completedRequestBytes(root),
    subject,
    evidence: passingClosureEvidence(root, subject),
    recorded_at: '2026-07-12T01:20:00.000Z',
    supersedes_record_sha256: null
  };
  const pending = prepareRequestClosure(root, input);
  const indexPath = path.join(root, '.git', `replay-tamper-${process.pid}`);
  const env = { ...process.env, GIT_INDEX_FILE: indexPath };
  evidenceGit(root, ['read-tree', `${pending.oid}^{tree}`], { env });
  const extraOid = evidenceGit(root, ['hash-object', '-w', '--stdin'], {
    env,
    input: '{"unredacted":"extra"}\n'
  });
  evidenceGit(root, [
    'update-index', '--add', '--cacheinfo',
    `100644,${extraOid},evidence/${pending.record_sha256}/extra.json`
  ], { env });
  const tree = evidenceGit(root, ['write-tree'], { env });
  const commitOid = evidenceGit(root, [
    'commit-tree', tree, '-p', pending.oid, '-m', 'tampered replay tree'
  ], { env });
  evidenceGit(root, ['update-ref', EVIDENCE_REF, commitOid, pending.oid]);
  fs.rmSync(indexPath, { force: true });
  assert.throws(() => prepareRequestClosure(root, input),
    /exactly one record|paths must exactly match|orphan, extra, or misplaced/);
});

test('finalize and promotion recheck successor revisions inside the state lock', (t) => {
  const root = repository();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const requestPath = 'docs/features/fixture/requests/2026-07-12-fixture.md';
  const request = path.join(root, requestPath);
  const priorBytes = fs.readFileSync(request);
  const subject = dirtySubject(root);
  const baseInput = {
    promotion_unit_id: 'fixture/default',
    request_path: requestPath,
    proposed_request: completedRequestBytes(root),
    subject,
    evidence: passingClosureEvidence(root, subject),
    recorded_at: '2026-07-12T01:21:00.000Z',
    supersedes_record_sha256: null
  };
  const firstPending = prepareRequestClosure(root, baseInput);
  const successorPending = prepareRequestClosure(root, {
    ...baseInput,
    recorded_at: '2026-07-12T01:21:30.000Z',
    supersedes_record_sha256: firstPending.record_sha256
  });
  evidenceGit(root, ['update-ref', EVIDENCE_REF, firstPending.oid, successorPending.oid]);
  assert.throws(() => applyRequestClosure(root, {
    pending_record_sha256: firstPending.record_sha256
  }, {
    beforeWrite() {
      evidenceGit(root, [
        'update-ref', EVIDENCE_REF, successorPending.oid, firstPending.oid
      ]);
    }
  }), /became superseded or stale/);
  evidenceGit(root, ['update-ref', EVIDENCE_REF, firstPending.oid, successorPending.oid]);
  assert.throws(() => applyRequestClosure(root, {
    pending_record_sha256: firstPending.record_sha256
  }, {
    fsync() { throw new Error('recover evidence race fixture'); }
  }), /remains journaled/);
  const interrupted = fs.readFileSync(request);
  const recoveryRaceJournal = resolveRuntimeMetadataPath(root, path.join(
    'closure-apply-journals', `${firstPending.record_sha256}.json`
  ));
  const recoveryRaceJournalBytes = fs.readFileSync(recoveryRaceJournal);
  assert.throws(() => recoverRequestClosure(root, {
    pending_record_sha256: firstPending.record_sha256,
    action: 'restore-prior',
    expected_current_sha256: sha256(interrupted)
  }, {
    afterAuthorizationCheck() {
      evidenceGit(root, [
        'update-ref', EVIDENCE_REF, successorPending.oid, firstPending.oid
      ]);
    }
  }), /evidence changed before recovery/);
  assert.deepEqual(fs.readFileSync(request), interrupted);
  assert.deepEqual(fs.readFileSync(recoveryRaceJournal), recoveryRaceJournalBytes);
  assert.equal(fs.existsSync(path.join(root, '.sd0x', 'closure-recovery')), false);
  evidenceGit(root, ['update-ref', EVIDENCE_REF, firstPending.oid, successorPending.oid]);
  assert.throws(() => recoverRequestClosure(root, {
    pending_record_sha256: firstPending.record_sha256,
    action: 'restore-prior',
    expected_current_sha256: sha256(interrupted)
  }, {
    beforeJournalRemove() {
      evidenceGit(root, [
        'update-ref', EVIDENCE_REF, successorPending.oid, firstPending.oid
      ]);
    }
  }), /evidence changed before recovery/);
  evidenceGit(root, ['update-ref', EVIDENCE_REF, firstPending.oid, successorPending.oid]);
  const restoredPrior = fs.readFileSync(request);
  recoverRequestClosure(root, {
    pending_record_sha256: firstPending.record_sha256,
    action: 'abandon',
    expected_current_sha256: sha256(restoredPrior)
  });
  applyRequestClosure(root, { pending_record_sha256: firstPending.record_sha256 });
  recordCleanReview(root);
  let advanced = false;
  assert.throws(() => finalizeRequestClosure(root, {
    pending_record_sha256: firstPending.record_sha256,
    recorded_at: '2026-07-12T01:22:00.000Z',
    supersedes_record_sha256: null
  }, {
    beforeRequestRead() {
      if (advanced) return;
      advanced = true;
      evidenceGit(root, [
        'update-ref', EVIDENCE_REF, successorPending.oid, firstPending.oid
      ]);
    }
  }), /became superseded or stale/);
  assert.equal(evidenceGit(root, ['rev-parse', EVIDENCE_REF]), successorPending.oid);

  applyRequestClosure(root, { pending_record_sha256: successorPending.record_sha256 });
  recordCleanReview(root);
  const firstClosure = finalizeRequestClosure(root, {
    pending_record_sha256: successorPending.record_sha256,
    recorded_at: '2026-07-12T01:22:30.000Z',
    supersedes_record_sha256: null
  });
  fs.writeFileSync(request, priorBytes);
  const nextSubject = dirtySubject(root);
  const nextPending = prepareRequestClosure(root, {
    ...baseInput,
    subject: nextSubject,
    evidence: passingClosureEvidence(root, nextSubject),
    recorded_at: '2026-07-12T01:23:00.000Z',
    supersedes_record_sha256: successorPending.record_sha256
  });
  applyRequestClosure(root, { pending_record_sha256: nextPending.record_sha256 });
  let state = recordCleanReview(root);
  const successorClosure = finalizeRequestClosure(root, {
    pending_record_sha256: nextPending.record_sha256,
    recorded_at: '2026-07-12T01:23:30.000Z',
    supersedes_record_sha256: firstClosure.record_sha256
  });
  state = recordVerification(root, 'pass', {
    runner: 'sd0x-deterministic-v1',
    commands: [{ command: 'node --test', exit_code: 0 }]
  }, state.worktree.fingerprint, 'codex');
  evidenceGit(root, ['update-ref', EVIDENCE_REF, firstClosure.oid, successorClosure.oid]);
  advanced = false;
  assert.throws(() => recordPromotionEvidence(root, {
    kind: 'promotion',
    promotion_unit_id: 'fixture/default',
    request_closure_record_sha256: firstClosure.record_sha256,
    disposition_row: fixtureDisposition(),
    payload_tree_sha256: payloadTreeSha(root),
    reason: null,
    recorded_at: '2026-07-12T01:24:00.000Z',
    supersedes_record_sha256: null
  }, {
    beforeRequestRead() {
      if (advanced) return;
      advanced = true;
      evidenceGit(root, [
        'update-ref', EVIDENCE_REF, successorClosure.oid, firstClosure.oid
      ]);
    }
  }), /became superseded or stale/);
});

test('closure prepare rejects stale subjects and non-passing evidence', (t) => {
  const root = repository();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const requestPath = 'docs/features/fixture/requests/2026-07-12-fixture.md';
  const base = {
    promotion_unit_id: 'fixture/default',
    request_path: requestPath,
    proposed_request: completedRequestBytes(root),
    subject: dirtySubject(root),
    evidence: passingClosureEvidence(root),
    recorded_at: '2026-07-12T01:30:00.000Z',
    supersedes_record_sha256: null
  };
  assert.throws(() => prepareRequestClosure(root, {
    ...base,
    subject: { ...base.subject, fingerprint: '0'.repeat(64) }
  }), /fingerprint is stale/);
  assert.throws(() => prepareRequestClosure(root, {
    ...base,
    evidence: {
      ...base.evidence,
      subject_review: {
        ...base.evidence.subject_review,
        evidence: { outcome: 'clean', reviewers: 2, findings: 0 }
      }
    }
  }), /does not match the current gate/);
  assert.throws(() => prepareRequestClosure(root, {
    ...base,
    evidence: {
      ...base.evidence,
      verify: { ...base.evidence.verify, evidence: { exit_code: 1 } }
    }
  }), /does not match the current gate/);
  assert.throws(() => prepareRequestClosure(root, {
    ...base,
    evidence: {
      ...base.evidence,
      ac: { verdicts: [{ status: 'Complete', confidence: 'High', evidence: [] }] }
    }
  }), /file:line evidence/);
});

test('closure prepare requires an immutable ancestral Implementation Base SHA', (t) => {
  const requestPath = 'docs/features/fixture/requests/2026-07-12-fixture.md';
  const missingRoot = repository();
  t.after(() => fs.rmSync(missingRoot, { recursive: true, force: true }));
  const missingRequest = path.join(missingRoot, requestPath);
  const missingBytes = fs.readFileSync(missingRequest, 'utf8').replace(
    /\n> \*\*Implementation Base SHA\*\*: `[a-f0-9]{40}`\n/, '\n'
  );
  fs.writeFileSync(missingRequest, missingBytes);
  const missingSubject = dirtySubject(missingRoot);
  const proposedWithoutBase = completedRequestBytes(
    String(git(missingRoot, ['rev-parse', 'HEAD'])).trim()
  ).replace(/\n> \*\*Implementation Base SHA\*\*: `[a-f0-9]{40}`\n/, '\n');
  assert.throws(() => prepareRequestClosure(missingRoot, {
    promotion_unit_id: 'fixture/default',
    request_path: requestPath,
    proposed_request: proposedWithoutBase,
    subject: missingSubject,
    evidence: passingClosureEvidence(missingRoot, missingSubject),
    recorded_at: '2026-07-12T01:31:00.000Z',
    supersedes_record_sha256: null
  }), /requires an immutable Implementation Base SHA/);
  assert.equal(fs.readFileSync(missingRequest, 'utf8'), missingBytes);
  assert.throws(() => auditEvidenceLedger(missingRoot), /Evidence ref is missing/);

  const changedRoot = repository();
  t.after(() => fs.rmSync(changedRoot, { recursive: true, force: true }));
  const changedSubject = dirtySubject(changedRoot);
  const currentBase = requestImplementationBase(changedRoot);
  const replacementBase = String(git(changedRoot, ['rev-parse', 'HEAD'])).trim();
  assert.notEqual(currentBase, replacementBase);
  assert.throws(() => prepareRequestClosure(changedRoot, {
    promotion_unit_id: 'fixture/default',
    request_path: requestPath,
    proposed_request: completedRequestBytes(changedRoot).replace(
      currentBase, replacementBase
    ),
    subject: changedSubject,
    evidence: passingClosureEvidence(changedRoot, changedSubject),
    recorded_at: '2026-07-12T01:31:30.000Z',
    supersedes_record_sha256: null
  }), /cannot change the request Implementation Base SHA/);
  assert.throws(() => auditEvidenceLedger(changedRoot), /Evidence ref is missing/);
});

test('closure request paths reject symlink leaves, ancestors, and dangling targets', (t) => {
  for (const kind of ['leaf', 'ancestor', 'dangling']) {
    const root = repository();
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-request-outside-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    t.after(() => fs.rmSync(outside, { recursive: true, force: true }));
    const requestRelative = 'docs/features/fixture/requests/2026-07-12-fixture.md';
    const requestPath = path.join(root, requestRelative);
    const proposedRequest = completedRequestBytes(root);
    const outsideRequest = path.join(outside, '2026-07-12-fixture.md');
    fs.writeFileSync(outsideRequest, 'outside sentinel\n');
    if (kind === 'ancestor') {
      const fixtureDirectory = path.join(root, 'docs', 'features', 'fixture');
      fs.rmSync(fixtureDirectory, { recursive: true });
      fs.mkdirSync(path.join(outside, 'requests'));
      fs.writeFileSync(path.join(outside, 'requests', '2026-07-12-fixture.md'),
        'outside sentinel\n');
      fs.symlinkSync(outside, fixtureDirectory);
    } else {
      fs.rmSync(requestPath);
      fs.symlinkSync(kind === 'dangling' ? path.join(outside, 'missing.md') : outsideRequest,
        requestPath);
    }
    const before = fs.readFileSync(outsideRequest, 'utf8');
    assert.throws(() => prepareRequestClosure(root, {
      promotion_unit_id: 'fixture/default',
      request_path: requestRelative,
      proposed_request: proposedRequest,
      subject: dirtySubject(root),
      evidence: passingClosureEvidence(root),
      recorded_at: '2026-07-12T01:36:00.000Z',
      supersedes_record_sha256: null
    }), /symlink/);
    assert.equal(fs.readFileSync(outsideRequest, 'utf8'), before);
  }

  const swappedRoot = repository();
  const swappedOutside = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-request-swap-'));
  t.after(() => fs.rmSync(swappedRoot, { recursive: true, force: true }));
  t.after(() => fs.rmSync(swappedOutside, { recursive: true, force: true }));
  const requestRelative = 'docs/features/fixture/requests/2026-07-12-fixture.md';
  const swappedSubject = dirtySubject(swappedRoot);
  const pending = prepareRequestClosure(swappedRoot, {
    promotion_unit_id: 'fixture/default',
    request_path: requestRelative,
    proposed_request: completedRequestBytes(swappedRoot),
    subject: swappedSubject,
    evidence: passingClosureEvidence(swappedRoot, swappedSubject),
    recorded_at: '2026-07-12T01:36:30.000Z',
    supersedes_record_sha256: null
  });
  const outsideRequest = path.join(swappedOutside, 'outside.md');
  fs.writeFileSync(outsideRequest, 'outside sentinel\n');
  fs.rmSync(path.join(swappedRoot, requestRelative));
  fs.symlinkSync(outsideRequest, path.join(swappedRoot, requestRelative));
  assert.throws(() => applyRequestClosure(swappedRoot, {
    pending_record_sha256: pending.record_sha256
  }), /symlink/);
  assert.equal(fs.readFileSync(outsideRequest, 'utf8'), 'outside sentinel\n');

  const racedRoot = repository();
  const racedOutside = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-request-race-'));
  t.after(() => fs.rmSync(racedRoot, { recursive: true, force: true }));
  t.after(() => fs.rmSync(racedOutside, { recursive: true, force: true }));
  const racedSubject = dirtySubject(racedRoot);
  const racedPending = prepareRequestClosure(racedRoot, {
    promotion_unit_id: 'fixture/default',
    request_path: requestRelative,
    proposed_request: completedRequestBytes(racedRoot),
    subject: racedSubject,
    evidence: passingClosureEvidence(racedRoot, racedSubject),
    recorded_at: '2026-07-12T01:36:40.000Z',
    supersedes_record_sha256: null
  });
  const racedExternalRequest = path.join(racedOutside, 'outside.md');
  fs.writeFileSync(racedExternalRequest, 'outside sentinel\n');
  assert.throws(() => applyRequestClosure(racedRoot, {
    pending_record_sha256: racedPending.record_sha256
  }, {
    beforeRename({ request }) {
      fs.rmSync(request);
      fs.symlinkSync(racedExternalRequest, request);
    }
  }), /symlink|identity changed/);
  assert.equal(fs.readFileSync(racedExternalRequest, 'utf8'), 'outside sentinel\n');

  const ancestorRoot = repository();
  const ancestorOutside = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-request-ancestor-'));
  t.after(() => fs.rmSync(ancestorRoot, { recursive: true, force: true }));
  t.after(() => fs.rmSync(ancestorOutside, { recursive: true, force: true }));
  const ancestorSubject = dirtySubject(ancestorRoot);
  const ancestorPending = prepareRequestClosure(ancestorRoot, {
    promotion_unit_id: 'fixture/default',
    request_path: requestRelative,
    proposed_request: completedRequestBytes(ancestorRoot),
    subject: ancestorSubject,
    evidence: passingClosureEvidence(ancestorRoot, ancestorSubject),
    recorded_at: '2026-07-12T01:36:50.000Z',
    supersedes_record_sha256: null
  });
  const requestsDirectory = path.dirname(path.join(ancestorRoot, requestRelative));
  const savedRequests = `${requestsDirectory}.saved`;
  const outsideLeaf = path.join(ancestorOutside, '2026-07-12-fixture.md');
  fs.writeFileSync(outsideLeaf, 'outside sentinel\n');
  assert.throws(() => applyRequestClosure(ancestorRoot, {
    pending_record_sha256: ancestorPending.record_sha256
  }, {
    beforeRename() {
      fs.renameSync(requestsDirectory, savedRequests);
      fs.symlinkSync(ancestorOutside, requestsDirectory);
    }
  }), /symlink|identity changed/);
  assert.equal(fs.readFileSync(outsideLeaf, 'utf8'), 'outside sentinel\n');
  assert.equal(fs.readFileSync(path.join(savedRequests,
    '2026-07-12-fixture.md'), 'utf8').includes('In Progress'), true);
  assert.equal(fs.readdirSync(savedRequests).some((name) =>
    name.startsWith('.sd0x-request-')
  ), false);
});

test('closure prepare and finalize reject interposed worktree drift before append', (t) => {
  const prepareRoot = repository();
  t.after(() => fs.rmSync(prepareRoot, { recursive: true, force: true }));
  const requestPath = 'docs/features/fixture/requests/2026-07-12-fixture.md';
  const subject = dirtySubject(prepareRoot);
  assert.throws(() => prepareRequestClosure(prepareRoot, {
    promotion_unit_id: 'fixture/default',
    request_path: requestPath,
    proposed_request: completedRequestBytes(prepareRoot),
    subject,
    evidence: passingClosureEvidence(prepareRoot, subject),
    recorded_at: '2026-07-12T01:37:00.000Z',
    supersedes_record_sha256: null
  }, {
    beforeAppend() {
      fs.writeFileSync(path.join(prepareRoot, 'app.js'), 'module.exports = 99;\n');
    }
  }), /stale|drifted|changed/);
  assert.throws(() => auditEvidenceLedger(prepareRoot), /Evidence ref is missing/);

  const headRoot = repository();
  t.after(() => fs.rmSync(headRoot, { recursive: true, force: true }));
  const headSubject = dirtySubject(headRoot);
  assert.throws(() => prepareRequestClosure(headRoot, {
    promotion_unit_id: 'fixture/default',
    request_path: requestPath,
    proposed_request: completedRequestBytes(headRoot),
    subject: headSubject,
    evidence: passingClosureEvidence(headRoot, headSubject),
    recorded_at: '2026-07-12T01:37:30.000Z',
    supersedes_record_sha256: null
  }, {
    beforeFinalSnapshot() {
      git(headRoot, ['commit', '--allow-empty', '-m', 'interposed head']);
    }
  }), /changed during locked derivation/);
  assert.throws(() => auditEvidenceLedger(headRoot), /Evidence ref is missing/);

  const finalizeRoot = repository();
  t.after(() => fs.rmSync(finalizeRoot, { recursive: true, force: true }));
  const finalizeSubject = dirtySubject(finalizeRoot);
  const pending = prepareRequestClosure(finalizeRoot, {
    promotion_unit_id: 'fixture/default',
    request_path: requestPath,
    proposed_request: completedRequestBytes(finalizeRoot),
    subject: finalizeSubject,
    evidence: passingClosureEvidence(finalizeRoot, finalizeSubject),
    recorded_at: '2026-07-12T01:38:00.000Z',
    supersedes_record_sha256: null
  });
  fs.writeFileSync(path.join(finalizeRoot, requestPath), completedRequestBytes(finalizeRoot));
  recordCleanReview(finalizeRoot);
  assert.throws(() => finalizeRequestClosure(finalizeRoot, {
    pending_record_sha256: pending.record_sha256,
    recorded_at: '2026-07-12T01:39:00.000Z',
    supersedes_record_sha256: null
  }, {
    beforeAppend() {
      fs.writeFileSync(path.join(finalizeRoot, 'app.js'), 'module.exports = 100;\n');
    }
  }), /projection drifted|review pass|inputs drifted/);
  assert.equal(String(git(finalizeRoot, ['rev-parse', EVIDENCE_REF])).trim(), pending.oid);

  const applyHeadRoot = repository();
  t.after(() => fs.rmSync(applyHeadRoot, { recursive: true, force: true }));
  const applyHeadSubject = dirtySubject(applyHeadRoot);
  const applyHeadPending = prepareRequestClosure(applyHeadRoot, {
    promotion_unit_id: 'fixture/default',
    request_path: requestPath,
    proposed_request: completedRequestBytes(applyHeadRoot),
    subject: applyHeadSubject,
    evidence: passingClosureEvidence(applyHeadRoot, applyHeadSubject),
    recorded_at: '2026-07-12T01:39:30.000Z',
    supersedes_record_sha256: null
  });
  assert.throws(() => applyRequestClosure(applyHeadRoot, {
    pending_record_sha256: applyHeadPending.record_sha256
  }, {
    beforeWrite() {
      git(applyHeadRoot, ['commit', '--allow-empty', '-m', 'apply head drift']);
    }
  }), /did not preserve|HEAD\/tree changed/);
  const interruptedRequest = fs.readFileSync(path.join(applyHeadRoot, requestPath));
  assert.equal(interruptedRequest.toString('utf8').includes('Completed'), true);
  recoverRequestClosure(applyHeadRoot, {
    pending_record_sha256: applyHeadPending.record_sha256,
    action: 'restore-prior',
    expected_current_sha256: sha256(interruptedRequest)
  });
  assert.equal(fs.readFileSync(path.join(applyHeadRoot, requestPath), 'utf8')
    .includes('In Progress'), true);
});

test('closure AC evidence must resolve to a real line in the bound repository subject', (t) => {
  for (const [name, reference] of [
    ['absolute', `${absoluteFixture('etc', 'passwd')}:1`],
    ['traversal', '../outside.js:1'],
    ['missing', 'missing.js:1'],
    ['line', 'app.js:999'],
    ['symlink', 'linked-app.js:1']
  ]) {
    const root = repository();
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    if (name === 'symlink') fs.symlinkSync('app.js', path.join(root, 'linked-app.js'));
    const subject = dirtySubject(root);
    const evidence = passingClosureEvidence(root, subject);
    evidence.ac.verdicts[0].evidence = [reference];
    assert.throws(() => prepareRequestClosure(root, {
      promotion_unit_id: 'fixture/default',
      request_path: 'docs/features/fixture/requests/2026-07-12-fixture.md',
      proposed_request: completedRequestBytes(root),
      subject,
      evidence,
      recorded_at: '2026-07-12T01:35:00.000Z',
      supersedes_record_sha256: null
    }), /canonical|repository-relative|missing|out of range|symlink/);
  }
});

test('closure AC evidence requires a location outside its own request', (t) => {
  const root = repository();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const requestPath = 'docs/features/fixture/requests/2026-07-12-fixture.md';
  const requestLines = fs.readFileSync(path.join(root, requestPath), 'utf8')
    .replace(/\r\n/g, '\n').split('\n');
  const checkboxLine = requestLines.findIndex((line) => /^- \[ \]/.test(line)) + 1;
  const progressLine = requestLines.findIndex((line) =>
    line === '| Acceptance | Pending |'
  ) + 1;

  for (const locations of [
    [`${requestPath}:${checkboxLine}`],
    [`${requestPath}:${progressLine}`],
    [`${requestPath}:${checkboxLine}`, `${requestPath}:${progressLine}`]
  ]) {
    const subject = dirtySubject(root);
    const evidence = passingClosureEvidence(root, subject);
    evidence.ac.verdicts[0].evidence = locations;
    assert.throws(() => prepareRequestClosure(root, {
      promotion_unit_id: 'fixture/default',
      request_path: requestPath,
      proposed_request: completedRequestBytes(root),
      subject,
      evidence,
      recorded_at: '2026-07-12T01:35:15.000Z',
      supersedes_record_sha256: null
    }), /requires at least one location outside its own request/);
  }
});

test('schema v2 raw append and audit reject request-only AC evidence', (t) => {
  const root = repository();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const bundle = useRequestOnlyAcEvidence(root, record(root));

  assert.throws(() => appendEvidenceRevision(root, bundle.value, bundle.blobs, {
    expected_old_oid: null
  }), /requires at least one location outside its own request/);
  installRawEvidenceBundle(root, bundle);
  assert.throws(() => auditEvidenceLedger(root),
    /requires at least one location outside its own request/);
});

test('legacy request-only pending evidence audits only for supersession', (t) => {
  const root = repository();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const legacy = useRequestOnlyAcEvidence(root, record(root));
  legacy.value.schema_version = 1;
  rehashEvidenceBundle(root, legacy);
  installRawEvidenceBundle(root, legacy);

  assert.equal(auditEvidenceLedger(root).ok, true);
  const request = path.join(root, legacy.value.request_path);
  const priorBytes = fs.readFileSync(request);
  assert.throws(() => applyRequestClosure(root, {
    pending_record_sha256: legacy.value.record_sha256
  }), /Legacy pending closure must be superseded before apply/);
  assert.deepEqual(fs.readFileSync(request), priorBytes);
  assert.throws(() => finalizeRequestClosure(root, {
    pending_record_sha256: legacy.value.record_sha256,
    recorded_at: '2026-07-12T01:35:20.000Z',
    supersedes_record_sha256: null
  }), /Legacy pending closure must be superseded/);

  const requestIdentity = fs.statSync(request, { bigint: true });
  const journal = resolveRuntimeMetadataPath(root, path.join(
    'closure-apply-journals', `${legacy.value.record_sha256}.json`
  ));
  fs.mkdirSync(path.dirname(journal), { recursive: true });
  fs.writeFileSync(journal, `${JSON.stringify({
    schema_version: 1,
    pending_record_sha256: legacy.value.record_sha256,
    request_path: legacy.value.request_path,
    prior_sha256: legacy.value.prior_request_content_sha256,
    proposed_sha256: legacy.value.proposed_request_content_sha256,
    dev: requestIdentity.dev.toString(),
    ino: requestIdentity.ino.toString(),
    recorded_at: '2026-07-12T01:35:21.000Z'
  })}\n`);
  const interruptedBytes = Buffer.from('legacy interrupted apply\n');
  fs.writeFileSync(request, interruptedBytes);
  const recovered = recoverRequestClosure(root, {
    pending_record_sha256: legacy.value.record_sha256,
    action: 'restore-prior',
    expected_current_sha256: sha256(interruptedBytes)
  });
  assert.equal(recovered.action, 'restore-prior');
  assert.deepEqual(fs.readFileSync(request), priorBytes);

  const subject = dirtySubject(root);
  const replacement = prepareRequestClosure(root, {
    promotion_unit_id: 'fixture/default',
    request_path: legacy.value.request_path,
    proposed_request: completedRequestBytes(root),
    subject,
    evidence: passingClosureEvidence(root, subject),
    recorded_at: '2026-07-12T01:35:30.000Z',
    supersedes_record_sha256: legacy.value.record_sha256
  });
  assert.equal(replacement.record.schema_version, 2);
  assert.equal(replacement.record.supersedes_record_sha256,
    legacy.value.record_sha256);
  assert.equal(auditEvidenceLedger(root).ok, true);
});

test('closure prepare refuses exact proposed bytes that would require redaction', (t) => {
  for (const unsafe of [
    privateKeyFixture('\nunsafe\n'),
    bearerFixture('\n')
  ]) {
    const root = repository();
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const subject = dirtySubject(root);
    assert.throws(() => prepareRequestClosure(root, {
      promotion_unit_id: 'fixture/default',
      request_path: 'docs/features/fixture/requests/2026-07-12-fixture.md',
      proposed_request: `${completedRequestBytes(root)}\n${unsafe}`,
      subject,
      evidence: passingClosureEvidence(root, subject),
      recorded_at: '2026-07-12T01:35:30.000Z',
      supersedes_record_sha256: null
    }), /private-key|requires redaction/);
    assert.throws(() => auditEvidenceLedger(root), /Evidence ref is missing/);
  }
});

test('docs-only closure persists an exact not-required verify decision', (t) => {
  const root = repository();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'app.js'), 'module.exports = 1;\n');
  fs.writeFileSync(path.join(root, 'notes.md'), '# Docs-only evidence\n');
  const subject = dirtySubject(root);
  const state = recordCleanReview(root);
  const requestPath = 'docs/features/fixture/requests/2026-07-12-fixture.md';
  const pending = prepareRequestClosure(root, {
    promotion_unit_id: 'fixture/default',
    request_path: requestPath,
    proposed_request: completedRequestBytes(root),
    subject,
    evidence: {
      subject_review: {
        binding: subject,
        provider: 'codex',
        evidence: durableReviewEvidence(state)
      },
      verify: {
        binding: subject,
        provider: 'codex',
        evidence: { not_required: true }
      },
      ac: {
        verdicts: [{
          ac: 1,
          status: 'Complete',
          confidence: 'High',
          evidence: ['notes.md:1']
        }]
      },
      checks: { commands: [{ argv: ['node', '--test'], exit_code: 0 }] }
    },
    recorded_at: '2026-07-12T01:40:00.000Z',
    supersedes_record_sha256: null
  });
  assert.equal(pending.record.verify_required, false);
  assert.equal(auditEvidenceLedger(root).ok, true);
});

test('clean commit closure binds base, HEAD, tree, and a clean projection', (t) => {
  const root = repository();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  git(root, ['add', 'app.js']);
  commit(root, 'implementation');
  const subject = {
    kind: 'commit',
    base_sha: requestImplementationBase(root),
    head_sha: String(git(root, ['rev-parse', 'HEAD'])).trim(),
    tree_sha: String(git(root, ['rev-parse', 'HEAD^{tree}'])).trim()
  };
  const requestPath = 'docs/features/fixture/requests/2026-07-12-fixture.md';
  assert.throws(() => prepareRequestClosure(root, {
    promotion_unit_id: 'fixture/default',
    request_path: requestPath,
    proposed_request: completedRequestBytes(root),
    subject,
    evidence: passingCommitClosureEvidence(subject),
    recorded_at: '2026-07-12T01:44:00.000Z',
    supersedes_record_sha256: null
  }), /attestation is unavailable/);
  beginCommitClosureReview(root, subject);
  assert.match(commitClosureReviewerContext(root),
    new RegExp(`${subject.base_sha}\\.\\.${subject.head_sha}`));
  let state = recordCleanReview(root);
  state = recordVerification(root, 'pass', {
    runner: 'sd0x-deterministic-v1',
    commands: [{ command: 'node --test', exit_code: 0 }]
  }, state.worktree.fingerprint, 'codex');
  const attestation = attestCommitClosureReview(root, subject);
  assert.equal(attestation.reviewer_bindings.length, 2);
  assert.ok(attestation.reviewer_bindings.every((binding) =>
    binding.subject_sha256 === attestation.subject_sha256
  ));
  assert.deepEqual(
    attestation.review_evidence.subject_bindings,
    attestation.reviewer_bindings
  );
  assert.throws(() => prepareRequestClosure(root, {
    promotion_unit_id: 'fixture/default',
    request_path: requestPath,
    proposed_request: completedRequestBytes(subject.head_sha),
    subject,
    evidence: {
      ...passingCommitClosureEvidence(subject),
      subject_review: {
        binding: subject,
        provider: 'codex',
        evidence: attestation.review_evidence
      },
      verify: {
        binding: subject,
        provider: 'codex',
        evidence: attestation.verify_evidence
      }
    },
    recorded_at: '2026-07-12T01:44:30.000Z',
    supersedes_record_sha256: null
  }), /must equal the request Implementation Base SHA|cannot change/);
  const pending = prepareRequestClosure(root, {
    promotion_unit_id: 'fixture/default',
    request_path: requestPath,
    proposed_request: completedRequestBytes(subject.base_sha),
    subject,
    evidence: {
      ...passingCommitClosureEvidence(subject),
      subject_review: {
        binding: subject,
        provider: 'codex',
        evidence: attestation.review_evidence
      },
      verify: {
        binding: subject,
        provider: 'codex',
        evidence: attestation.verify_evidence
      }
    },
    recorded_at: '2026-07-12T01:45:00.000Z',
    supersedes_record_sha256: null
  });
  assert.equal(pending.record.non_request_projection_sha256, 'clean');
  assert.equal(pending.record.implementation_base_sha, subject.base_sha);
  fs.writeFileSync(path.join(root, requestPath), completedRequestBytes(subject.base_sha));
  recordCleanReview(root);
  const closure = finalizeRequestClosure(root, {
    pending_record_sha256: pending.record_sha256,
    recorded_at: '2026-07-12T01:46:00.000Z',
    supersedes_record_sha256: null
  });
  assert.equal(closure.record.pending_record_sha256, pending.record_sha256);
});

test('clean commit closure fails closed for the Claude provider', (t) => {
  const root = repository();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, '.codex'), { recursive: true });
  fs.writeFileSync(path.join(root, '.codex', 'sd0x-dev-flow.json'), JSON.stringify({
    schema_version: 1,
    enabled: true,
    review: { provider: 'claude' }
  }));
  git(root, ['add', 'app.js', '.codex/sd0x-dev-flow.json']);
  commit(root, 'implementation with claude provider');
  const subject = {
    kind: 'commit',
    base_sha: String(git(root, ['rev-parse', 'HEAD^'])).trim(),
    head_sha: String(git(root, ['rev-parse', 'HEAD'])).trim(),
    tree_sha: String(git(root, ['rev-parse', 'HEAD^{tree}'])).trim()
  };
  assert.throws(
    () => beginCommitClosureReview(root, subject),
    /requires the codex review provider/
  );
});

test('legacy three-view commit markers rotate without reusing evidence', (t) => {
  const root = repository();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  git(root, ['add', 'app.js']);
  commit(root, 'implementation');
  const subject = {
    kind: 'commit',
    base_sha: String(git(root, ['rev-parse', 'HEAD^'])).trim(),
    head_sha: String(git(root, ['rev-parse', 'HEAD'])).trim(),
    tree_sha: String(git(root, ['rev-parse', 'HEAD^{tree}'])).trim()
  };
  const markerPath = resolveRuntimeMetadataPath(root,
    'commit-closure-review.json');
  const legacy = beginCommitClosureReview(root, subject);
  legacy.schema_version = 1;
  legacy.reviewer_bindings = [{
    agent_id: 'legacy-implementation-reviewer',
    agent_type: 'sd0x_reviewer',
    subject_sha256: legacy.subject_sha256,
    started_at: legacy.started_at
  }];
  fs.writeFileSync(markerPath, `${JSON.stringify(legacy)}\n`);
  resetState(root);

  assert.doesNotThrow(() => recordSubagent(root, 'start', {
    agent_id: 'post-upgrade-primary',
    agent_type: 'sd0x_codex_primary_reviewer'
  }));
  assert.doesNotThrow(() => recordSubagent(root, 'stop', {
    agent_id: 'post-upgrade-primary',
    agent_type: 'sd0x_codex_primary_reviewer',
    last_assistant_message: 'No actionable findings remain.'
  }));
  assert.equal(refreshState(root).review_agents.completed.length, 1);

  const fresh = beginCommitClosureReview(root, subject);
  assert.equal(fresh.schema_version, 2);
  assert.notEqual(fresh.generation, legacy.generation);
  assert.deepEqual(fresh.reviewer_bindings, []);
  assert.equal(fresh.review_evidence, null);
  assert.equal(fresh.verify_evidence, null);
  assert.ok(fs.readdirSync(path.dirname(markerPath)).some((name) =>
    name.startsWith('commit-closure-review.json.legacy-three-view.')
  ));
});

test('stale commit attestation cannot overwrite a successor marker generation', (t) => {
  const root = repository();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  git(root, ['add', 'app.js']);
  commit(root, 'implementation');
  const subject = {
    kind: 'commit',
    base_sha: String(git(root, ['rev-parse', 'HEAD^'])).trim(),
    head_sha: String(git(root, ['rev-parse', 'HEAD'])).trim(),
    tree_sha: String(git(root, ['rev-parse', 'HEAD^{tree}'])).trim()
  };
  const first = beginCommitClosureReview(root, subject);
  let state = recordCleanReview(root);
  state = recordVerification(root, 'pass', {
    runner: 'sd0x-deterministic-v1',
    commands: [{ command: 'node --test', exit_code: 0 }]
  }, state.worktree.fingerprint, 'codex');
  const markerPath = resolveRuntimeMetadataPath(root, 'commit-closure-review.json');
  assert.throws(() => attestCommitClosureReview(root, subject, {
    beforeWrite() {
      const successor = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
      successor.generation = crypto.randomUUID();
      successor.started_at = new Date(Date.parse(successor.started_at) + 1).toISOString();
      fs.writeFileSync(markerPath, `${JSON.stringify(successor)}\n`);
    }
  }), /generation changed/);
  const surviving = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
  assert.equal(surviving.status, 'pending');
  assert.notEqual(surviving.generation, first.generation);
  const actualSuccessor = beginCommitClosureReview(root, subject);
  assert.notEqual(actualSuccessor.generation, first.generation);
});

test('commit closure attestation is invalid after a runtime reset', (t) => {
  const root = repository();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  git(root, ['add', 'app.js']);
  commit(root, 'implementation');
  const subject = {
    kind: 'commit',
    base_sha: String(git(root, ['rev-parse', 'HEAD^'])).trim(),
    head_sha: String(git(root, ['rev-parse', 'HEAD'])).trim(),
    tree_sha: String(git(root, ['rev-parse', 'HEAD^{tree}'])).trim()
  };
  beginCommitClosureReview(root, subject);
  let state = recordCleanReview(root);
  state = recordVerification(root, 'pass', {
    runner: 'sd0x-deterministic-v1',
    commands: [{ command: 'node --test', exit_code: 0 }]
  }, state.worktree.fingerprint, 'codex');
  const attestation = attestCommitClosureReview(root, subject);
  resetState(root);
  const evidence = passingCommitClosureEvidence(subject);
  evidence.subject_review.evidence = attestation.review_evidence;
  evidence.verify.evidence = attestation.verify_evidence;
  assert.throws(() => prepareRequestClosure(root, {
    promotion_unit_id: 'fixture/default',
    request_path: 'docs/features/fixture/requests/2026-07-12-fixture.md',
    proposed_request: completedRequestBytes(root),
    subject,
    evidence,
    recorded_at: '2026-07-12T01:50:00.000Z',
    supersedes_record_sha256: null
  }), /matching completed attestation/);
});

test('closure finalization rejects proposed request and non-request drift', (t) => {
  for (const drift of ['request', 'projection']) {
    const root = repository();
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const requestPath = 'docs/features/fixture/requests/2026-07-12-fixture.md';
    const pending = prepareRequestClosure(root, {
      promotion_unit_id: 'fixture/default',
      request_path: requestPath,
      proposed_request: completedRequestBytes(root),
      subject: dirtySubject(root),
      evidence: passingClosureEvidence(root),
      recorded_at: '2026-07-12T02:00:00.000Z',
      supersedes_record_sha256: null
    });
    fs.writeFileSync(path.join(root, requestPath), completedRequestBytes(root));
    if (drift === 'request') fs.appendFileSync(path.join(root, requestPath), '\ndrift\n');
    else fs.writeFileSync(path.join(root, 'app.js'), 'module.exports = 3;\n');
    assert.throws(() => finalizeRequestClosure(root, {
      pending_record_sha256: pending.record_sha256,
      recorded_at: '2026-07-12T02:01:00.000Z',
      supersedes_record_sha256: null
    }), drift === 'request' ? /request bytes drifted/ : /projection drifted/);
  }

  const racedRoot = repository();
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-finalize-race-'));
  t.after(() => fs.rmSync(racedRoot, { recursive: true, force: true }));
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }));
  const requestPath = 'docs/features/fixture/requests/2026-07-12-fixture.md';
  const racedPending = prepareRequestClosure(racedRoot, {
    promotion_unit_id: 'fixture/default',
    request_path: requestPath,
    proposed_request: completedRequestBytes(racedRoot),
    subject: dirtySubject(racedRoot),
    evidence: passingClosureEvidence(racedRoot),
    recorded_at: '2026-07-12T02:02:00.000Z',
    supersedes_record_sha256: null
  });
  const request = path.join(racedRoot, requestPath);
  fs.writeFileSync(request, completedRequestBytes(racedRoot));
  recordCleanReview(racedRoot);
  const saved = `${request}.saved`;
  const outsideRequest = path.join(outside, path.basename(request));
  fs.writeFileSync(outsideRequest, completedRequestBytes(racedRoot));
  const evidenceOid = evidenceGit(racedRoot, ['rev-parse', EVIDENCE_REF]);
  assert.throws(() => finalizeRequestClosure(racedRoot, {
    pending_record_sha256: racedPending.record_sha256,
    recorded_at: '2026-07-12T02:03:00.000Z',
    supersedes_record_sha256: null
  }, {
    beforeRequestRead() {
      fs.renameSync(request, saved);
      fs.symlinkSync(outsideRequest, request);
    }
  }), /path identity changed|changed while it was read/);
  assert.equal(evidenceGit(racedRoot, ['rev-parse', EVIDENCE_REF]), evidenceOid);
  assert.equal(fs.readFileSync(outsideRequest, 'utf8'), completedRequestBytes(racedRoot));
});

test('promotion records require final closure and current review/verify gates', (t) => {
  const root = repository();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const requestPath = 'docs/features/fixture/requests/2026-07-12-fixture.md';
  const pending = prepareRequestClosure(root, {
    promotion_unit_id: 'fixture/default',
    request_path: requestPath,
    proposed_request: completedRequestBytes(root),
    subject: dirtySubject(root),
    evidence: passingClosureEvidence(root),
    recorded_at: '2026-07-12T03:00:00.000Z',
    supersedes_record_sha256: null
  });
  fs.writeFileSync(path.join(root, requestPath), completedRequestBytes(root));
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
    disposition_row: fixtureDisposition(),
    payload_tree_sha256: payloadTreeSha(root),
    reason: null,
    recorded_at: '2026-07-12T03:02:00.000Z',
    supersedes_record_sha256: null
  }), /verification pass/);
  state = recordVerification(root, 'pass', {
    runner: 'sd0x-deterministic-v1',
    commands: [{ command: 'node --test', exit_code: 0 }]
  }, state.worktree.fingerprint, 'codex');
  assert.equal(state.gates.verify.status, 'pass');
  const payloadDirectory = path.join(root, 'plugin', 'sd0x-dev-flow-codex',
    'skills', 'fixture');
  const savedPayloadDirectory = `${payloadDirectory}.saved`;
  const outsidePayload = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-payload-race-'));
  t.after(() => fs.rmSync(outsidePayload, { recursive: true, force: true }));
  fs.writeFileSync(path.join(outsidePayload, 'SKILL.md'), '# External payload\n');
  assert.throws(() => recordPromotionEvidence(root, {
    kind: 'promotion',
    promotion_unit_id: 'fixture/default',
    request_closure_record_sha256: closure.record_sha256,
    disposition_row: fixtureDisposition(),
    payload_tree_sha256: payloadTreeSha(root),
    reason: null,
    recorded_at: '2026-07-12T03:02:05.000Z',
    supersedes_record_sha256: null
  }, {
    beforePayloadTraversal() {
      fs.renameSync(payloadDirectory, savedPayloadDirectory);
      fs.symlinkSync(outsidePayload, payloadDirectory);
    }
  }), /payload file identity changed|missing path or symlink/);
  fs.rmSync(payloadDirectory);
  fs.renameSync(savedPayloadDirectory, payloadDirectory);
  const dispositionDirectory = path.join(root, 'migration');
  const dispositionPath = path.join(dispositionDirectory, 'source-disposition.json');
  const dispositionBytes = fs.readFileSync(dispositionPath);
  const outsideDisposition = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-disposition-'));
  t.after(() => fs.rmSync(outsideDisposition, { recursive: true, force: true }));
  fs.writeFileSync(path.join(outsideDisposition, 'source-disposition.json'),
    dispositionBytes);
  const dispositionRef = evidenceGit(root, ['rev-parse', EVIDENCE_REF]);
  for (const kind of ['leaf', 'ancestor', 'dangling']) {
    fs.rmSync(dispositionDirectory, { recursive: true, force: true });
    if (kind === 'ancestor') {
      fs.symlinkSync(outsideDisposition, dispositionDirectory);
    } else {
      fs.mkdirSync(dispositionDirectory);
      fs.symlinkSync(kind === 'leaf'
        ? path.join(outsideDisposition, 'source-disposition.json')
        : path.join(outsideDisposition, 'missing.json'), dispositionPath);
    }
    assert.throws(() => recordPromotionEvidence(root, {
      kind: 'promotion',
      promotion_unit_id: 'fixture/default',
      request_closure_record_sha256: closure.record_sha256,
      disposition_row: fixtureDisposition(),
      payload_tree_sha256: payloadTreeSha(root),
      reason: null,
      recorded_at: '2026-07-12T03:02:10.000Z',
      supersedes_record_sha256: null
    }), /disposition path is missing or symlinked/);
    assert.equal(evidenceGit(root, ['rev-parse', EVIDENCE_REF]), dispositionRef);
  }
  fs.rmSync(dispositionDirectory, { recursive: true, force: true });
  fs.mkdirSync(dispositionDirectory);
  fs.writeFileSync(dispositionPath, dispositionBytes);
  state = recordCleanReview(root);
  state = recordVerification(root, 'pass', {
    runner: 'sd0x-deterministic-v1',
    commands: [{ command: 'node --test', exit_code: 0 }]
  }, state.worktree.fingerprint, 'codex');
  assert.throws(() => recordPromotionEvidence(root, {
    kind: 'promotion',
    promotion_unit_id: 'fixture/default',
    request_closure_record_sha256: closure.record_sha256,
    disposition_row: fixtureDisposition({ rationale: 'Caller-forged drift.' }),
    payload_tree_sha256: payloadTreeSha(root),
    reason: null,
    recorded_at: '2026-07-12T03:02:30.000Z',
    supersedes_record_sha256: null
  }), /does not match current repository disposition/);
  assert.throws(() => recordPromotionEvidence(root, {
    kind: 'promotion',
    promotion_unit_id: 'fixture/default',
    request_closure_record_sha256: closure.record_sha256,
    disposition_row: fixtureDisposition(),
    payload_tree_sha256: 'a'.repeat(64),
    reason: null,
    recorded_at: '2026-07-12T03:02:31.000Z',
    supersedes_record_sha256: null
  }), /does not match current payload bytes/);
  const wrongOwnerRow = fixtureDisposition({
    promotion_request: 'docs/features/fixture/requests/2026-07-12-supporting.md'
  });
  fs.writeFileSync(path.join(root, 'migration', 'source-disposition.json'),
    `${JSON.stringify({ skills: [wrongOwnerRow] }, null, 2)}\n`);
  state = recordCleanReview(root);
  state = recordVerification(root, 'pass', {
    runner: 'sd0x-deterministic-v1',
    commands: [{ command: 'node --test', exit_code: 0 }]
  }, state.worktree.fingerprint, 'codex');
  assert.throws(() => recordPromotionEvidence(root, {
    kind: 'promotion',
    promotion_unit_id: 'fixture/default',
    request_closure_record_sha256: closure.record_sha256,
    disposition_row: wrongOwnerRow,
    payload_tree_sha256: payloadTreeSha(root),
    reason: null,
    recorded_at: '2026-07-12T03:02:45.000Z',
    supersedes_record_sha256: null
  }), /does not match the unit gate owner/);
  const escapingTargetRow = fixtureDisposition({ target_skill: '../../../test' });
  fs.writeFileSync(path.join(root, 'migration', 'source-disposition.json'),
    `${JSON.stringify({ skills: [escapingTargetRow] }, null, 2)}\n`);
  state = recordCleanReview(root);
  state = recordVerification(root, 'pass', {
    runner: 'sd0x-deterministic-v1',
    commands: [{ command: 'node --test', exit_code: 0 }]
  }, state.worktree.fingerprint, 'codex');
  assert.throws(() => recordPromotionEvidence(root, {
    kind: 'promotion',
    promotion_unit_id: 'fixture/default',
    request_closure_record_sha256: closure.record_sha256,
    disposition_row: escapingTargetRow,
    payload_tree_sha256: payloadTreeSha(root),
    reason: null,
    recorded_at: '2026-07-12T03:02:46.000Z',
    supersedes_record_sha256: null
  }), /canonical slugs/);
  fs.writeFileSync(path.join(root, 'migration', 'source-disposition.json'),
    `${JSON.stringify({ skills: [fixtureDisposition()] }, null, 2)}\n`);
  state = recordCleanReview(root);
  state = recordVerification(root, 'pass', {
    runner: 'sd0x-deterministic-v1',
    commands: [{ command: 'node --test', exit_code: 0 }]
  }, state.worktree.fingerprint, 'codex');
  const payloadSkillPath = path.join(root, 'plugin', 'sd0x-dev-flow-codex',
    'skills', 'fixture', 'SKILL.md');
  const payloadBeforeDrift = fs.readFileSync(payloadSkillPath);
  const beforePromotionOid = evidenceGit(root, ['rev-parse', EVIDENCE_REF]);
  assert.throws(() => recordPromotionEvidence(root, {
    kind: 'promotion',
    promotion_unit_id: 'fixture/default',
    request_closure_record_sha256: closure.record_sha256,
    disposition_row: fixtureDisposition(),
    payload_tree_sha256: payloadTreeSha(root),
    reason: null,
    recorded_at: '2026-07-12T03:02:59.000Z',
    supersedes_record_sha256: null
  }, {
    beforeAppend() {
      fs.appendFileSync(payloadSkillPath, 'interposed drift\n');
    }
  }), /review pass|inputs drifted/);
  assert.equal(evidenceGit(root, ['rev-parse', EVIDENCE_REF]), beforePromotionOid);
  fs.writeFileSync(payloadSkillPath, payloadBeforeDrift);
  state = recordCleanReview(root);
  state = recordVerification(root, 'pass', {
    runner: 'sd0x-deterministic-v1',
    commands: [{ command: 'node --test', exit_code: 0 }]
  }, state.worktree.fingerprint, 'codex');
  const promotion = recordPromotionEvidence(root, {
    kind: 'promotion',
    promotion_unit_id: 'fixture/default',
    request_closure_record_sha256: closure.record_sha256,
    disposition_row: fixtureDisposition(),
    payload_tree_sha256: payloadTreeSha(root),
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
    payload_tree_sha256: payloadTreeSha(root),
    disposition_row_sha256: sha256(canonicalJson(fixtureDisposition()))
  });
  assert.equal(audit.ok, true);
  assert.equal(audit.selected.record_sha256, promotion.record_sha256);
  const completedRequest = fs.readFileSync(path.join(root, requestPath));
  fs.writeFileSync(path.join(root, requestPath), completedRequest.toString('utf8')
    .replace('> **Status**: Completed', '> **Status**: In Progress'));
  assert.throws(() => auditEvidenceLedger(root, {
    promotion_unit_id: 'fixture/default',
    kind: 'promotion'
  }), /Current request no longer matches durable completion evidence/);
  fs.writeFileSync(path.join(root, requestPath), completedRequest);
  const auditOutside = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-audit-race-'));
  t.after(() => fs.rmSync(auditOutside, { recursive: true, force: true }));
  const auditRequest = path.join(root, requestPath);
  const savedAuditRequest = `${auditRequest}.saved`;
  const outsideAuditRequest = path.join(auditOutside, path.basename(auditRequest));
  fs.writeFileSync(outsideAuditRequest, completedRequestBytes(root));
  assert.throws(() => auditEvidenceLedger(root, {
    promotion_unit_id: 'fixture/default',
    kind: 'promotion',
    payload_tree_sha256: payloadTreeSha(root),
    disposition_row_sha256: sha256(canonicalJson(fixtureDisposition()))
  }, {
    beforeRequestRead() {
      fs.renameSync(auditRequest, savedAuditRequest);
      fs.symlinkSync(outsideAuditRequest, auditRequest);
    }
  }), /path identity changed|changed while it was read/);
  fs.rmSync(auditRequest);
  fs.renameSync(savedAuditRequest, auditRequest);
  rewriteEvidenceCommitOrder(root, promotion.oid, [
    promotion.record, closure.record, pending.record
  ]);
  const reorderedOid = evidenceGit(root, ['rev-parse', EVIDENCE_REF]);
  assert.throws(() => auditEvidenceLedger(root), /must follow.*closure record/);
  evidenceGit(root, ['update-ref', EVIDENCE_REF, promotion.oid, reorderedOid]);
  git(root, ['add', '-A']);
  commit(root, 'completed promotion state');
  const cloneRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-promotion-clone-'));
  const bundleClone = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-promotion-bundle-'));
  const promotionBundle = path.join(os.tmpdir(),
    `sd0x-promotion-${crypto.randomUUID()}.bundle`);
  t.after(() => fs.rmSync(cloneRoot, { recursive: true, force: true }));
  t.after(() => fs.rmSync(bundleClone, { recursive: true, force: true }));
  t.after(() => fs.rmSync(promotionBundle, { force: true }));
  fs.rmSync(cloneRoot, { recursive: true });
  fs.rmSync(bundleClone, { recursive: true });
  git(path.dirname(cloneRoot), ['clone', '--quiet', '--no-local', root, cloneRoot]);
  git(cloneRoot, ['fetch', 'origin', `${EVIDENCE_REF}:${EVIDENCE_REF}`]);
  assert.equal(auditEvidenceLedger(cloneRoot, {
    promotion_unit_id: 'fixture/default',
    kind: 'promotion',
    request_path: requestPath,
    payload_tree_sha256: payloadTreeSha(cloneRoot),
    disposition_row_sha256: sha256(canonicalJson(fixtureDisposition()))
  }).selected.record_sha256, promotion.record_sha256);
  evidenceGit(root, ['bundle', 'create', promotionBundle, EVIDENCE_REF]);
  git(path.dirname(bundleClone), ['clone', '--quiet', '--no-local', root, bundleClone]);
  evidenceGit(bundleClone, [
    'fetch', promotionBundle, `${EVIDENCE_REF}:${EVIDENCE_REF}`
  ]);
  assert.equal(auditEvidenceLedger(bundleClone, {
    promotion_unit_id: 'fixture/default',
    kind: 'promotion',
    request_path: requestPath,
    payload_tree_sha256: payloadTreeSha(bundleClone),
    disposition_row_sha256: sha256(canonicalJson(fixtureDisposition()))
  }).selected.record_sha256, promotion.record_sha256);
  const skillPath = path.join(root, 'plugin', 'sd0x-dev-flow-codex', 'skills',
    'fixture', 'SKILL.md');
  fs.appendFileSync(skillPath, 'drift\n');
  assert.throws(() => auditEvidenceLedger(root, {
    promotion_unit_id: 'fixture/default',
    kind: 'promotion',
    payload_tree_sha256: payloadTreeSha(root),
    disposition_row_sha256: sha256(canonicalJson(fixtureDisposition()))
  }), /completion mismatch for payload_tree_sha256/);
  assert.throws(() => recordPromotionEvidence(root, {
    kind: 'promotion',
    promotion_unit_id: 'fixture/default',
    request_closure_record_sha256: closure.record_sha256,
    disposition_row: fixtureDisposition(),
    payload_tree_sha256: payloadTreeSha(root),
    reason: null,
    recorded_at: '2026-07-12T03:03:30.000Z',
    supersedes_record_sha256: promotion.record_sha256
  }), /current final review pass/);
  state = recordCleanReview(root);
  state = recordVerification(root, 'pass', {
    runner: 'sd0x-deterministic-v1',
    commands: [{ command: 'node --test', exit_code: 0 }]
  }, state.worktree.fingerprint, 'codex');
  const revisedPromotion = recordPromotionEvidence(root, {
    kind: 'promotion',
    promotion_unit_id: 'fixture/default',
    request_closure_record_sha256: closure.record_sha256,
    disposition_row: fixtureDisposition(),
    payload_tree_sha256: payloadTreeSha(root),
    reason: null,
    recorded_at: '2026-07-12T03:03:31.000Z',
    supersedes_record_sha256: promotion.record_sha256
  });
  assert.equal(auditEvidenceLedger(root, {
    promotion_unit_id: 'fixture/default',
    kind: 'promotion',
    payload_tree_sha256: payloadTreeSha(root),
    disposition_row_sha256: sha256(canonicalJson(fixtureDisposition()))
  }).selected.record_sha256, revisedPromotion.record_sha256);
  const packReadyRow = fixtureDisposition({
    target_package: 'quality-pack',
    delivery_state: 'pack-ready'
  });
  fs.writeFileSync(path.join(root, 'migration', 'source-disposition.json'),
    `${JSON.stringify({ skills: [packReadyRow] }, null, 2)}\n`);
  state = recordCleanReview(root);
  state = recordVerification(root, 'pass', {
    runner: 'sd0x-deterministic-v1',
    commands: [{ command: 'node --test', exit_code: 0 }]
  }, state.worktree.fingerprint, 'codex');
  assert.throws(function packReadyCorePromotionIsRejected() {
    return recordPromotionEvidence(root, {
      kind: 'promotion',
      promotion_unit_id: 'fixture/default',
      request_closure_record_sha256: closure.record_sha256,
      disposition_row: packReadyRow,
      payload_tree_sha256: payloadTreeSha(root),
      reason: null,
      recorded_at: '2026-07-12T03:03:35.000Z',
      supersedes_record_sha256: revisedPromotion.record_sha256
    });
  }, /Core promotion requires target_package=core/);
  const retiredRow = fixtureDisposition({
    disposition: 'retire',
    target_package: 'retired',
    target_skill: null,
    delivery_state: 'retired',
    routing_owner: null,
    promotion_unit_id: 'fixture/default'
  });
  fs.writeFileSync(path.join(root, 'migration', 'source-disposition.json'),
    `${JSON.stringify({ skills: [retiredRow] }, null, 2)}\n`);
  assert.throws(function staleRetirementReviewIsRejected() {
    return recordPromotionEvidence(root, {
      kind: 'retirement',
      promotion_unit_id: 'fixture/default',
      request_closure_record_sha256: closure.record_sha256,
      disposition_row: retiredRow,
      payload_tree_sha256: null,
      reason: 'Approved fixture retirement.',
      recorded_at: '2026-07-12T03:03:40.000Z',
      supersedes_record_sha256: null
    });
  }, /current final review pass/);
  recordCleanReview(root);
  assert.throws(function missingRetirementReasonIsRejected() {
    return recordPromotionEvidence(root, {
      kind: 'retirement',
      promotion_unit_id: 'fixture/default',
      request_closure_record_sha256: closure.record_sha256,
      disposition_row: retiredRow,
      payload_tree_sha256: null,
      reason: null,
      recorded_at: '2026-07-12T03:03:45.000Z',
      supersedes_record_sha256: null
    });
  }, /Retirement requires retired disposition, approved reason, and null payload/);
  const beforeRetirementOid = evidenceGit(root, ['rev-parse', EVIDENCE_REF]);
  assert.throws(() => recordPromotionEvidence(root, {
    kind: 'retirement',
    promotion_unit_id: 'fixture/default',
    request_closure_record_sha256: closure.record_sha256,
    disposition_row: retiredRow,
    payload_tree_sha256: null,
    reason: 'Approved fixture retirement.',
    recorded_at: '2026-07-12T03:03:30.000Z',
    supersedes_record_sha256: null
  }), /advance across record kinds/);
  assert.equal(evidenceGit(root, ['rev-parse', EVIDENCE_REF]), beforeRetirementOid);
  const retirement = recordPromotionEvidence(root, {
    kind: 'retirement',
    promotion_unit_id: 'fixture/default',
    request_closure_record_sha256: closure.record_sha256,
    disposition_row: retiredRow,
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

test('ledger writer rejects cross-kind and missing record fields', (t) => {
  for (const corruption of ['cross-kind', 'missing-field']) {
    const root = repository();
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const bundle = record(root);
    if (corruption === 'cross-kind') bundle.value.kind = 'promotion';
    else delete bundle.value.subject;
    delete bundle.value.record_sha256;
    bundle.value.record_sha256 = sha256(canonicalJson(bundle.value));
    assert.throws(() => appendEvidenceRevision(root, bundle.value, bundle.blobs, {
      expected_old_oid: null
    }), /fields must exactly equal/);
  }
});

test('ledger writer rejects contradictory, failed, and empty check evidence', (t) => {
  const cases = [
    ['verify.json', {
      binding: { kind: 'fixture' },
      provider: 'codex',
      evidence: {
        runner: 'fixture',
        argv: ['node', '--test'],
        exit_code: 0,
        commands: [{ command: 'node --test', exit_code: 1 }]
      }
    }],
    ['verify.json', {
      binding: { kind: 'fixture' },
      provider: 'codex',
      evidence: {
        exit_code: 1,
        commands: [{ command: 'node --test', exit_code: 0 }]
      }
    }],
    ['verify.json', {
      binding: { kind: 'fixture' }, provider: 'codex', evidence: { exit_code: 0 }
    }],
    ['verify.json', {
      binding: { kind: 'fixture' },
      provider: 'codex',
      evidence: { not_required: true, exit_code: 1 }
    }],
    ['verify.json', {
      binding: { kind: 'fixture' },
      provider: 'codex',
      evidence: {
        runner: 'fixture', argv: ['node'], exit_code: 0, commands: { exit_code: 1 }
      }
    }],
    ['checks.json', { commands: [] }]
  ];
  for (const [name, evidence] of cases) {
    const root = repository();
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const bundle = record(root);
    if (name === 'verify.json' && evidence.binding) {
      evidence.binding = bundle.value.subject;
    }
    bundle.blobs[name].value = evidence;
    bundle.value[bundle.blobs[name].field] = sha256(canonicalEvidenceBlob(root, evidence));
    delete bundle.value.record_sha256;
    bundle.value.record_sha256 = sha256(canonicalJson(bundle.value));
    assert.throws(() => appendEvidenceRevision(root, bundle.value, bundle.blobs, {
      expected_old_oid: null
    }), /failed|malformed|unnamed|invalid|commands must be an array|at least one successful invocation/);
  }
});

test('writer and auditor reject rehashed legacy three-view review blobs', (t) => {
  const legacyBundle = (root) => {
    const bundle = record(root);
    const review = bundle.blobs['subject-review.json'].value.evidence;
    review.gate.reviewers = 3;
    review.gate.agents = [
      'sd0x_codex_primary_reviewer',
      'sd0x_reviewer',
      'sd0x_test_reviewer'
    ];
    review.native_results.push({
      agent_type: 'sd0x_reviewer',
      outcome: 'clean',
      has_transcript: true,
      result_sha256: '3'.repeat(64)
    });
    return rehashEvidenceBundle(root, bundle);
  };

  const writerRoot = repository();
  t.after(() => fs.rmSync(writerRoot, { recursive: true, force: true }));
  const writerBundle = legacyBundle(writerRoot);
  assert.throws(() => appendEvidenceRevision(
    writerRoot, writerBundle.value, writerBundle.blobs, { expected_old_oid: null }
  ), /requires exactly two independent reviewers/);

  const auditRoot = repository();
  t.after(() => fs.rmSync(auditRoot, { recursive: true, force: true }));
  installRawEvidenceBundle(auditRoot, legacyBundle(auditRoot));
  assert.throws(() => auditEvidenceLedger(auditRoot),
    /requires exactly two independent reviewers/);
});

test('ledger audit rejects unknown subjects, noncanonical paths, and malformed AC identities', (t) => {
  for (const corruption of [
    'subject', 'path', 'ac-identity', 'unsafe-ac', 'unsafe-request', 'base-ancestry'
    , 'line-range', 'column-range'
  ]) {
    const root = repository();
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const bundle = record(root);
    if (corruption === 'subject') {
      bundle.value.subject = { kind: 'fixture' };
      bundle.blobs['subject-review.json'].value.binding = { kind: 'fixture' };
      bundle.blobs['verify.json'].value.binding = { kind: 'fixture' };
    } else if (corruption === 'path') {
      bundle.value.request_path = 'docs/features/../requests/fixture.md';
    } else if (corruption === 'ac-identity') {
      delete bundle.blobs['ac.json'].value.verdicts[0].evidence[0].file_sha256;
    } else if (corruption === 'unsafe-ac') {
      const bytes = Buffer.from(privateKeyFixture('\nunsafe\n'));
      const identity = bundle.blobs['ac.json'].value.verdicts[0].evidence[0];
      identity.file_bytes_base64 = bytes.toString('base64');
      identity.file_sha256 = sha256(bytes);
      identity.line_sha256 = sha256(Buffer.from(privateKeyFixture()));
    } else if (corruption === 'unsafe-request') {
      const bytes = Buffer.from(`${completedRequestBytes(root)}\n` +
        privateKeyFixture('\nunsafe\n'));
      const requestBlob = bundle.blobs['request.json'].value;
      requestBlob.proposed_bytes_base64 = bytes.toString('base64');
      requestBlob.proposed_sha256 = sha256(bytes);
      bundle.value.proposed_request_content_sha256 = sha256(bytes);
    } else if (corruption === 'base-ancestry') {
      const requestBlob = bundle.blobs['request.json'].value;
      const currentBase = bundle.value.implementation_base_sha;
      const invalidBase = 'f'.repeat(40);
      for (const prefix of ['prior', 'proposed']) {
        const bytes = Buffer.from(requestBlob[`${prefix}_bytes_base64`], 'base64');
        const changed = Buffer.from(bytes.toString('utf8').replace(
          currentBase, invalidBase
        ));
        requestBlob[`${prefix}_bytes_base64`] = changed.toString('base64');
        requestBlob[`${prefix}_sha256`] = sha256(changed);
        bundle.value[`${prefix}_request_content_sha256`] = sha256(changed);
      }
      bundle.value.implementation_base_sha = invalidBase;
    } else if (corruption === 'line-range') {
      const identity = bundle.blobs['ac.json'].value.verdicts[0].evidence[0];
      identity.location = 'app.js:99';
      identity.line = 99;
      identity.line_sha256 = sha256(Buffer.alloc(0));
    } else {
      const identity = bundle.blobs['ac.json'].value.verdicts[0].evidence[0];
      identity.location = 'app.js:1:999';
      identity.column = 999;
    }
    rehashEvidenceBundle(root, bundle);
    installRawEvidenceBundle(root, bundle);
    assert.throws(() => auditEvidenceLedger(root), corruption === 'subject'
      ? /Unsupported closure subject kind/
      : corruption === 'path' ? /non-canonical/
        : corruption === 'ac-identity' ? /fields must exactly equal/
          : corruption === 'base-ancestry' ? /not an ancestor/
            : ['line-range', 'column-range'].includes(corruption)
            ? /out of range/ : /private-key|requires redaction/);
  }
});

test('ledger re-audit rejects blob tamper, missing metadata, and divergent history', (t) => {
  for (const corruption of [
    'blob', 'extra-blob', 'wrong-kind', 'missing-ref', 'divergence'
  ]) {
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
    if (['extra-blob', 'wrong-kind'].includes(corruption)) {
      const bytes = corruption === 'extra-blob'
        ? privateKeyFixture('\nunredacted\n')
        : canonicalJson(bundle.value);
      const extraOid = evidenceGit(root, ['hash-object', '-w', '--stdin'], {
        env,
        input: bytes
      });
      const extraPath = corruption === 'extra-blob'
        ? `evidence/${bundle.value.record_sha256}/unexpected.json`
        : `records/promotion/${bundle.value.record_sha256}.json`;
      evidenceGit(root, [
        'update-index', '--add', '--cacheinfo', `100644,${extraOid},${extraPath}`
      ], { env });
      const extraTree = evidenceGit(root, ['write-tree'], { env });
      const extraCommit = evidenceGit(root, [
        'commit-tree', extraTree, '-p', appended.oid, '-m', 'extra evidence path'
      ], { env });
      evidenceGit(root, ['update-ref', EVIDENCE_REF, extraCommit, appended.oid]);
      fs.rmSync(indexPath, { force: true });
      assert.throws(() => auditEvidenceLedger(root),
        /exactly one record|paths must exactly match|orphan, extra, or misplaced/);
      continue;
    }
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
    assert.throws(() => auditEvidenceLedger(root),
      /blob is missing or corrupt|append files without modifying or deleting history/);
  }
});

test('evidence ref lookup ignores ambient Git repository selectors', (t) => {
  const root = repository();
  const decoy = repository();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  t.after(() => fs.rmSync(decoy, { recursive: true, force: true }));
  const bundle = record(root);
  const appended = appendEvidenceRevision(root, bundle.value, bundle.blobs, {
    expected_old_oid: null
  });
  const tree = evidenceGit(root, ['rev-parse', `${appended.oid}^{tree}`]);
  const head = evidenceGit(root, ['rev-parse', 'HEAD']);
  const divergent = evidenceGit(root, [
    'commit-tree', tree, '-p', appended.oid, '-p', head, '-m', 'actual divergent ref'
  ]);
  evidenceGit(root, ['update-ref', EVIDENCE_REF, divergent, appended.oid]);
  const decoyBundle = record(decoy);
  appendEvidenceRevision(decoy, decoyBundle.value, decoyBundle.blobs, {
    expected_old_oid: null
  });
  const priorGitDir = process.env.GIT_DIR;
  const priorWorkTree = process.env.GIT_WORK_TREE;
  process.env.GIT_DIR = path.join(decoy, '.git');
  process.env.GIT_WORK_TREE = decoy;
  try {
    assert.equal(fs.realpathSync(path.dirname(resolveRuntimeMetadataPath(
      root, 'selector-probe.json'
    ))), fs.realpathSync(path.join(root, '.git', 'sd0x-dev-flow-codex')));
    assert.throws(() => auditEvidenceLedger(root), /one parent-linked append chain/);
    assert.throws(() => auditEvidenceLedger(path.join(root, 'docs', 'features')),
      /one parent-linked append chain/);
  } finally {
    if (priorGitDir === undefined) delete process.env.GIT_DIR;
    else process.env.GIT_DIR = priorGitDir;
    if (priorWorkTree === undefined) delete process.env.GIT_WORK_TREE;
    else process.env.GIT_WORK_TREE = priorWorkTree;
  }
});

test('ledger audit binds history and tree reads to one captured ref OID', (t) => {
  const root = repository();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const firstBundle = record(root);
  const first = appendEvidenceRevision(root, firstBundle.value, firstBundle.blobs, {
    expected_old_oid: null
  });
  const successorBundle = record(root, {
    recordedAt: '2026-07-12T00:00:01.000Z',
    supersedes: firstBundle.value.record_sha256
  });
  const successor = appendEvidenceRevision(
    root, successorBundle.value, successorBundle.blobs, { expected_old_oid: first.oid }
  );
  evidenceGit(root, ['update-ref', EVIDENCE_REF, first.oid, successor.oid]);
  let advanced = false;
  assert.throws(() => auditEvidenceLedger(root, {}, {
    afterOidCapture(oid) {
      assert.equal(oid, first.oid);
      if (advanced) return;
      advanced = true;
      evidenceGit(root, ['update-ref', EVIDENCE_REF, successor.oid, first.oid]);
    }
  }), /Evidence ref changed while it was audited/);
});
