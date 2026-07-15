'use strict';

const ATTACK_FIELDS = Object.freeze([
  'attack_id', 'target_claim_id', 'novelty_key', 'argument', 'evidence_refs',
  'proposed_by', 'validity'
]);
const SIDE_FIELDS = Object.freeze([
  'attacks', 'concessions', 'evidence_refs', 'new_valid_attack',
  'position_changed', 'position_update', 'unresolved_attack'
]);
const ROUND_FIELDS = Object.freeze(['claude_adapter', 'native_codex']);
const OUTCOME_PRECEDENCE = Object.freeze(['divergent', 'conditional', 'pure', 'pareto']);

function exactKeys(value, fields) {
  return value && typeof value === 'object' && !Array.isArray(value) &&
    JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...fields].sort());
}

function nonempty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateAttack(attack, claimIds, noveltyKeys, attackIds = new Set()) {
  if (!exactKeys(attack, ATTACK_FIELDS) || !nonempty(attack.attack_id) ||
      !nonempty(attack.target_claim_id) || !nonempty(attack.novelty_key) ||
      attackIds.has(attack.attack_id) || noveltyKeys.has(attack.novelty_key) ||
      !claimIds.has(attack.target_claim_id)) return false;
  if (!Array.isArray(attack.evidence_refs) || attack.evidence_refs.length === 0 ||
      new Set(attack.evidence_refs).size !== attack.evidence_refs.length ||
      attack.evidence_refs.some((reference) => !nonempty(reference) || !claimIds.has(reference))) {
    return false;
  }
  const argumentWords = nonempty(attack.argument)
    ? attack.argument.trim().split(new RegExp('\\s+')).filter(Boolean)
    : [];
  if (argumentWords.length < 3 || !attack.argument.includes(attack.target_claim_id) ||
      !['native-codex', 'claude-adapter'].includes(attack.proposed_by) ||
      !['valid', 'invalid', 'unresolved'].includes(attack.validity)) return false;
  attackIds.add(attack.attack_id);
  noveltyKeys.add(attack.novelty_key);
  return true;
}

function validateSide(side, claimIds, noveltyKeys, attackIds) {
  if (!exactKeys(side, SIDE_FIELDS) || !Array.isArray(side.attacks) ||
      !Array.isArray(side.concessions) || !side.concessions.every(nonempty) ||
      !Array.isArray(side.evidence_refs) ||
      side.evidence_refs.some((reference) => !nonempty(reference) || !claimIds.has(reference)) ||
      typeof side.new_valid_attack !== 'boolean' ||
      typeof side.unresolved_attack !== 'boolean' ||
      typeof side.position_changed !== 'boolean' ||
      typeof side.position_update !== 'string' ||
      (side.position_changed && !nonempty(side.position_update))) return false;
  if (!side.attacks.every((attack) => validateAttack(
    attack, claimIds, noveltyKeys, attackIds
  ))) return false;
  const derivedValid = side.attacks.some((attack) => attack.validity === 'valid');
  const derivedUnresolved = side.attacks.some((attack) => attack.validity === 'unresolved');
  return side.new_valid_attack === derivedValid &&
    side.unresolved_attack === derivedUnresolved;
}

function validateRound(round, claimIds, noveltyKeys, attackIds) {
  return exactKeys(round, ROUND_FIELDS) &&
    validateSide(round.native_codex, claimIds, noveltyKeys, attackIds) &&
    validateSide(round.claude_adapter, claimIds, noveltyKeys, attackIds);
}

function transcriptState(rounds, claimIds) {
  if (!Array.isArray(rounds) || rounds.length === 0 || rounds.length > 5) {
    throw new Error('debate requires one to five rounds');
  }
  if (!(claimIds instanceof Set) || claimIds.size === 0) return 'invalid';
  const noveltyKeys = new Set();
  const attackIds = new Set();
  if (!rounds.every((round) => validateRound(round, claimIds, noveltyKeys, attackIds))) {
    return 'invalid';
  }
  const last = rounds.at(-1);
  const equilibrium = [last.native_codex, last.claude_adapter].every((side) =>
    side.new_valid_attack === false && side.unresolved_attack === false
  );
  if (equilibrium) return 'equilibrium';
  return rounds.length === 5 ? 'divergent' : 'continue';
}

function classifyOutcome(facts) {
  if (facts.unresolved || facts.missing_evidence || facts.non_converged) return 'divergent';
  if (facts.condition_dependent) return 'conditional';
  if (facts.unconditional_dominance && facts.full_concession) return 'pure';
  if (facts.quantified_non_dominated_tradeoffs) return 'pareto';
  return 'divergent';
}

module.exports = {
  ATTACK_FIELDS,
  OUTCOME_PRECEDENCE,
  ROUND_FIELDS,
  SIDE_FIELDS,
  classifyOutcome,
  transcriptState,
  validateAttack,
  validateRound
};
