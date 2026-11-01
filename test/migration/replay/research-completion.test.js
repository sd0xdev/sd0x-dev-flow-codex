'use strict';

const {
  assert,
  fs,
  path,
  test,
  validateCandidateCompletePackEvidence,
  fixtureRoot,
  readJson,
  copyResearchBehaviorTests
} = require('../../helpers/migration-context');

test('historical replay: source audit accepts a durably Completed research-pack candidate transition', (t) => {
  const missingEvidence = fixtureRoot({
    candidateCompletePacks: true,
    completedCandidatePacks: true,
    copyEvidenceRef: false,
    preserveCompletedCandidateOwners: true
  });
  const values = fixtureRoot({
    candidateCompletePacks: true,
    completedCandidatePacks: true,
    copyEvidenceRef: true
  });
  t.after(() => fs.rmSync(missingEvidence.workspace, {
    recursive: true, force: true
  }));
  t.after(() => fs.rmSync(values.workspace, { recursive: true, force: true }));
  copyResearchBehaviorTests(missingEvidence.root);
  assert.throws(() => validateCandidateCompletePackEvidence(
    missingEvidence.root,
    readJson(missingEvidence.root, 'migration/source-disposition.json')
  ), /Evidence ref is missing/);
  const disposition = readJson(values.root, 'migration/source-disposition.json');
  copyResearchBehaviorTests(values.root);
  assert.equal(validateCandidateCompletePackEvidence(values.root, disposition), 12);

  const askPath = path.join(values.root,
    'docs/features/skill-toolkit-migration/requests/2026-07-15-wave2-ask-pack-ready.md');
  fs.writeFileSync(askPath, fs.readFileSync(askPath, 'utf8')
    .replace('Final pack audit', 'Changed final pack audit'));
  assert.throws(() => validateCandidateCompletePackEvidence(values.root, disposition),
    /Current request no longer matches durable completion evidence/);
});
