'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  repositoryRoutingRegistry,
  validateRoutingRegistry
} = require('../scripts/skill-routing-test');

const routing = (positive, negative) => ({
  positive_triggers: [positive],
  negative_boundaries: [negative]
});

test('repository routing registry has one owner per exact prompt', () => {
  assert.equal(validateRoutingRegistry(repositoryRoutingRegistry(process.cwd())), true);
});

test('global registry rejects duplicate positive ownership', () => {
  assert.throws(() => validateRoutingRegistry([
    { unit: 'one/default', routing: routing('same prompt', 'one negative') },
    { unit: 'two/default', routing: routing('same prompt', 'two negative') }
  ]), /multiple owners/);
});

test('global registry rejects positive and negative collisions', () => {
  assert.throws(() => validateRoutingRegistry([
    { unit: 'one/default', routing: routing('shared prompt', 'one negative') },
    { unit: 'two/default', routing: routing('two positive', 'shared prompt') }
  ]), /both positive and negative/);
});
