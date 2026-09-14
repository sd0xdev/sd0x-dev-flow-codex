'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const debate = require('../plugin/sd0x-dev-flow-codex/skills/brainstorm/scripts/debate');
const verdict = require('../plugin/sd0x-dev-flow-codex/skills/seek-verdict/scripts/verdict-state');

const claims = new Set(['claim-1', 'evidence-1']);

function attack(actor, id, validity = 'valid') {
  return {
    attack_id: `attack-${id}`,
    target_claim_id: 'claim-1',
    novelty_key: `novelty-${id}`,
    argument: 'claim-1 contradicts the observed evidence',
    evidence_refs: ['evidence-1'],
    proposed_by: actor,
    validity
  };
}

function side(attacks = []) {
  return {
    attacks,
    concessions: [],
    evidence_refs: ['evidence-1'],
    new_valid_attack: attacks.some((item) => item.validity === 'valid'),
    unresolved_attack: attacks.some((item) => item.validity === 'unresolved'),
    position_changed: false,
    position_update: ''
  };
}

function activeRound(index, validity = 'valid') {
  return {
    codex_proponent: side([attack('codex-proponent', `${index}-p`, validity)]),
    codex_challenger: side([attack('codex-challenger', `${index}-c`, validity)])
  };
}

function settledRound() {
  return { codex_proponent: side(), codex_challenger: side() };
}

test('distinct Codex participants can challenge evidence and reach genuine equilibrium', () => {
  assert.equal(debate.transcriptState([activeRound(1)], claims), 'continue');
  assert.equal(debate.transcriptState([activeRound(1), settledRound()], claims), 'equilibrium');
  assert.equal(debate.transcriptState([settledRound()], claims, { stopRequested: true }), 'equilibrium');
});

test('rounds reject legacy participants and cross-side actor impersonation', () => {
  assert.equal(debate.transcriptState([{
    native_codex: side(), claude_adapter: side()
  }], claims), 'invalid');
  for (const actor of ['claude-adapter', 'native-codex', 'codex-challenger']) {
    const round = activeRound(1);
    round.codex_proponent.attacks[0].proposed_by = actor;
    assert.equal(debate.transcriptState([round], claims), 'invalid', actor);
  }
  const round = activeRound(1);
  round.codex_challenger.attacks[0].proposed_by = 'codex-proponent';
  assert.equal(debate.transcriptState([round], claims), 'invalid');
  assert.equal(debate.validateAttack(attack('claude-adapter', 1), claims, new Set()), false);
});

test('optional Claude participants retain their actual provider and role through equilibrium', () => {
  for (const providers of [['codex', 'claude'], ['claude', 'codex'], ['claude', 'claude']]) {
    const [proponent, challenger] = providers;
    const round = {
      [`${proponent}_proponent`]: side([attack(`${proponent}-proponent`, 'p')]),
      [`${challenger}_challenger`]: side([attack(`${challenger}-challenger`, 'c')])
    };
    const settled = { [`${proponent}_proponent`]: side(), [`${challenger}_challenger`]: side() };
    assert.equal(debate.transcriptState([round], claims), 'continue');
    assert.equal(debate.transcriptState([round, settled], claims), 'equilibrium');
    assert.equal(debate.transcriptState([round], claims, { roundBudget: 1 }), 'divergent');
  }
});

test('fallback transcripts reject provider relabeling, duplicate roles, and mid-debate substitution', () => {
  const mixed = { codex_proponent: side(), claude_challenger: side([attack('claude-challenger', 'c')]) };
  for (const actor of ['codex-challenger', 'claude-proponent']) {
    const changed = structuredClone(mixed);
    changed.claude_challenger.attacks[0].proposed_by = actor;
    assert.equal(debate.transcriptState([changed], claims), 'invalid');
  }
  assert.equal(debate.transcriptState([{ ...mixed, codex_challenger: side() }], claims), 'invalid');
  assert.equal(debate.transcriptState([{ codex_proponent: side(), other_challenger: side() }], claims), 'invalid');
  assert.equal(debate.transcriptState([mixed, settledRound()], claims), 'invalid');
});

test('fallback transcripts preserve evidence, novelty, and unresolved-attack integrity', () => {
  const mixed = { codex_proponent: side(), claude_challenger: side([attack('claude-challenger', 'c', 'unresolved')]) };
  assert.equal(debate.transcriptState([mixed], claims, { stopRequested: true }), 'divergent');
  assert.equal(debate.transcriptState([mixed, mixed], claims), 'invalid');
  const missingEvidence = structuredClone(mixed);
  missingEvidence.claude_challenger.attacks[0].evidence_refs = ['unknown'];
  assert.equal(debate.transcriptState([missingEvidence], claims), 'invalid');
  const hiddenUnresolved = structuredClone(mixed);
  hiddenUnresolved.claude_challenger.unresolved_attack = false;
  assert.equal(debate.transcriptState([hiddenUnresolved], claims), 'invalid');
});

test('actor migration preserves evidence membership, novelty, and derived state integrity', () => {
  const absentEvidence = activeRound(1);
  absentEvidence.codex_challenger.attacks[0].evidence_refs = ['invented-evidence'];
  assert.equal(debate.transcriptState([absentEvidence], claims), 'invalid');
  assert.equal(debate.transcriptState([activeRound(1), activeRound(1)], claims), 'invalid');
  const hiddenUnresolved = activeRound(1, 'unresolved');
  hiddenUnresolved.codex_proponent.unresolved_attack = false;
  assert.equal(debate.transcriptState([hiddenUnresolved], claims), 'invalid');
  assert.equal(debate.classifyOutcome({ unresolved: true, unconditional_dominance: true,
    full_concession: true }), 'divergent');
});

test('requested stop and exhausted resource budgets leave unresolved work divergent', () => {
  assert.equal(debate.transcriptState([activeRound(1, 'unresolved')], claims,
    { stopRequested: true }), 'divergent');
  assert.equal(debate.transcriptState([activeRound(1)], claims, { roundBudget: 1 }), 'divergent');
  const five = Array.from({ length: 5 }, (_, index) => activeRound(index));
  assert.equal(debate.transcriptState(five, claims), 'divergent');
  assert.equal(debate.transcriptState(five, claims, { roundBudget: 6 }), 'continue');
  assert.equal(debate.transcriptState([...five, settledRound()], claims,
    { roundBudget: 6 }), 'equilibrium');
  assert.throws(() => debate.transcriptState(five, claims, { roundBudget: 4 }), /round budget/);
});

test('invalid or unknown debate options fail closed', () => {
  for (const options of [null, [], false, { rounds: 3 }, { roundBudget: 0 },
    { roundBudget: -1 }, { roundBudget: 1.5 }, { roundBudget: NaN },
    { roundBudget: Infinity }, { roundBudget: Number.MAX_SAFE_INTEGER + 1 },
    { roundBudget: '5' }, { roundBudget: undefined }, { stopRequested: 1 },
    { stopRequested: undefined }, { [Symbol('unknown')]: true }]) {
    assert.throws(() => debate.transcriptState([settledRound()], claims, options), /options/);
  }
  assert.throws(() => debate.transcriptState([], claims), /round budget/);
});

test('finding provenance never selects a Claude verifier', () => {
  for (const origin of ['claude', 'native-codex', 'user']) {
    assert.deepEqual(verdict.oppositeVerifier(origin), ['native-codex']);
  }
  assert.throws(() => verdict.oppositeVerifier('claude-adapter'), /origin is invalid/);
});

test('published research helpers match their generator sources', () => {
  for (const [skill, entry, source] of [
    ['brainstorm', 'debate.js', 'brainstorm.js'],
    ['seek-verdict', 'verdict-state.js', 'seek-verdict.js']
  ]) {
    assert.equal(fs.readFileSync(path.join(__dirname,
      '../plugin/sd0x-dev-flow-codex/skills', skill, 'scripts', entry), 'utf8'),
    fs.readFileSync(path.join(__dirname, '../scripts/research-validators', source), 'utf8'));
  }
});
