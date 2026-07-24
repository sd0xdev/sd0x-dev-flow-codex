'use strict';

const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const TRUSTED_CONTRACTS = require('./research-semantic-contracts.json');

const TRUSTED_VALIDATORS = Object.freeze({
  ask: 'ask.js',
  brainstorm: 'brainstorm.js',
  'deep-explore': 'deep-explore.js',
  'deep-research': 'deep-research.js',
  'seek-verdict': 'seek-verdict.js'
});
const PAYLOAD_VALIDATORS = Object.freeze({
  ask: 'redact.js',
  brainstorm: 'debate.js',
  'deep-explore': 'completeness.js',
  'deep-research': 'research-score.js',
  'seek-verdict': 'verdict-state.js'
});

function trustedSemanticContract(unit) {
  const contract = TRUSTED_CONTRACTS[unit];
  assert.ok(contract, `trusted semantic contract is missing ${unit}`);
  assert.match(contract.skill_sha256, /^[0-9a-f]{64}$/,
    `trusted SKILL digest is missing ${unit}`);
  return structuredClone({
    required: contract.required,
    forbidden: contract.forbidden
  });
}

function trustedSkillDigest(unit) {
  const contract = TRUSTED_CONTRACTS[unit];
  assert.ok(contract, `trusted semantic contract is missing ${unit}`);
  assert.match(contract.skill_sha256, /^[0-9a-f]{64}$/,
    `trusted SKILL digest is missing ${unit}`);
  return contract.skill_sha256;
}

function semanticContractBlock(unit, contract = trustedSemanticContract(unit)) {
  return [
    `<!-- sd0x-semantic-contract:v1 unit=${unit} -->`,
    '```json',
    JSON.stringify(contract, null, 2),
    '```'
  ].join('\n');
}

function semanticTestSource(spec) {
  const contract = trustedSemanticContract(spec.unit);
  const payload = {
    target: spec.target,
    targetPackage: spec.targetPackage,
    unit: spec.unit,
    required: contract.required,
    forbidden: contract.forbidden
  };
  return [
    "'use strict';",
    `// sd0x-migration-semantics target=${spec.target} unit=${spec.unit}`,
    "const { defineSemanticContractTests } = require('../scripts/research-contract-test');",
    `defineSemanticContractTests(${JSON.stringify(payload, null, 2)});`,
    ''
  ].join('\n');
}

function semanticActiveContractBlock(unit, contract = trustedSemanticContract(unit)) {
  return [
    '<!-- sd0x-active-semantic-contract:v1 unit=' + unit + ' -->',
    'Normative semantic requirements:',
    ...contract.required.map((clause) => '- ' + clause),
    '<!-- sd0x-active-semantic-contract:end -->'
  ].join('\n');
}

function containedRegularFile(root, relative) {
  let current = root;
  for (const component of relative.split('/')) {
    current = path.join(current, component);
    let stat;
    try {
      stat = fs.lstatSync(current);
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      throw error;
    }
    assert.equal(stat.isSymbolicLink(), false,
      `semantic skill path must not contain symlinks: ${relative}`);
  }
  assert.equal(fs.lstatSync(current).isFile(), true,
    `semantic skill path must be a regular file: ${relative}`);
  return current;
}

function skillPath(root, spec) {
  const candidate = containedRegularFile(root,
    `migration/candidates/${spec.target}/SKILL.md`);
  if (candidate) return candidate;
  const finalPayload = containedRegularFile(root,
    `migration/packs/${spec.targetPackage}/${spec.target}/SKILL.md`);
  assert.ok(finalPayload,
    `semantic test requires a candidate or pack SKILL.md for ${spec.target}`);
  return finalPayload;
}

function validateSemanticContract(skillText, spec, options = {}) {
  const trusted = trustedSemanticContract(spec.unit);
  assert.deepEqual({ required: spec.required, forbidden: spec.forbidden }, trusted,
    `${spec.unit}: generated semantic test differs from the trusted registry`);
  const exactBlock = semanticContractBlock(spec.unit, trusted);
  assert.ok(skillText.includes(exactBlock),
    `${spec.unit}: exact machine-readable semantic contract is missing`);
  const markers = [...skillText.matchAll(
    /<!-- sd0x-semantic-contract:v1 unit=([a-z0-9-]+\/[a-z0-9-]+) -->/g
  )].map((match) => match[1]);
  assert.equal(markers.filter((unit) => unit === spec.unit).length, 1,
    `${spec.unit}: semantic contract marker must appear exactly once`);
  const exactActiveBlock = semanticActiveContractBlock(spec.unit, trusted);
  assert.ok(skillText.includes(exactActiveBlock),
    `${spec.unit}: exact active semantic contract is missing`);
  const activeMarkers = [...skillText.matchAll(
    /<!-- sd0x-active-semantic-contract:v1 unit=([a-z0-9-]+\/[a-z0-9-]+) -->/g
  )].map((match) => match[1]);
  assert.equal(activeMarkers.filter((unit) => unit === spec.unit).length, 1,
    `${spec.unit}: active semantic contract marker must appear exactly once`);
  const activeText = skillText
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/```[\s\S]*?```/g, '');
  for (const clause of trusted.forbidden) {
    assert.equal(typeof clause, 'string');
    assert.ok(clause.length > 0 && !activeText.includes(clause),
      `${spec.unit}: forbidden semantic clause remains: ${clause}`);
  }
  if (spec.unit === 'deep-explore/default') {
    const policyLines = activeText.split('\n').filter((line) =>
      /\b(?:third|wave three|extra wave)\b.*\b(?:only|permit(?:ted)?|allow(?:ed)?|reserv(?:e|ed)|qualif(?:y|ied))\b/i.test(line)
    );
    assert.ok(policyLines.length > 0 && policyLines.every((line) =>
      /cross-cutting critical gap/i.test(line) &&
      /more than 70% concentrated/i.test(line) &&
      /high-risk auth\/security\/migration domain/i.test(line)
    ), `${spec.unit}: active third-wave policy contradicts the semantic contract`);
  }
  assert.equal(
    crypto.createHash('sha256').update(skillText).digest('hex'),
    options.trustedSkillSha256 || trustedSkillDigest(spec.unit),
    `${spec.unit}: SKILL.md differs from the trusted SKILL bytes`
  );
  return true;
}

function defineSemanticContractTests(spec) {
  const selectedSkill = skillPath(process.cwd(), spec);
  const skillText = fs.readFileSync(selectedSkill, 'utf8');
  for (const [index, clause] of spec.required.entries()) {
    test(`semantic contract ${spec.unit} required ${index + 1}`, () => {
      assert.equal(validateSemanticContract(skillText, spec), true);
      assert.ok(skillText.includes(clause));
    });
  }
  for (const [index, clause] of spec.forbidden.entries()) {
    test(`semantic contract ${spec.unit} forbidden ${index + 1}`, () => {
      assert.equal(validateSemanticContract(skillText, spec), true);
    });
  }
  const loadTrustedValidator = () => {
    const name = TRUSTED_VALIDATORS[spec.target];
    assert.ok(name, `trusted validator is missing ${spec.target}`);
    return require(path.join(__dirname, 'research-validators', name));
  };
  if (spec.target === 'ask') {
    const helper = loadTrustedValidator();
    test('ask secret paths and output are protected', () => {
      assert.equal(helper.isSecretPath('.env.production'), true);
      assert.equal(helper.isSecretPath('config/credentials.json'), true);
      assert.equal(helper.isSecretPath('../outside.txt'), true);
      assert.equal(helper.isSecretPath('src/config.js'), false);
      assert.equal(helper.redact('api_key=supersecretvalue'), 'api_key=[REDACTED]');
      assert.equal(helper.redact('sk-abcdefghijklmnop'), '[REDACTED]');
      assert.match(helper.redact('credential=mediumconfidence'), /me\*+ce/);
    });
  } else if (spec.target === 'brainstorm') {
    const debate = loadTrustedValidator();
    test('brainstorm validates attacks and five-round termination', () => {
      const claims = new Set(['claim-a', 'evidence-a']);
      const novelty = new Set();
      const attack = { attack_id: 'a1', target_claim_id: 'claim-a', novelty_key: 'n1', argument: 'claim-a fails because evidence conflicts', evidence_refs: ['evidence-a'], proposed_by: 'native-codex', validity: 'valid' };
      assert.equal(debate.validateAttack(attack, claims, novelty, new Set()), true);
      assert.equal(debate.validateAttack({ ...attack, attack_id: '' }, claims, new Set(), new Set()), false);
      assert.equal(debate.validateAttack({
        ...attack,
        attack_id: 'unrelated',
        novelty_key: 'unrelated',
        argument: 'unrelated words without rebuttal'
      }, claims, new Set(), new Set()), false);
      const side = (attacks) => ({
        attacks,
        concessions: [],
        evidence_refs: attacks.flatMap((value) => value.evidence_refs),
        new_valid_attack: attacks.some((value) => value.validity === 'valid'),
        position_changed: false,
        position_update: '',
        unresolved_attack: attacks.some((value) => value.validity === 'unresolved')
      });
      const active = (index) => ({
        native_codex: side([{ ...attack, attack_id: `a${index}`, novelty_key: `n${index}` }]),
        claude_adapter: side([])
      });
      const settled = { native_codex: side([]), claude_adapter: side([]) };
      assert.equal(debate.transcriptState([active(1), active(2), active(3), active(4)], claims), 'continue');
      assert.equal(debate.transcriptState([active(1), active(2), active(3), active(4), active(5)], claims), 'divergent');
      assert.equal(debate.transcriptState([active(1), settled], claims), 'equilibrium');
      assert.equal(debate.transcriptState([{ native_codex: {}, claude_adapter: {} }, settled], claims), 'invalid');
      assert.equal(debate.classifyOutcome({ unresolved: true, condition_dependent: true }), 'divergent');
    });
  } else if (spec.target === 'deep-explore') {
    const exploration = loadTrustedValidator();
    const conditions = (overrides = {}) => ({
      concentrationAbove70Percent: false,
      crossCuttingCriticalGap: false,
      highRiskDomain: false,
      ...overrides
    });
    test('deep exploration uses the fixed completeness threshold and ceiling', () => {
      assert.equal(exploration.completeness(0, 0, 1), 70);
      assert.equal(exploration.completeness(0, 0, 0), 70);
      assert.equal(exploration.completeness(0, 4, 0), 100);
      assert.equal(exploration.decision({ score: 79, criticalOpen: 0, hardFail: false, wavesRun: 3, waveCeiling: 3, qualifyingConditions: conditions({ crossCuttingCriticalGap: true }) }), 'inconclusive');
      assert.equal(exploration.decision({ score: 80, criticalOpen: 0, hardFail: false, wavesRun: 2, waveCeiling: 3, qualifyingConditions: conditions() }), 'complete');
      assert.equal(exploration.decision({ score: 79, criticalOpen: 0, hardFail: false, wavesRun: 2, waveCeiling: 3, qualifyingConditions: conditions() }), 'inconclusive');
      assert.equal(exploration.decision({ score: 79, criticalOpen: 1, hardFail: false, wavesRun: 2, waveCeiling: 3, qualifyingConditions: conditions({ crossCuttingCriticalGap: true }) }), 'continue');
      assert.throws(() => exploration.decision({ score: 79, criticalOpen: 1, hardFail: false, wavesRun: 2, waveCeiling: 3, waveThreeTriggered: true }), /input is invalid/);
      assert.throws(() => exploration.decision({ score: 79, criticalOpen: 1, hardFail: false, wavesRun: 2, waveCeiling: 3, qualifyingConditions: conditions(), extra: true }), /input is invalid/);
    });
  } else if (spec.target === 'deep-research') {
    const research = loadTrustedValidator();
    test('deep research deduplicates evidence and applies mode thresholds', () => {
      const authorityId = 'sd0x-host-identity-v1';
      const identityFixtures = new Map([
        ['https://news.example.co.uk/report', {
          author_id: null,
          authority_id: authorityId,
          identity_binding_hash: '49a6937af0b6545d490d4173a915e51266068eb673b5e53a728bb2d929032bdf',
          publisher_id: 'example-publisher',
          signature: 'OrI3To7xUwWdT72UmvbXedsZkxbK5evvyzByokR/Hu/lYyJ0MRXiybFP2yaCPE02cYAH+Ls5sEXhG0Mp8tARDw=='
        }],
        ['https://news.example.co.uk/another-report', {
          author_id: null,
          authority_id: authorityId,
          identity_binding_hash: '5e67f19a084f3c79d89f63cafe87408f5dcf4304cc25dbe9e3c815ecafa32093',
          publisher_id: 'example-publisher',
          signature: 'F5ADwRQI/99fPW+aYZAAUnIjlk+npHLX+pf8Hp1x2d/0AHbYTTo+nSI8QkmXdj56SqWCi854GUMLyxIHWlLyDQ=='
        }],
        ['https://reddit.com/r/node/comments/example', {
          author_id: 'alice',
          authority_id: authorityId,
          identity_binding_hash: 'eb5e0962f6f02e25a4f5dd4f9e507d27820d6aef2f2b5a750482db32b3cfcc45',
          publisher_id: 'reddit',
          signature: 'kM6aMIdJhwY0hueYubRdmhWfwB3zb5qAR37a23lLtmWFwBG6QtDGzvqlSNgwWkL5DIiN8I1C0VOq4dSLSgn6DA=='
        }]
      ]);
      const base = {
        source_id: 'https://example.com/repo.git@' + 'a'.repeat(40) + ':src/a.js#L1',
        independence_key: 'https://example.com/repo.git@' + 'a'.repeat(40),
        publisher_id: null,
        author_id: null,
        identity_binding_hash: null,
        source_type: 'repository',
        agent_role: 'implementation',
        locator: 'src/a.js:L1',
        content_hash: 'b'.repeat(64),
        relation: 'supports',
        weight: 3
      };
      const secondary = {
        ...base,
        source_id: 'https://news.example.co.uk/report',
        publisher_id: 'example-publisher',
        identity_binding_hash: '',
        independence_key: 'publisher:example-publisher',
        source_type: 'authoritative-secondary',
        content_hash: 'c'.repeat(64),
        weight: 2
      };
      const secondaryIdentity = identityFixtures.get(secondary.source_id);
      secondary.identity_binding_hash = secondaryIdentity.identity_binding_hash;
      const identities = new Map([[secondary.source_id, secondaryIdentity]]);
      const scored = research.claimScore([base, base, secondary], identities);
      assert.deepEqual(scored, { support: 5, refute: 0, net_score: 5, divergent: false });
      assert.equal(research.validateResearchPlan({ questions: ['q'], subquestions: ['s'], required_source_types: ['repository'] }), true);
      assert.equal(research.validateClaim({ claim_id: 'c1', claim: 'claim', evidence: [base], confidence: 0.8, critical: true, status: 'supported' }), true);
      assert.throws(() => research.claimScore([{ ...base, weight: 999 }]), /exact schema/);
      assert.equal(research.validateEvidence({ ...base, independence_key: 'unknown' }), false);
      assert.equal(research.validateEvidence(
        { ...secondary, independence_key: 'publisher:forged' },
        identities
      ), false);
      assert.equal(research.validateEvidence({
        ...secondary,
        source_id: 'https://Example.COM/path?utm_source=x#frag'
      }, identities), false);
      const samePublisher = {
        ...secondary,
        source_id: 'https://news.example.co.uk/another-report',
        content_hash: 'd'.repeat(64)
      };
      const samePublisherIdentity = identityFixtures.get(samePublisher.source_id);
      samePublisher.identity_binding_hash = samePublisherIdentity.identity_binding_hash;
      const samePublisherIdentities = new Map(identities);
      samePublisherIdentities.set(samePublisher.source_id, samePublisherIdentity);
      assert.equal(research.independentSupportCount(
        [secondary, samePublisher], samePublisherIdentities
      ), 1);
      const community = {
        ...secondary,
        source_id: 'https://reddit.com/r/node/comments/example',
        publisher_id: 'reddit',
        author_id: 'alice',
        identity_binding_hash: '',
        independence_key: 'publisher:reddit:author:alice',
        source_type: 'community',
        weight: 1
      };
      const communityIdentity = identityFixtures.get(community.source_id);
      community.identity_binding_hash = communityIdentity.identity_binding_hash;
      const communityIdentities = new Map([[community.source_id, communityIdentity]]);
      assert.equal(research.validateEvidence(
        community, communityIdentities
      ), true);
      assert.equal(research.validateEvidence(
        { ...community, author_id: 'r' }, communityIdentities
      ), false);
      assert.equal(research.validateEvidence({
        ...secondary,
        publisher_id: 'forged-publisher',
        independence_key: 'publisher:forged-publisher'
      }, identities), false);
      assert.equal(research.validateEvidence(secondary), false);
      const rogue = crypto.generateKeyPairSync('ed25519');
      const forgedSource = 'https://news.example.co.uk/forged-report';
      const forgedStatement = JSON.stringify({
        source_id: forgedSource,
        publisher_id: 'forged-publisher',
        author_id: null,
        authority_id: authorityId
      });
      const forgedIdentity = {
        author_id: null,
        authority_id: authorityId,
        identity_binding_hash: crypto.createHash('sha256')
          .update(forgedStatement).digest('hex'),
        publisher_id: 'forged-publisher',
        signature: crypto.sign(null, Buffer.from(forgedStatement), rogue.privateKey)
          .toString('base64')
      };
      const forgedEvidence = {
        ...secondary,
        source_id: forgedSource,
        publisher_id: 'forged-publisher',
        independence_key: 'publisher:forged-publisher',
        identity_binding_hash: forgedIdentity.identity_binding_hash
      };
      assert.equal(research.validateEvidence(
        forgedEvidence,
        new Map([[forgedSource, forgedIdentity]])
      ), false);
      assert.equal(research.ratio(0, 0), 0);
      assert.equal(research.ratio(0, 0, true), 100);
      assert.equal(research.completeness('compliance', { diversity: 90, cross_verification: 90, gap_coverage: 90, question_closure: 90 }).complete, true);
      assert.throws(() => research.completeness('decision', { diversity: 101, cross_verification: 0, gap_coverage: 0, question_closure: 0 }), /finite 0-100/);
      assert.throws(() => research.completeness('decision', { diversity: Infinity, cross_verification: 0, gap_coverage: 0, question_closure: 0 }), /finite 0-100/);
      assert.equal(research.BUDGETS.low.sources, 3);
      assert.equal(research.BUDGETS.high.sources, 24);
      assert.equal(research.validateBudget('low', { researchers: 1, validator: 0, fetched_sources: 3, debate_rounds: 0, security: false }), true);
      assert.equal(research.validateBudget('low', { researchers: 1, validator: 0, fetched_sources: 4, debate_rounds: 0, security: false }), false);
      assert.equal(research.validateBudget('high', { researchers: 3, validator: 1, fetched_sources: 24, debate_rounds: 1, security: false }), true);
    });
    test('deep research rejects cross-seeded dispatch traces', () => {
      const inputHash = 'd'.repeat(64);
      const trace = {
        dispatch_id: 'd1',
        role: 'official',
        scope_hash: 'e'.repeat(64),
        prompt_template_hash: 'f'.repeat(64),
        input_artifact_hashes: [inputHash],
        started_at: '2026-01-01T00:00:01.000Z',
        completed_at: '2026-01-01T00:01:00.000Z',
        evidence_count: 1
      };
      const bindings = new Map([['d1', {
        bound_at: '2026-01-01T00:00:00.000Z',
        input_artifact_hashes: [inputHash]
      }]]);
      assert.equal(research.validateDispatchTrace([trace], new Set(), bindings), true);
      assert.equal(research.validateDispatchTrace([], new Set(), new Map()), false);
      assert.equal(research.validateDispatchTrace([trace], new Set([inputHash]), bindings), false);
      const late = new Map([['d1', {
        bound_at: '2026-01-01T00:02:00.000Z',
        input_artifact_hashes: [inputHash]
      }]]);
      assert.equal(research.validateDispatchTrace([trace], new Set(), late), false);
      const peer = { ...trace, dispatch_id: 'peer', input_artifact_hashes: [] };
      const startsLate = {
        ...trace,
        dispatch_id: 'late',
        input_artifact_hashes: [],
        started_at: '2026-01-01T00:02:00.000Z',
        completed_at: '2026-01-01T00:03:00.000Z'
      };
      const twoBindings = new Map([
        ['peer', { bound_at: '2026-01-01T00:00:00.000Z', input_artifact_hashes: [] }],
        ['late', { bound_at: '2026-01-01T00:00:00.000Z', input_artifact_hashes: [] }]
      ]);
      assert.equal(research.validateDispatchTrace([peer, startsLate], new Set(), twoBindings), false);
    });
  } else if (spec.target === 'seek-verdict') {
    const verdict = loadTrustedValidator();
    const evidence = [
      { evidence_id: '1'.repeat(64), binding_hash: 'a'.repeat(64) },
      { evidence_id: '2'.repeat(64), binding_hash: 'b'.repeat(64) },
      { evidence_id: '3'.repeat(64), binding_hash: 'c'.repeat(64) }
    ];
    const trustedEvidence = new Map([
      [evidence[0].evidence_id, { binding_hash: evidence[0].binding_hash, independence_key: 'publisher:one', source_id: 'https://one.example/report' }],
      [evidence[1].evidence_id, { binding_hash: evidence[1].binding_hash, independence_key: 'publisher:two', source_id: 'https://two.example/report' }],
      [evidence[2].evidence_id, { binding_hash: evidence[2].binding_hash, independence_key: 'verifier:claude', source_id: 'verifier:claude' }]
    ]);
    const base = { finding_key: 'f1', fingerprint: 'a'.repeat(64), intent: 'dismiss', severity: 'P1', confidence: 0.90, evidence, origin: 'native-codex', session: 's', branch: 'b', dismissal_evidence_hash: verdict.evidenceHash(evidence), user_turn: 1 };
    const confirmation = (input, overrides = {}) => ({
      finding_key: input.finding_key,
      fingerprint: input.fingerprint,
      session: input.session,
      branch: input.branch,
      dismissal_evidence_hash: input.dismissal_evidence_hash,
      user_turn: 2,
      decision: 'confirm',
      ...overrides
    });
    test('seek verdict selects the opposite model and enforces later-turn confirmation', () => {
      const evaluated = verdict.evaluate(verdict.freshState(), base, trustedEvidence);
      assert.equal(evaluated.transition, 'DISMISS_CANDIDATE');
      assert.deepEqual(evaluated.verifier, ['claude-adapter']);
      assert.equal(verdict.confirmCandidate(
        evaluated.state, confirmation(base), trustedEvidence
      ).transition, 'DISMISS_VERIFIED');
      assert.equal(verdict.confirmCandidate(
        evaluated.state, confirmation(base, { user_turn: 3 }), trustedEvidence
      ).transition, 'ACTIVE');
      const changedRegistry = new Map(trustedEvidence);
      changedRegistry.set(evidence[0].evidence_id, {
        ...changedRegistry.get(evidence[0].evidence_id),
        source_id: 'https://changed.example/report',
        independence_key: 'publisher:changed'
      });
      assert.equal(verdict.confirmCandidate(
        evaluated.state, confirmation(base), changedRegistry
      ).transition, 'ACTIVE');
      const missingRegistry = verdict.confirmCandidate(
        evaluated.state, confirmation(base)
      );
      assert.equal(missingRegistry.transition, 'ACTIVE');
      assert.equal(missingRegistry.state.candidate, null);
      assert.equal(verdict.confirmCandidate(
        missingRegistry.state, confirmation(base), trustedEvidence
      ).transition, 'ACTIVE');
    });
    test('seek verdict consumes intent and raises streak thresholds', () => {
      const evaluated = verdict.evaluate(verdict.freshState(), base, trustedEvidence);
      assert.throws(() => verdict.evaluate(evaluated.state, base, trustedEvidence), /already consumed/);
      assert.deepEqual(verdict.effectiveDismissThreshold('P2', 3), { confidence: 0.9, evidence: 3 });
      assert.deepEqual(verdict.effectiveDismissThreshold('Nit', 0), { confidence: 0.7, evidence: 1 });
      assert.deepEqual(verdict.oppositeVerifier('user'), ['native-codex', 'claude-adapter']);
      const pending = verdict.evaluate(verdict.freshState(), base, trustedEvidence);
      const other = verdict.evaluate(pending.state, { ...base, finding_key: 'f2', intent: 'clarify', user_turn: 2 }, trustedEvidence);
      assert.equal(other.state.candidate, null);
      assert.throws(() => verdict.evaluate(verdict.freshState(), { ...base, confidence: Infinity }, trustedEvidence), /input/);
      const duplicated = [evidence[0], { ...evidence[0] }];
      assert.throws(() => verdict.evaluate(verdict.freshState(), { ...base, evidence: duplicated, dismissal_evidence_hash: verdict.evidenceHash(duplicated) }, trustedEvidence), /input/);
      const callerInvented = [{ ...evidence[0], independence_key: 'publisher:invented' }];
      assert.throws(() => verdict.evaluate(verdict.freshState(), { ...base, evidence: callerInvented, dismissal_evidence_hash: verdict.evidenceHash(callerInvented) }, trustedEvidence), /input/);
      assert.throws(() => verdict.evaluate(verdict.freshState(), base), /trusted evidence registry/);
      const samePublisher = evidence.map((item, index) => ({
        evidence_id: String(index + 4).repeat(64),
        binding_hash: String.fromCharCode(100 + index).repeat(64)
      }));
      const samePublisherRegistry = new Map(samePublisher.map((item, index) => [
        item.evidence_id,
        { binding_hash: item.binding_hash, independence_key: 'publisher:one', source_id: `https://one.example/report-${index}` }
      ]));
      const samePublisherInput = { ...base, evidence: samePublisher, dismissal_evidence_hash: verdict.evidenceHash(samePublisher) };
      assert.equal(verdict.evaluate(verdict.freshState(), samePublisherInput, samePublisherRegistry).transition, 'UNRESOLVED');
      const repeatedSource = new Map(trustedEvidence);
      repeatedSource.set(evidence[1].evidence_id, {
        ...repeatedSource.get(evidence[1].evidence_id),
        source_id: repeatedSource.get(evidence[0].evidence_id).source_id
      });
      assert.throws(() => verdict.evaluate(verdict.freshState(), base, repeatedSource), /registry/);
      const repeatedBinding = new Map(trustedEvidence);
      repeatedBinding.set(evidence[1].evidence_id, {
        ...repeatedBinding.get(evidence[1].evidence_id),
        binding_hash: repeatedBinding.get(evidence[0].evidence_id).binding_hash
      });
      assert.throws(() => verdict.evaluate(verdict.freshState(), base, repeatedBinding), /registry/);
      assert.throws(() => verdict.evaluate(verdict.freshState(), { ...base, session: '' }, trustedEvidence), /input/);
      assert.throws(() => verdict.evaluate('', base, trustedEvidence), /state is invalid/);
      assert.throws(() => verdict.evaluate(0, base, trustedEvidence), /state is invalid/);
      assert.throws(() => verdict.evaluate(false, base, trustedEvidence), /state is invalid/);
    });
    test('seek verdict persistence rejects stale and concurrent writers', async () => {
      const root = fs.mkdtempSync(path.join(os.tmpdir(), 'seek-verdict-state-'));
      const concurrentRoot = fs.mkdtempSync(
        path.join(os.tmpdir(), 'seek-verdict-concurrent-')
      );
      const crashRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'seek-verdict-crash-'));
      try {
        const first = verdict.freshState();
        const stale = structuredClone(first);
        first.dismiss_streak = 1;
        const saved = verdict.saveState(root, first, 0);
        assert.equal(saved.version, 1);
        assert.throws(() => verdict.saveState(root, stale, 0), /changed; retry/);
        const updated = verdict.updateState(root, (current) => ({
          state: { ...current, dismiss_streak: 2 },
          transition: 'UPDATED'
        }));
        assert.equal(updated.state.version, 2);
        assert.equal(updated.state.dismiss_streak, 2);
        const modulePath = path.join(
          __dirname, 'research-validators', 'seek-verdict.js'
        );
        const startAt = Date.now() + 300;
        const script = [
          "'use strict';",
          'const verdict = require(' + JSON.stringify(modulePath) + ');',
          'const root = process.argv[1];',
          'const startAt = Number(process.argv[2]);',
          'const state = verdict.freshState();',
          'while (Date.now() < startAt) {}',
          'verdict.saveState(root, state, 0);'
        ].join('\n');
        const runWriter = () => new Promise((resolve) => {
          const child = spawn(process.execPath, [
            '-e', script, concurrentRoot, String(startAt)
          ], { stdio: ['ignore', 'ignore', 'pipe'] });
          let stderr = '';
          child.stderr.setEncoding('utf8');
          child.stderr.on('data', (chunk) => { stderr += chunk; });
          child.on('close', (code) => resolve({ code, stderr }));
        });
        const writers = await Promise.all([runWriter(), runWriter()]);
        assert.deepEqual(writers.map((writer) => writer.code).sort(), [0, 1]);
        assert.equal(verdict.loadState(concurrentRoot).version, 1);
        assert.match(writers.find((writer) => writer.code === 1).stderr,
          /state lock is busy|state changed; retry/);
        const holderScript = [
          "'use strict';",
          'const verdict = require(' + JSON.stringify(modulePath) + ');',
          'const root = process.argv[1];',
          'verdict.updateState(root, (state) => {',
          "  process.stdout.write('locked\\n');",
          '  const wait = new Int32Array(new SharedArrayBuffer(4));',
          '  while (true) Atomics.wait(wait, 0, 0, 1000);',
          '});'
        ].join('\n');
        const holder = spawn(process.execPath, ['-e', holderScript, crashRoot], {
          stdio: ['ignore', 'pipe', 'pipe']
        });
        await new Promise((resolve, reject) => {
          holder.stdout.setEncoding('utf8');
          holder.stdout.once('data', resolve);
          holder.once('error', reject);
        });
        assert.throws(() => verdict.updateState(crashRoot, (state) => ({
          state,
          transition: 'SHOULD_NOT_RUN'
        })), /state lock is busy/);
        holder.kill('SIGKILL');
        await new Promise((resolve) => holder.once('close', resolve));
        const stateLock = path.join(
          crashRoot, '.sd0x', 'seek-verdict-state.lock'
        );
        const stateLockStat = fs.lstatSync(stateLock);
        const stateLockOwner = JSON.parse(fs.readFileSync(
          path.join(stateLock, 'owner.json'), 'utf8'
        ));
        const claimsDirectory = stateLock + '.reclaim-claims';
        fs.mkdirSync(claimsDirectory, { mode: 0o700 });
        const targetIdentity = {
          dev: stateLockStat.dev,
          ino: stateLockStat.ino,
          owner: stateLockOwner
        };
        const liveClaim = path.join(claimsDirectory, 'live-claim.json');
        const liveClaimBytes = JSON.stringify({
          owner: {
            pid: process.pid,
            created_at: new Date().toISOString(),
            nonce: crypto.randomUUID()
          },
          target: targetIdentity
        }) + '\n';
        fs.writeFileSync(liveClaim, liveClaimBytes, { flag: 'wx', mode: 0o600 });
        assert.throws(() => verdict.saveState(
          crashRoot, verdict.freshState(), 0
        ), /state lock is busy/);
        assert.equal(fs.readFileSync(liveClaim, 'utf8'), liveClaimBytes);
        assert.deepEqual(fs.readdirSync(claimsDirectory), ['live-claim.json']);
        fs.rmSync(liveClaim);
        const foreignClaim = path.join(
          claimsDirectory, 'foreign-generation-claim.json'
        );
        const foreignClaimBytes = JSON.stringify({
          owner: {
            pid: process.pid,
            created_at: new Date().toISOString(),
            nonce: crypto.randomUUID()
          },
          target: { ...targetIdentity, ino: targetIdentity.ino + 1 }
        }) + '\n';
        fs.writeFileSync(foreignClaim, foreignClaimBytes, {
          flag: 'wx', mode: 0o600
        });
        fs.writeFileSync(path.join(claimsDirectory, 'dead-claim.json'),
          JSON.stringify({
            owner: {
              pid: 99999999,
              created_at: new Date().toISOString(),
              nonce: crypto.randomUUID()
            },
            target: targetIdentity
          }) + '\n', { flag: 'wx', mode: 0o600 });
        const reclaimAt = Date.now() + 500;
        const reclaimerScript = [
          "'use strict';",
          'const verdict = require(' + JSON.stringify(modulePath) + ');',
          'const root = process.argv[1];',
          'const startAt = Number(process.argv[2]);',
          'const state = verdict.freshState();',
          'state.dismiss_streak = 1;',
          'while (Date.now() < startAt) {}',
          'verdict.saveState(root, state, 0);'
        ].join('\n');
        const runReclaimer = () => new Promise((resolve) => {
          const child = spawn(process.execPath, [
            '-e', reclaimerScript, crashRoot, String(reclaimAt)
          ], { stdio: ['ignore', 'ignore', 'pipe'] });
          let stderr = '';
          child.stderr.setEncoding('utf8');
          child.stderr.on('data', (chunk) => { stderr += chunk; });
          child.on('close', (code) => resolve({ code, stderr }));
        });
        const reclaimers = await Promise.all(
          Array.from({ length: 8 }, () => runReclaimer())
        );
        assert.equal(reclaimers.filter((item) => item.code === 0).length, 1,
          JSON.stringify(reclaimers));
        assert.equal(reclaimers.filter((item) => item.code !== 0).length, 7);
        assert.ok(reclaimers.filter((item) => item.code !== 0).every((item) =>
          /state lock is busy|state lock changed during reclaim|state changed; retry/.test(
            item.stderr
          )),
        JSON.stringify(reclaimers));
        const recovered = verdict.loadState(crashRoot);
        assert.equal(recovered.version, 1);
        assert.equal(recovered.dismiss_streak, 1);
        assert.equal(fs.existsSync(stateLock), false);
        assert.deepEqual(fs.readdirSync(claimsDirectory), [
          'foreign-generation-claim.json'
        ]);
        assert.equal(fs.readFileSync(foreignClaim, 'utf8'), foreignClaimBytes);
        fs.rmSync(foreignClaim);
        assert.deepEqual(fs.readdirSync(claimsDirectory), []);
        assert.equal(fs.existsSync(stateLock + '.reclaim-lease'), false);
      } finally {
        fs.rmSync(root, { recursive: true, force: true });
        fs.rmSync(concurrentRoot, { recursive: true, force: true });
        fs.rmSync(crashRoot, { recursive: true, force: true });
      }
    });
  }
}

module.exports = {
  defineSemanticContractTests,
  semanticActiveContractBlock,
  semanticContractBlock,
  semanticTestSource,
  PAYLOAD_VALIDATORS,
  trustedSemanticContract,
  trustedSkillDigest,
  TRUSTED_VALIDATORS,
  validateSemanticContract
};
