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
    Object.keys(value).sort().join('\0') === [...keys].sort().join('\0');
}

function decision(input) {
  const inputKeys = ['criticalOpen', 'hardFail', 'qualifyingConditions', 'score', 'waveCeiling', 'wavesRun'];
  const conditionKeys = ['concentrationAbove70Percent', 'crossCuttingCriticalGap', 'highRiskDomain'];
  if (!exactKeys(input, inputKeys) || !exactKeys(input.qualifyingConditions, conditionKeys) ||
      !Number.isFinite(input.score) || input.score < 0 || input.score > 100 ||
      !Number.isInteger(input.criticalOpen) || input.criticalOpen < 0 ||
      typeof input.hardFail !== 'boolean' || !Number.isInteger(input.wavesRun) ||
      input.wavesRun < 1 || ![2, 3].includes(input.waveCeiling) ||
      input.wavesRun > input.waveCeiling ||
      typeof input.qualifyingConditions.concentrationAbove70Percent !== 'boolean' ||
      typeof input.qualifyingConditions.crossCuttingCriticalGap !== 'boolean' ||
      typeof input.qualifyingConditions.highRiskDomain !== 'boolean') {
    throw new Error('decision input is invalid');
  }
  const { score, criticalOpen, hardFail, wavesRun, waveCeiling } = input;
  const waveThreeQualified = input.qualifyingConditions.concentrationAbove70Percent ||
    input.qualifyingConditions.crossCuttingCriticalGap || input.qualifyingConditions.highRiskDomain;
  if (wavesRun >= waveCeiling) {
    return score >= 80 && criticalOpen === 0 && !hardFail ? 'complete' : 'inconclusive';
  }
  if (score >= 80 && criticalOpen === 0 && !hardFail) return 'complete';
  if (wavesRun >= 2) {
    return waveCeiling === 3 && waveThreeQualified ? 'continue' : 'inconclusive';
  }
  return 'continue';
}

module.exports = { completeness, decision };
