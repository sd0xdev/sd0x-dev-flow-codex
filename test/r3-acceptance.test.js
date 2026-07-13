'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { canonicalEvidenceBlob } = require(
  '../plugin/sd0x-dev-flow-codex/scripts/runtime/state'
);

const ROOT = path.resolve(__dirname, '..');
const COVERAGE = [
  { ac: 1, implementation: 'derivePromotionEvidence', implementationSignals: ['request_closure_record_sha256', 'record_sha256'], file: 'test/evidence-ledger.test.js', regressions: [{ name: 'promotion records require final closure and current review/verify gates', signals: ['request_closure_record_sha256', 'audit.selected.record_sha256'] }] },
  { ac: 2, implementation: 'prepareRequestClosure', implementationSignals: ['validateClosureEvidence', 'appendEvidenceRevisionUnlocked'], file: 'test/evidence-ledger.test.js', regressions: [{ name: 'request closure prepare and finalize bind proposal, projection, and two reviews', signals: ['prepareRequestClosure', 'finalizeRequestClosure'] }, { name: 'ledger audit rejects a closure committed before its pending record', signals: ['rewriteEvidenceCommitOrder', 'must follow.*pending commit-order'] }, { name: 'closure and promotion writers reject superseded pending and closure records', signals: ['firstPending', 'secondPending', 'thirdPending', 'superseded request closure'] }, { name: 'ledger writer rejects unknown record kinds', signals: ["kind: 'unknown-transition'"] }, { name: 'ledger writer rejects cross-kind and missing record fields', signals: ["'cross-kind', 'missing-field'", "bundle.value.kind = 'promotion'", 'delete bundle.value.subject'] }, { name: 'closure prepare and finalize reject interposed worktree drift before append', signals: ['beforeAppend', 'beforeFinalSnapshot'] }, { name: 'prepare replay re-audits the complete evidence ref', signals: ['replay-tamper', 'prepareRequestClosure'] }] },
  { ac: 3, implementation: 'appendEvidenceRevision', implementationSignals: ['withStateLock', 'appendEvidenceRevisionUnlocked'], file: 'test/evidence-ledger.test.js', regressions: [{ name: 'evidence revisions are canonical, parent-linked, CAS-protected, and worktree-neutral', signals: ['expected_old_oid', "'rev-list', '--parents'", 'snapshot(root).fingerprint'] }] },
  { ac: 4, implementation: 'auditEvidenceLedger', implementationSignals: ["'rev-list', '--reverse', '--parents'", 'validateEvidenceBlobSemantics'], file: 'test/evidence-ledger.test.js', regressions: [{ name: 'promotion records require final closure and current review/verify gates', signals: ['cloneRoot', 'promotionBundle', 'auditEvidenceLedger(bundleClone'] }] },
  { ac: 5, implementation: 'derivePromotionEvidence', implementationSignals: ['isCurrentPass', 'supersedes_record_sha256'], file: 'test/evidence-ledger.test.js', regressions: [{ name: 'promotion records require final closure and current review/verify gates', signals: ['supersedes_record_sha256: promotion.record_sha256', 'revisedPromotion', 'current final review pass'] }] },
  { ac: 6, implementation: 'auditEvidenceLedger', implementationSignals: ['Evidence ref changed while it was audited', 'Evidence commit history must be one parent-linked append chain'], file: 'test/evidence-ledger.test.js', regressions: [{ name: 'ledger re-audit rejects blob tamper, missing metadata, and divergent history', signals: ["corruption === 'missing-ref'", "'wrong-kind'", 'divergent evidence', 'unexpected.json', 'tampered evidence'] }, { name: 'ledger audit rejects unknown subjects, noncanonical paths, and malformed AC identities', signals: ["'ac-identity'", "'unsafe-request'", 'rehashEvidenceBundle'] }, { name: 'closure finalization rejects proposed request and non-request drift', signals: ["drift of ['request', 'projection']", 'request bytes drifted', 'projection drifted'] }, { name: 'closure and promotion writers reject superseded pending and closure records', signals: ['superseded request closure', 'superseded or stale'] }, { name: 'promotion records require final closure and current review/verify gates', signals: ["'> **Status**: In Progress'", 'Current request no longer matches durable completion evidence', "fs.appendFileSync(skillPath, 'drift", 'completion mismatch for payload_tree_sha256'] }] },
  { ac: 7, implementation: 'derivePromotionEvidence', implementationSignals: ["kind === 'retirement'", 'payload_tree_sha256', 'isCurrentPass'], file: 'test/evidence-ledger.test.js', regressions: [{ name: 'promotion records require final closure and current review/verify gates', signals: ['packReadyCorePromotionIsRejected', 'Core promotion requires target_package=core', 'staleRetirementReviewIsRejected', 'current final review pass', 'missingRetirementReasonIsRejected', 'Retirement requires retired disposition, approved reason, and null payload', 'verify_evidence_sha256, null', 'payload_tree_sha256, null'] }] },
  { ac: 8, implementation: 'requiredReviewers', implementationSignals: ['sd0x_codex_primary_reviewer', 'sd0x_test_reviewer'], file: 'test/collaboration-review.test.js', regressions: [{ name: 'collaboration adapter imports two canonical terminal reviewer results', signals: ['REVIEWERS.map', 'completed.length, 2'] }, { file: 'test/state.test.js', name: 'schema v7 migration invalidates legacy three-view evidence', signals: ['legacy.schema_version = 7', 'reviewers = 3', "state.schema_version, 8", "gates.review.status, 'pending'"] }, { file: 'test/evidence-ledger.test.js', name: 'writer and auditor reject rehashed legacy three-view review blobs', signals: ['review.gate.reviewers = 3', 'requires exactly two independent reviewers'] }, { file: 'test/evidence-ledger.test.js', name: 'redaction removes repository, account, and secret data and refuses private keys', signals: ['canonicalEvidenceBlob', 'privateKeyFixture', '<repo>|<account>|<secret>|<absolute-path>'] }, { file: 'test/evidence-ledger.test.js', name: 'closure prepare refuses exact proposed bytes that would require redaction', signals: ['privateKeyFixture', 'bearerFixture', 'requires redaction'] }] }
];

function scopedTest(source, name) {
  const anchor = `test('${name}'`;
  const start = source.indexOf(anchor);
  if (start < 0) return '';
  const end = source.indexOf('\ntest(', start + anchor.length);
  return source.slice(start, end < 0 ? source.length : end);
}

function scopedFunction(source, name) {
  const anchor = `function ${name}(`;
  const start = source.indexOf(anchor);
  if (start < 0) return '';
  const end = source.indexOf('\nfunction ', start + anchor.length);
  return source.slice(start, end < 0 ? source.length : end);
}

function assertScopedRegression(source, regression) {
  const body = scopedTest(source, regression.name);
  assert.ok(body, regression.name);
  for (const signal of regression.signals) {
    assert.ok(body.includes(signal), `${regression.name}: ${signal}`);
  }
}

test('R3 acceptance criteria map to focused implementation and regression evidence', () => {
  const runtime = fs.readFileSync(path.join(ROOT,
    'plugin', 'sd0x-dev-flow-codex', 'scripts', 'runtime', 'state.js'), 'utf8');
  const suites = new Map();
  assert.deepEqual(COVERAGE.map((entry) => entry.ac), [1, 2, 3, 4, 5, 6, 7, 8]);
  for (const entry of COVERAGE) {
    if (!suites.has(entry.file)) {
      suites.set(entry.file, fs.readFileSync(path.join(ROOT, entry.file), 'utf8'));
    }
    const implementation = scopedFunction(runtime, entry.implementation);
    assert.ok(implementation, entry.implementation);
    for (const signal of entry.implementationSignals) {
      assert.ok(implementation.includes(signal), signal);
    }
    for (const regression of entry.regressions) {
      const regressionFile = regression.file || entry.file;
      if (!suites.has(regressionFile)) {
        suites.set(regressionFile,
          fs.readFileSync(path.join(ROOT, regressionFile), 'utf8'));
      }
      assertScopedRegression(suites.get(regressionFile), regression);
    }
  }
});

test('R3 acceptance scope rejects a decoy signal outside its named test', () => {
  const source = [
    "const decoy = 'required-behavior';",
    "test('target regression', () => {",
    "  assert.ok(true);",
    '});'
  ].join('\n');
  assert.equal(scopedTest(source, 'target regression').includes('required-behavior'),
    false);
});

test('R3 acceptance scope rejects empty migration and missing redaction regressions', () => {
  const emptyMigration = [
    "test('schema migration', () => {",
    '});'
  ].join('\n');
  assert.throws(() => assertScopedRegression(emptyMigration, {
    name: 'schema migration', signals: ['legacy.schema_version = 7']
  }));
  assert.throws(() => assertScopedRegression('', {
    name: 'redaction refusal', signals: ['requires redaction']
  }));
  const incompleteTamper = [
    "test('record tamper', () => {",
    "  const corruption = 'blob';",
    '});'
  ].join('\n');
  assert.throws(() => assertScopedRegression(incompleteTamper, {
    name: 'record tamper', signals: ["'wrong-kind'"]
  }));
  const incompleteRetirement = [
    "test('retirement guards', () => {",
    "  assert.equal('payload_tree_sha256', null);",
    '});'
  ].join('\n');
  for (const signal of [
    'packReadyCorePromotionIsRejected',
    'staleRetirementReviewIsRejected',
    'missingRetirementReasonIsRejected'
  ]) {
    assert.throws(() => assertScopedRegression(incompleteRetirement, {
      name: 'retirement guards', signals: [signal]
    }));
  }
  const stalePromotionWithoutRetirement = [
    "test('retirement guards', () => {",
    "  assert.throws(() => promote(), new RegExp('current final review pass'));",
    '});'
  ].join('\n');
  assert.throws(() => assertScopedRegression(stalePromotionWithoutRetirement, {
    name: 'retirement guards', signals: ['staleRetirementReviewIsRejected']
  }));
});

test('R3 acceptance evidence file is byte-preserving under canonical redaction', () => {
  const source = fs.readFileSync(__filename, 'utf8');
  const envelope = JSON.parse(canonicalEvidenceBlob(ROOT, source));
  assert.equal(envelope.value, source);
});
