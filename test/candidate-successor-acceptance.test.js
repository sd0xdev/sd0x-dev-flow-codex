'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const { validateCandidateRequestEvidence } = require('../scripts/skill-migration-audit');
const directory = 'docs/features/skill-toolkit-migration/requests/';
const result = {
  promotion_unit_id: 'create-request/default', target_package: 'core', move_window: true,
  payload_tree_sha256: '1'.repeat(64), preflight_audit_fingerprint: '2'.repeat(64),
  audit_fingerprint: '3'.repeat(64)
};
function request(status, acceptance) {
  return [
    '# Test candidate fixture', '> **Status**: ' + status, '', '## Progress', '',
    '| Phase | Status | Note |', '|---|---|---|',
    '| Development | Complete | Native payload `' + result.payload_tree_sha256 + '`. |',
    '| Testing | Complete | Preflight `' + result.preflight_audit_fingerprint + '`. |',
    '| Acceptance | ' + acceptance + ' | Fixture evidence. |', ''
  ].join('\n');
}

test('create-request successor accepts Candidate Complete and cannot inherit historical completion authority', () => {
  const successor = directory + '2099-01-01-create-request-successor.md';
  assert.doesNotThrow(() => validateCandidateRequestEvidence(
    request('Candidate Complete', 'Candidate Complete'), result, successor));
  assert.throws(() => validateCandidateRequestEvidence(
    request('Candidate Complete', 'Complete'), result, successor), /unsupported Acceptance status/);
  assert.throws(() => validateCandidateRequestEvidence(
    request('Completed', 'Complete'), result, successor), /requires durable closure evidence/);
});

test('historical create-request format remains confined to its exact owner paths and unit', () => {
  for (const name of ['2026-07-14-wave1-create-request-promotion.md',
    '2026-07-23-create-request-recovery-repromotion.md',
    '2026-07-27-create-request-windows-git-repromotion.md']) {
    assert.doesNotThrow(() => validateCandidateRequestEvidence(
      request('Candidate Complete', 'Complete'), result, directory + name));
    assert.throws(() => validateCandidateRequestEvidence(
      request('Candidate Complete', 'Complete'), { ...result, promotion_unit_id: 'ask/default' },
      directory + name), /unsupported Acceptance status/);
  }
});
