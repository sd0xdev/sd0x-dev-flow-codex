'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const WEIGHTS = Object.freeze({ exploratory: [30, 30, 25, 15], compliance: [20, 35, 25, 20], decision: [25, 35, 20, 20] });
const THRESHOLDS = Object.freeze({ exploratory: 70, compliance: 90, decision: 80 });
const BUDGETS = Object.freeze({
  low: Object.freeze({ researchers: 1, validator: 0, sources: 3, debate: 'security-only' }),
  medium: Object.freeze({ researchers: 3, validator: 1, sources: 12, debate: 'conditional' }),
  high: Object.freeze({ researchers: 3, validator: 1, sources: 24, debate: 'forced' })
});
const CLAIM_KEYS = Object.freeze(['claim', 'claim_id', 'confidence', 'critical', 'evidence', 'status']);
const EVIDENCE_KEYS = Object.freeze(['agent_role', 'author_id', 'content_hash', 'identity_binding_hash', 'independence_key', 'locator', 'publisher_id', 'relation', 'source_id', 'source_type', 'weight']);
const IDENTITY_KEYS = Object.freeze(['author_id', 'authority_id', 'identity_binding_hash', 'publisher_id', 'signature']);
const PLAN_KEYS = Object.freeze(['questions', 'required_source_types', 'subquestions']);
const TRACE_KEYS = Object.freeze(['completed_at', 'dispatch_id', 'evidence_count', 'input_artifact_hashes', 'prompt_template_hash', 'role', 'scope_hash', 'started_at']);
const BINDING_KEYS = Object.freeze(['bound_at', 'input_artifact_hashes']);
const DIMENSION_KEYS = Object.freeze(['cross_verification', 'diversity', 'gap_coverage', 'question_closure']);
const HASH = new RegExp('^[0-9a-f]{64}$');
const DECLARED_IDENTITY = new RegExp('^[a-z0-9][a-z0-9._:@/-]{1,254}$');
const SIGNATURE = new RegExp('^[A-Za-z0-9+/]+={0,2}$');
const TRUSTED_AUTHORITY_KEYS = new Map([[
  'sd0x-host-identity-v1',
  crypto.createPublicKey([
    '-----BEGIN PUBLIC KEY-----',
    'MCowBQYDK2VwAyEA9JWLkT0w/SHddbC/mZ8DpYctJubz1wiysAC8qaXuSQA=',
    '-----END PUBLIC KEY-----',
    ''
  ].join('\n'))
]]);

function exactKeys(value, expected) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return JSON.stringify(Object.keys(value).sort()) === JSON.stringify(expected);
}

function boundedStrings(values, allowEmpty = false) {
  return Array.isArray(values) && (allowEmpty || values.length > 0) &&
    values.every((value) => typeof value === 'string' && value.length > 0);
}

function validateResearchPlan(plan) {
  return exactKeys(plan, PLAN_KEYS) && boundedStrings(plan.questions) &&
    boundedStrings(plan.subquestions) && boundedStrings(plan.required_source_types);
}

function expectedWeight(sourceType) {
  if (['official', 'official-standard', 'repository', 'repository-file', 'implementation'].includes(sourceType)) return 3;
  if (['authoritative-secondary', 'secondary', 'web'].includes(sourceType)) return 2;
  if (['community', 'case'].includes(sourceType)) return 1;
  return null;
}

function declaredIdentity(value) {
  return typeof value === 'string' && DECLARED_IDENTITY.test(value);
}

function identityStatement(sourceId, publisherId, authorId, authorityId) {
  return JSON.stringify({
    source_id: sourceId,
    publisher_id: publisherId,
    author_id: authorId,
    authority_id: authorityId
  });
}

function validIdentityRegistry(registry) {
  if (!(registry instanceof Map) || registry.size === 0) return false;
  return [...registry.entries()].every(([sourceId, binding]) => {
    if (typeof sourceId !== 'string' || sourceId.length === 0 ||
        !exactKeys(binding, IDENTITY_KEYS) || !declaredIdentity(binding.publisher_id) ||
        (binding.author_id !== null && !declaredIdentity(binding.author_id)) ||
        !declaredIdentity(binding.authority_id) || !HASH.test(binding.identity_binding_hash) ||
        !SIGNATURE.test(binding.signature) || !TRUSTED_AUTHORITY_KEYS.has(binding.authority_id)) {
      return false;
    }
    const statement = identityStatement(
      sourceId, binding.publisher_id, binding.author_id, binding.authority_id
    );
    return crypto.createHash('sha256').update(statement).digest('hex') ===
      binding.identity_binding_hash && crypto.verify(
        null,
        Buffer.from(statement),
        TRUSTED_AUTHORITY_KEYS.get(binding.authority_id),
        Buffer.from(binding.signature, 'base64')
      );
  });
}

function deriveIndependenceKey(item, identityRegistry = new Map()) {
  if (!item || typeof item.source_id !== 'string') return null;
  if (['repository', 'repository-file', 'implementation'].includes(item.source_type)) {
    const match = item.source_id.match(
      new RegExp('^(https://[a-z0-9.-]+(?::[0-9]+)?/[^?#]+@[0-9a-f]{40}):[^#]+#[^#]+$')
    );
    return match ? match[1] : null;
  }
  let parsed;
  try {
    parsed = new URL(item.source_id);
  } catch {
    return null;
  }
  if (!validIdentityRegistry(identityRegistry)) return null;
  const binding = identityRegistry.get(item.source_id);
  if (!binding || binding.publisher_id !== item.publisher_id ||
      binding.author_id !== item.author_id ||
      binding.identity_binding_hash !== item.identity_binding_hash) return null;
  if (!declaredIdentity(item.publisher_id)) return null;
  if (['community', 'case'].includes(item.source_type)) {
    return declaredIdentity(item.author_id)
      ? 'publisher:' + item.publisher_id + ':author:' + item.author_id
      : null;
  }
  return item.author_id === null ? 'publisher:' + item.publisher_id : null;
}

function canonicalIdentityKnown(item, identityRegistry = new Map()) {
  if (!item || typeof item.source_id !== 'string' ||
      typeof item.independence_key !== 'string') return false;
  if (['', 'unknown', 'unresolved'].includes(item.source_id) ||
      ['', 'unknown', 'unresolved'].includes(item.independence_key)) return false;
  if (['repository', 'repository-file', 'implementation'].includes(item.source_type)) {
    const repositoryIdentity = new RegExp('^https://[a-z0-9.-]+(?::[0-9]+)?/[^?#]+@[0-9a-f]{40}:[^#]+#[^#]+$');
    const repositoryIndependence = new RegExp('^https://[a-z0-9.-]+(?::[0-9]+)?/[^?#]+@[0-9a-f]{40}$');
    return item.publisher_id === null && item.author_id === null &&
      item.identity_binding_hash === null &&
      repositoryIdentity.test(item.source_id) &&
      repositoryIndependence.test(item.independence_key) &&
      deriveIndependenceKey(item, identityRegistry) === item.independence_key;
  }
  let parsed;
  try {
    parsed = new URL(item.source_id);
  } catch {
    return false;
  }
  const tracking = [...parsed.searchParams.keys()].some((key) =>
    key.toLowerCase().startsWith('utm_') || ['fbclid', 'gclid'].includes(key.toLowerCase())
  );
  return parsed.protocol === 'https:' && parsed.hash === '' && !tracking &&
    item.source_id === parsed.toString() &&
    deriveIndependenceKey(item, identityRegistry) === item.independence_key;
}

function validateEvidence(item, identityRegistry = new Map()) {
  const expected = expectedWeight(item && item.source_type);
  return exactKeys(item, EVIDENCE_KEYS) && expected !== null && item.weight === expected &&
    ['supports', 'refutes'].includes(item.relation) &&
    typeof item.agent_role === 'string' && item.agent_role.length > 0 &&
    typeof item.content_hash === 'string' && item.content_hash.length > 0 &&
    typeof item.locator === 'string' && item.locator.length > 0 &&
    (item.publisher_id === null || declaredIdentity(item.publisher_id)) &&
    (item.author_id === null || declaredIdentity(item.author_id)) &&
    (item.identity_binding_hash === null || HASH.test(item.identity_binding_hash)) &&
    typeof item.source_id === 'string' && item.source_id.length > 0 &&
    typeof item.independence_key === 'string' && item.independence_key.length > 0 &&
    HASH.test(item.content_hash) &&
    canonicalIdentityKnown(item, identityRegistry);
}

function validateClaim(claim, identityRegistry = new Map()) {
  return exactKeys(claim, CLAIM_KEYS) && typeof claim.claim_id === 'string' &&
    claim.claim_id.length > 0 && typeof claim.claim === 'string' && claim.claim.length > 0 &&
    typeof claim.confidence === 'number' && claim.confidence >= 0 && claim.confidence <= 1 &&
    typeof claim.critical === 'boolean' && typeof claim.status === 'string' &&
    claim.status.length > 0 && Array.isArray(claim.evidence) &&
    claim.evidence.every((item) =>
      validateEvidence(item, identityRegistry));
}

function deduplicate(evidence, identityRegistry = new Map()) {
  assert.ok(Array.isArray(evidence) &&
    evidence.every((item) => validateEvidence(item, identityRegistry)),
    'evidence must satisfy the exact schema, canonical identity, and weight');
  const exact = new Map();
  for (const item of evidence) {
    const key = [item.source_id, item.locator, item.content_hash, item.relation].join('\0');
    if (!exact.has(key) || exact.get(key).weight < item.weight) exact.set(key, item);
  }
  const independent = new Map();
  for (const item of exact.values()) {
    const key = [item.independence_key, item.relation].join('\0');
    if (!independent.has(key) || independent.get(key).weight < item.weight) {
      independent.set(key, item);
    }
  }
  return [...independent.values()];
}

function claimScore(evidence, identityRegistry = new Map()) {
  const unique = deduplicate(evidence, identityRegistry);
  const support = unique.filter((item) => item.relation === 'supports')
    .reduce((sum, item) => sum + item.weight, 0);
  const refute = unique.filter((item) => item.relation === 'refutes')
    .reduce((sum, item) => sum + item.weight, 0);
  return { support, refute, net_score: Math.max(0, support - refute), divergent: refute >= support };
}

function independentSupportCount(evidence, identityRegistry = new Map()) {
  return new Set(deduplicate(evidence, identityRegistry)
    .filter((item) => item.relation === 'supports')
    .map((item) => item.independence_key)).size;
}

function ratio(numerator, denominator, notApplicable = false) {
  assert.ok(Number.isFinite(numerator) && Number.isFinite(denominator) &&
    numerator >= 0 && denominator >= 0 && numerator <= denominator,
  'dimension counts must be finite and bounded');
  if (denominator === 0) return notApplicable ? 100 : 0;
  return 100 * numerator * denominator ** -1;
}

function completeness(mode, dimensions) {
  let weights;
  let threshold;
  if (mode === 'exploratory') {
    weights = WEIGHTS.exploratory;
    threshold = THRESHOLDS.exploratory;
  } else if (mode === 'compliance') {
    weights = WEIGHTS.compliance;
    threshold = THRESHOLDS.compliance;
  } else if (mode === 'decision') {
    weights = WEIGHTS.decision;
    threshold = THRESHOLDS.decision;
  } else {
    throw new Error('research mode is invalid');
  }
  assert.ok(exactKeys(dimensions, DIMENSION_KEYS) &&
    Object.values(dimensions).every((value) =>
      typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100
    ), 'completeness dimensions must use the exact finite 0-100 schema');
  const [diversityWeight, crossWeight, gapWeight, closureWeight] = weights;
  const score = dimensions.diversity * diversityWeight * 0.01 +
    dimensions.cross_verification * crossWeight * 0.01 +
    dimensions.gap_coverage * gapWeight * 0.01 +
    dimensions.question_closure * closureWeight * 0.01;
  return { score, complete: score >= threshold };
}

function nonnegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

function validateBudget(name, actual) {
  if (!exactKeys(actual, ['debate_rounds', 'fetched_sources', 'researchers', 'security', 'validator']) ||
      !nonnegativeInteger(actual.researchers) || !nonnegativeInteger(actual.validator) ||
      !nonnegativeInteger(actual.fetched_sources) || !nonnegativeInteger(actual.debate_rounds) ||
      typeof actual.security !== 'boolean' || actual.debate_rounds > 5) return false;
  if (name === 'low') {
    return actual.researchers <= 1 && actual.validator === 0 && actual.fetched_sources <= 3 &&
      (actual.debate_rounds === 0 || actual.security);
  }
  if (name === 'medium') {
    return actual.researchers <= 3 && actual.validator <= 1 && actual.fetched_sources <= 12;
  }
  if (name === 'high') {
    return actual.researchers <= 3 && actual.validator === 1 && actual.fetched_sources <= 24 &&
      actual.debate_rounds > 0;
  }
  return false;
}

function validTimestamp(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function validateDispatchTrace(traces, peerArtifactHashes, inputBindings) {
  if (!Array.isArray(traces) || traces.length === 0 || !(peerArtifactHashes instanceof Set) ||
      !(inputBindings instanceof Map)) return false;
  const dispatchIds = new Set();
  for (const trace of traces) {
    if (!exactKeys(trace, TRACE_KEYS) || dispatchIds.has(trace.dispatch_id) ||
        typeof trace.dispatch_id !== 'string' || trace.dispatch_id.length === 0 ||
        typeof trace.role !== 'string' || trace.role.length === 0 ||
        !HASH.test(trace.scope_hash) || !HASH.test(trace.prompt_template_hash) ||
        !boundedStrings(trace.input_artifact_hashes, true) ||
        !trace.input_artifact_hashes.every((hash) => HASH.test(hash)) ||
        !validTimestamp(trace.started_at) || !validTimestamp(trace.completed_at) ||
        Date.parse(trace.started_at) >= Date.parse(trace.completed_at) ||
        !nonnegativeInteger(trace.evidence_count)) return false;
    dispatchIds.add(trace.dispatch_id);
  }
  const earliestPeerCompletion = Math.min(...traces.map((trace) => Date.parse(trace.completed_at)));
  return traces.every((trace) => {
    const binding = inputBindings.get(trace.dispatch_id);
    return exactKeys(binding, BINDING_KEYS) && validTimestamp(binding.bound_at) &&
      JSON.stringify(binding.input_artifact_hashes) === JSON.stringify(trace.input_artifact_hashes) &&
      Date.parse(binding.bound_at) <= Date.parse(trace.started_at) &&
      Date.parse(binding.bound_at) < earliestPeerCompletion &&
      Date.parse(trace.started_at) < earliestPeerCompletion &&
      trace.input_artifact_hashes.every((hash) => !peerArtifactHashes.has(hash));
  });
}

module.exports = {
  BUDGETS,
  THRESHOLDS,
  WEIGHTS,
  canonicalIdentityKnown,
  claimScore,
  completeness,
  deduplicate,
  deriveIndependenceKey,
  independentSupportCount,
  ratio,
  validateBudget,
  validateClaim,
  validateDispatchTrace,
  validateEvidence,
  validateResearchPlan,
  validIdentityRegistry
};
