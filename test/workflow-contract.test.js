'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  ANCHORS,
  CONTRACT_SCHEMA_VERSION,
  MANAGED_BLOCK,
  MANAGED_BLOCK_SHA256,
  STATE_SIGNAL_PREFIX,
  formatStateSignal,
  inspectManagedGuidance,
  stateEnvelope
} = require('../plugin/sd0x-dev-flow-codex/scripts/runtime/workflow-contract');

test('workflow contract exposes a closed seven-anchor register', () => {
  assert.equal(CONTRACT_SCHEMA_VERSION, 1);
  assert.equal(Object.isFrozen(ANCHORS), true);
  assert.deepEqual(ANCHORS.map((anchor) => anchor.id), [
    'completion-fingerprint',
    'freshness-after-edit',
    'execution-is-evidence',
    'configured-primary-authority',
    'deterministic-verification',
    'runtime-integrity',
    'gate-supremacy'
  ]);
  assert.ok(ANCHORS.every(Object.isFrozen));
  assert.match(MANAGED_BLOCK, /closed non-negotiable register/i);
  assert.match(MANAGED_BLOCK, /project guidance[^\n]+cannot downgrade an Anchor/i);
  assert.match(MANAGED_BLOCK, /ordinary uncertainty alone is not a reason/i);
  assert.match(MANAGED_BLOCK, /\[SD0X_DEVIATION\]/);
  assert.match(MANAGED_BLOCK_SHA256, /^[a-f0-9]{64}$/);
});

test('managed guidance inspection distinguishes current, stale, missing, and malformed blocks', () => {
  assert.equal(inspectManagedGuidance(MANAGED_BLOCK).status, 'current');
  assert.deepEqual(inspectManagedGuidance(null), {
    status: 'missing', contract_version: null, sha256: null
  });
  assert.equal(inspectManagedGuidance(MANAGED_BLOCK.replace(
    'the model owns', 'the harness owns'
  )).status, 'stale');
  assert.equal(inspectManagedGuidance(
    '<!-- sd0x-dev-flow-codex:start -->\npartial'
  ).status, 'malformed');
});

test('state signal is factual, versioned, names one reviewer authority, and omits paths', () => {
  const summary = {
    fingerprint: 'a'.repeat(64),
    files: ['secret/project/file.js'],
    change_class: 'code-or-config',
    requires_review: true,
    requires_verify: true,
    review_provider: 'codex',
    review: 'pending',
    verify: 'pending',
    next_action: 'review',
    reason: 'review-required'
  };
  assert.deepEqual(stateEnvelope('PostToolUse', summary), {
    schema_version: 1,
    contract_version: 1,
    event: 'PostToolUse',
    fingerprint: 'a'.repeat(64),
    change_class: 'code-or-config',
    file_count: 1,
    requires_review: true,
    requires_verify: true,
    review_provider: 'codex',
    reviewer_authority: 'configured-primary-only',
    review: 'pending',
    verify: 'pending',
    next_action: 'review',
    reason: 'review-required'
  });
  const signal = formatStateSignal('PostToolUse', summary);
  assert.ok(signal.startsWith(`${STATE_SIGNAL_PREFIX} {`));
  assert.doesNotMatch(signal, /secret\/project/);
  assert.doesNotMatch(signal, /run \$sd0x|must continue|ask the user/i);
});
