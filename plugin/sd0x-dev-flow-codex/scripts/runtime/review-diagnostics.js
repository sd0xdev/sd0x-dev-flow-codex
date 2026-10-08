'use strict';

const crypto = require('node:crypto');
function findingIdentity(finding) {
  const keys = ['component', 'trigger', 'mechanism', 'obligation'];
  if (!finding || keys.some(key => typeof finding[key] !== 'string' || !finding[key].trim())) {
    throw new Error('Finding diagnosis needs behavioral identity, not just a line number');
  }
  const identity = keys.map(key => finding[key].trim().replace(/\s+/g, ' ').toLowerCase());
  return crypto.createHash('sha256').update(JSON.stringify(identity)).digest('hex');
}
function diagnose(rounds) {
  if (!Array.isArray(rounds)) throw new Error('Expected recorded review rounds');
  const ids = new Set(), findings = new Map();
  for (const round of rounds) {
    if (!round || typeof round.id !== 'string' || !round.id || ids.has(round.id) ||
        !/^[a-f0-9]{64}$/.test(round.fingerprint || '') || !Array.isArray(round.findings)) throw new Error('Invalid or duplicated diagnostic round');
    ids.add(round.id);
    const seen = new Set();
    for (const finding of round.findings) {
      const identity = findingIdentity(finding);
      if (seen.has(identity)) continue;
      seen.add(identity);
      const history = findings.get(identity) || [];
      history.push({ round: round.id, fingerprint: round.fingerprint, evidence: finding.evidence || null });
      findings.set(identity, history);
    }
  }
  return { kind: 'advisory-diagnosis', gate_authority: false,
    repeated: [...findings].filter(([, history]) => history.length > 1).map(([identity, history]) => ({ identity, history,
      subject_changed: new Set(history.map(row => row.fingerprint)).size > 1 })) };
}
module.exports = { findingIdentity, diagnose };
