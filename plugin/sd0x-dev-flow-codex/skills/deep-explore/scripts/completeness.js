'use strict';

function completeness(uniqueNewFindings, totalValidFindings, criticalOpen) {
  if (![uniqueNewFindings, totalValidFindings, criticalOpen].every(Number.isInteger) ||
      uniqueNewFindings < 0 || totalValidFindings < 0 || criticalOpen < 0 ||
      uniqueNewFindings > totalValidFindings) {
    throw new Error('completeness inputs are invalid');
  }
  if (totalValidFindings === 0) return 70;
  const noveltyRate = uniqueNewFindings * Math.max(1, totalValidFindings) ** -1;
  return Math.round(100 * (0.7 * (1 - noveltyRate) + 0.3 * (criticalOpen === 0 ? 1 : 0)));
}

function exactKeys(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value) &&
    Object.getOwnPropertySymbols(value).length === 0 &&
    Object.getOwnPropertyNames(value).length === keys.length &&
    Object.keys(value).sort().join('\0') === [...keys].sort().join('\0');
}

// Coverage decisions use explicit questions and evidence references. The numeric
// novelty metric above is diagnostic only and never establishes completion.
function decision(input) {
  const inputKeys = ['questions', 'criticalOpen', 'hardFail', 'budgetExhausted'];
  const questionKeys = ['id', 'status', 'evidence_refs', 'reason'];
  const nonempty = (value) => typeof value === 'string' && value.trim().length > 0;
  if (!exactKeys(input, inputKeys) || !Array.isArray(input.questions) ||
      input.questions.length === 0 || !Number.isSafeInteger(input.criticalOpen) ||
      input.criticalOpen < 0 || typeof input.hardFail !== 'boolean' ||
      typeof input.budgetExhausted !== 'boolean') {
    throw new Error('decision input is invalid');
  }
  const ids = new Set();
  for (const question of input.questions) {
    if (!exactKeys(question, questionKeys) || !nonempty(question.id) || ids.has(question.id) ||
        !['answered', 'unresolved', 'not-applicable'].includes(question.status) ||
        !Array.isArray(question.evidence_refs) || !question.evidence_refs.every(nonempty) ||
        new Set(question.evidence_refs).size !== question.evidence_refs.length ||
        typeof question.reason !== 'string' ||
        (question.status === 'answered' && question.evidence_refs.length === 0) ||
        (question.status === 'not-applicable' && !nonempty(question.reason))) {
      throw new Error('decision question is invalid');
    }
    ids.add(question.id);
  }
  const covered = input.questions.every((question) => question.status !== 'unresolved');
  if (covered && input.criticalOpen === 0 && !input.hardFail) return 'complete';
  return input.budgetExhausted ? 'inconclusive' : 'continue';
}

module.exports = { completeness, decision };
