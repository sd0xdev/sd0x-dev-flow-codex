'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const explore = require('../plugin/sd0x-dev-flow-codex/skills/deep-explore/scripts/completeness');
const research = require('../plugin/sd0x-dev-flow-codex/skills/deep-research/scripts/research-score');

function question(id, status = 'answered') {
  return { id, status, evidence_refs: status === 'answered' ? ['src/runtime.js:12'] : [],
    reason: status === 'not-applicable' ? 'This subsystem does not persist data.' : '' };
}

function coverage(overrides = {}) {
  return { questions: [question('entrypoint')], criticalOpen: 0, hardFail: false,
    budgetExhausted: false, ...overrides };
}

function evidence(origin, relation) {
  return {
    ...research.createResolvedWebIdentity(`https://${origin}.example/docs`),
    source_type: 'official', agent_role: 'codex-researcher', locator: 'section-2',
    content_hash: 'a'.repeat(64), relation, weight: 3
  };
}

function usage(overrides = {}) {
  return { researchers: 0, validator: 0, fetched_sources: 0, debate_rounds: 0,
    security: false, ...overrides };
}

test('coverage completes from answered questions and justified exclusions without wave quotas', () => {
  const input = coverage({ questions: [question('entrypoint'), question('storage', 'not-applicable')] });
  const before = structuredClone(input);
  assert.equal(explore.decision(input), 'complete');
  assert.deepEqual(input, before, 'the helper must not invent or rewrite evidence');
  assert.equal(explore.decision({ ...input, budgetExhausted: true }), 'complete');
});

test('unanswered questions, critical gaps, and hard failures prevent completion despite high novelty metrics', () => {
  assert.equal(explore.completeness(0, 10, 0), 100);
  for (const overrides of [
    { questions: [question('entrypoint'), question('cancellation', 'unresolved')] },
    { criticalOpen: 1 }, { hardFail: true }
  ]) {
    assert.equal(explore.decision(coverage(overrides)), 'continue');
    assert.equal(explore.decision(coverage({ ...overrides, budgetExhausted: true })), 'inconclusive');
  }
});

test('coverage rejects unsupported answers, unreasoned exclusions, duplicate questions and obsolete inputs', () => {
  const bad = [
    coverage({ questions: [] }),
    coverage({ questions: [question('same'), question('same')] }),
    coverage({ questions: [{ ...question('answer'), evidence_refs: [] }] }),
    coverage({ questions: [{ ...question('excluded', 'not-applicable'), reason: ' ' }] }),
    coverage({ questions: [{ ...question('answer'), evidence_refs: [' '] }] }),
    coverage({ questions: [{ ...question('answer'), evidence_refs: ['same', 'same'] }] }),
    coverage({ questions: [{ ...question('answer'), status: 'probably' }] }),
    coverage({ questions: [{ ...question('answer'), guessed: true }] }),
    coverage({ criticalOpen: -1 }), coverage({ hardFail: 0 }),
    coverage({ budgetExhausted: 'false' }), { ...coverage(), score: 100 },
    { ...coverage(), [Symbol('unrecognized')]: true },
    { criticalOpen: 0, hardFail: false, qualifyingConditions: {}, score: 100,
      waveCeiling: 2, wavesRun: 1 }
  ];
  for (const input of bad) assert.throws(() => explore.decision(input), /invalid/);
});

test('research metrics report thresholds without supplying completion authority', () => {
  const dimensions = { diversity: 100, cross_verification: 100, gap_coverage: 100, question_closure: 100 };
  for (const [mode, threshold] of [['exploratory', 70], ['compliance', 90], ['decision', 80]]) {
    assert.deepEqual(research.completeness(mode, dimensions),
      { score: 100, threshold, meets_threshold: true });
  }
  assert.deepEqual(research.completeness('decision', { ...dimensions, gap_coverage: 0,
    question_closure: 0 }), { score: 60, threshold: 80, meets_threshold: false });
  assert.throws(() => research.completeness('decision', { ...dimensions, question_closure: NaN }));
});

test('claim scores preserve substantive counterevidence even when support arithmetic is greater', () => {
  const items = [evidence('primary', 'supports'), evidence('secondary', 'supports'),
    evidence('counter', 'refutes')];
  assert.deepEqual(research.claimScore(items),
    { support: 6, refute: 3, net_score: 3, has_counterevidence: true });
  assert.deepEqual(research.claimScore([items[0], items[0]]),
    { support: 3, refute: 0, net_score: 3, has_counterevidence: false });
  assert.deepEqual(research.claimScore([]),
    { support: 0, refute: 0, net_score: 0, has_counterevidence: false });
  assert.throws(() => research.claimScore([{ ...items[0], independence_key: 'invented' }]));
});

test('research presets are resource ceilings and do not force validator or debate work', () => {
  assert.equal(research.validateBudget('high', usage()), true);
  assert.equal(research.validateBudget('low', usage({ researchers: 1, fetched_sources: 3,
    debate_rounds: 2 })), true);
  assert.equal(research.validateBudget('medium', usage({ researchers: 3, validator: 1,
    fetched_sources: 12, debate_rounds: 5 })), true);
  assert.equal(research.validateBudget('high', usage({ researchers: 3, validator: 1,
    fetched_sources: 24, debate_rounds: 5 })), true);
  for (const [preset, overrides] of [
    ['low', { researchers: 2 }], ['low', { validator: 1 }], ['low', { fetched_sources: 4 }],
    ['medium', { fetched_sources: 13 }], ['high', { fetched_sources: 25 }],
    ['high', { researchers: 4 }], ['high', { validator: 2 }], ['high', { debate_rounds: 6 }],
    ['high', { debate_rounds: -1 }], ['high', { security: 'yes' }],
    ['high', { unknown: true }]
  ]) assert.equal(research.validateBudget(preset, usage(overrides)), false);
});

test('published coverage and research helpers match their generator sources', () => {
  for (const [skill, script] of [['deep-explore', 'completeness.js'], ['deep-research', 'research-score.js']]) {
    assert.equal(fs.readFileSync(path.join(__dirname,
      '../plugin/sd0x-dev-flow-codex/skills', skill, 'scripts', script), 'utf8'),
    fs.readFileSync(path.join(__dirname, '../scripts/research-validators', `${skill}.js`), 'utf8'));
  }
});
