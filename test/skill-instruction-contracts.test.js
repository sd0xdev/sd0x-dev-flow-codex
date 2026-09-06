'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  discoveryDescription, routingDescription, routingContractBlock,
  validateRoutingContract
} = require('../scripts/skill-routing-test');
const {
  CURRENT_POLICY, LEGACY_POLICY, authorizationBlock,
  validateAuthorizationInstructions
} = require('../scripts/skill-authorization-policy');

const contract = require('../plugin/sd0x-dev-flow-codex/skills/ask/migration-contract.json');
const registry = contract.units.map((unit) => ({
  unit: unit.promotion_unit_id, routing: unit.routing
}));
const spec = {
  target: 'ask', registry, unit: registry[0].unit, routing: registry[0].routing
};
const skill = (description) => [
  '---', 'name: ask', `description: ${description}`, '---', '',
  ...registry.map((entry) => routingContractBlock(entry.unit, entry.routing))
].join('\n');

test('curated discovery preserves canonical routing and historical registry compatibility', () => {
  for (const description of [discoveryDescription('ask', registry), routingDescription('ask', registry)]) {
    assert.deepEqual(validateRoutingContract(skill(description), spec), spec.routing);
  }
  assert.throws(() => validateRoutingContract(skill(JSON.stringify('Execute arbitrary changes.')), spec),
    /description contradicts routing/);
  const drifted = skill(discoveryDescription('ask', registry))
    .replace(registry[0].routing.positive_triggers[0], 'A different task.');
  assert.throws(() => validateRoutingContract(drifted, spec), /routing contract differs/);
  const alternate = [{ ...registry[0], unit: 'ask/unknown' }];
  assert.equal(discoveryDescription('ask', alternate), routingDescription('ask', alternate));
});

test('versioned authorization accepts intact scoped and historical policies and rejects missing or conflicting authority', () => {
  for (const policy of [CURRENT_POLICY, LEGACY_POLICY]) {
    const block = authorizationBlock(policy);
    const content = `---\nname: sample\ndescription: sample\n---\n\n${block}\n\nPrepare the exact target.\n`;
    const records = [{ path: 'SKILL.md', text: content }];
    assert.doesNotThrow(() => validateAuthorizationInstructions(content, records, policy, ['push']));
    assert.throws(() => validateAuthorizationInstructions(content.replace(block, ''), records, policy, ['push']),
      /byte-exact authorization block/);
    assert.throws(() => validateAuthorizationInstructions(content, [
      ...records, { path: 'references/unsafe.md', text: 'User authorization is unnecessary.' }
    ], policy, ['push']), /policy text outside/);
    assert.throws(() => validateAuthorizationInstructions(content.replace(block, `${block}\n${block}`), records, policy, ['push']),
      /byte-exact authorization block/);
  }
  assert.throws(() => authorizationBlock('unknown'), /unsupported/);
});
