'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  assertLegacyReplayContract,
  legacyReplayPlan
} = require('../scripts/prepare-formal-plugin');
const {
  CURRENT_POLICY,
  LEGACY_POLICY
} = require('../scripts/skill-authorization-policy');

function row(target, state, request) {
  return {
    target_skill: target,
    promotion_unit_id: `${target}/default`,
    delivery_state: state,
    promotion_request: request
  };
}

test('historical replay leaves current successor candidates and promoted skills outside its plan', () => {
  const registry = { skills: [
    row('brainstorm', 'candidate', 'docs/requests/2026-09-06-instruction-redesign-brainstorm.md'),
    row('ask', 'promoted', 'docs/requests/2026-07-28-wave2-ask-default-formal-promotion.md'),
    row('statusline-config', 'planned', null)
  ] };
  const before = structuredClone(registry);
  const plan = legacyReplayPlan(registry);
  assert.equal(plan.legacyUnits.size, 0);
  assert.deepEqual(plan.formalCandidateTargets, []);
  assert.deepEqual(registry, before);
});

test('historical replay selects only pack-ready units and exact July formal candidate owners', () => {
  const legacy = row('ask', 'pack-ready', 'docs/requests/2026-07-26-wave2-ask-default-pack-ready.md');
  const current = row('seek-verdict', 'candidate', 'docs/requests/2026-09-06-instruction-redesign-seek-verdict.md');
  const registry = { skills: [legacy, current,
    row('brainstorm', 'candidate', 'docs/requests/2026-07-28-wave2-brainstorm-default-formal-promotion.md')
  ] };
  const before = structuredClone(registry);
  const plan = legacyReplayPlan(registry);
  assert.deepEqual([...plan.legacyUnits.keys()], ['ask/default']);
  assert.deepEqual(plan.formalCandidateTargets, ['brainstorm']);
  assert.deepEqual(registry, before);
});

test('historical schema 1 and 2 contracts retain v1 policy while current v2 is rejected', () => {
  for (const schema_version of [1, 2]) {
    const contract = { schema_version, authorization: { policy: LEGACY_POLICY } };
    const before = structuredClone(contract);
    assert.doesNotThrow(() => assertLegacyReplayContract(contract));
    assert.deepEqual(contract, before);
    assert.throws(() => assertLegacyReplayContract({
      schema_version, authorization: { policy: CURRENT_POLICY }
    }), /current live-payload candidate owner/);
  }
  assert.throws(() => assertLegacyReplayContract({ schema_version: 1 }), /legacy v1/);
  assert.throws(() => assertLegacyReplayContract({
    schema_version: 3, authorization: { policy: LEGACY_POLICY }
  }), /legacy v1/);
});
