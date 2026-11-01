'use strict';

const {
  assert,
  fs,
  path,
  test,
  auditSource,
  auditRequestClosures,
  hashPayloadTree,
  isCurrentPass,
  latestCompletionEvidence,
  recordPromotionEvidence,
  refreshState,
  git,
  fixtureRoot,
  restoreHistoricalCompletionLineage,
  demoteUnboundCompletedCandidateOwners,
  readJson,
  writeJson,
  recordPassingGates
} = require('../../helpers/migration-context');

const { wave4Context } = require('../../helpers/migration-waves');

test('historical replay: Wave 4 delivery overlay follows current request lineage across re-promotion', (t) => {
  const { dispositionPath, units, assertWave4State } = wave4Context();
  const values = fixtureRoot({ copyEvidenceRef: true });
  t.after(() => fs.rmSync(values.workspace, { recursive: true, force: true }));
  const evidenceRef = 'refs/sd0x-dev-flow-codex/evidence/v1';
  const closureCheckpoint = '4113d0190a1d5a1cc3ea69b2b01581e27c940db2';
  const replayUnits = units.filter((unit) =>
    unit.id !== 'test-review/default'
  );

  git(values.root, [
    'merge-base', '--is-ancestor', closureCheckpoint, evidenceRef
  ]);
  git(values.root, ['update-ref', evidenceRef, closureCheckpoint]);
  const closureAudit = auditRequestClosures(values.root, replayUnits.map((unit) => ({
    kind: 'request-closure',
    promotion_unit_id: unit.id,
    record_sha256: unit.closure
  })));
  const closures = new Map(closureAudit.selected.map((record) => [
    record.promotion_unit_id, record
  ]));
  const candidate = readJson(values.root, dispositionPath);
  for (const row of candidate.skills.filter((entry) =>
    entry.target_skill === 'review'
  )) {
    const mode = row.target_mode || 'default';
    row.promotion_request =
      `docs/features/skill-toolkit-migration/requests/` +
      `2026-07-25-wave4-review-${mode}-promotion.md`;
  }
  demoteUnboundCompletedCandidateOwners(values.root, candidate);
  restoreHistoricalCompletionLineage(
    values.root,
    candidate,
    new Set(replayUnits.map((unit) => unit.id))
  );
  for (const mode of ['branch', 'deep', 'default', 'fast', 'full']) {
    for (const request of [
      `2026-07-26-wave4-review-${mode}-runtime-repromotion.md`,
      `2026-07-26-review-${mode}-final-audit-closure.md`
    ]) {
      fs.rmSync(path.join(values.root,
        'docs/features/skill-toolkit-migration/requests', request));
    }
  }
  fs.rmSync(path.join(values.root, 'migration/candidates/review'), {
    recursive: true,
    force: true
  });
  const candidateRows = candidate.skills.filter((row) =>
    replayUnits.some((unit) => unit.id === row.promotion_unit_id)
  );
  assert.equal(candidateRows.length, 16);
  assert.ok(candidateRows.every((row) => row.delivery_state === 'candidate'));
  assertWave4State(candidate, new Map());
  const applyFinalOverlay = (disposition) => {
    for (const unit of replayUnits) {
      for (const row of disposition.skills.filter((entry) =>
        entry.promotion_unit_id === unit.id
      )) {
        row.delivery_state = unit.final;
      }
    }
  };
  const reviewCandidate = path.join(values.root, 'migration/candidates/review');
  const reviewLive = path.join(
    values.root, 'plugin/sd0x-dev-flow-codex/skills/review'
  );
  if (fs.existsSync(reviewCandidate)) {
    fs.cpSync(reviewCandidate, reviewLive, { recursive: true, force: true });
    fs.rmSync(reviewCandidate, { recursive: true });
  }
  const premature = structuredClone(candidate);
  applyFinalOverlay(premature);
  writeJson(values.root, dispositionPath, premature);
  assert.throws(() => auditSource({ root: values.root }),
    /Evidence has no completion record for best-practices\/default/);

  writeJson(values.root, dispositionPath, candidate);
  const candidateAudit = auditSource({ root: values.root });
  assert.equal(candidateAudit.ok, true);
  recordPassingGates(values.root, 'wave4-completion-batch');
  const recordedAfter = Math.max(...[...closures.values()].map((record) =>
    Date.parse(record.recorded_at)
  ));
  for (const [index, unit] of replayUnits.entries()) {
    const rows = candidate.skills.filter((row) =>
      row.promotion_unit_id === unit.id
    );
    const targetPackage = [...new Set(rows.map((row) => row.target_package))];
    assert.equal(targetPackage.length, 1);
    const payload = unit.kind === 'promotion'
      ? `plugin/sd0x-dev-flow-codex/skills/${unit.target}`
      : `migration/packs/${targetPackage[0]}/${unit.target}`;
    recordPromotionEvidence(values.root, {
      kind: unit.kind,
      promotion_unit_id: unit.id,
      request_closure_record_sha256: closures.get(unit.id).record_sha256,
      disposition_row: rows.length === 1 ? rows[0] : rows,
      payload_tree_sha256: hashPayloadTree(values.root, payload),
      reason: null,
      recorded_at: new Date(recordedAfter + (index + 1) * 1000).toISOString(),
      supersedes_record_sha256: null
    });
  }
  const completed = new Map(latestCompletionEvidence(values.root)
    .filter((record) => replayUnits.some((unit) =>
      unit.id === record.promotion_unit_id
    ))
    .map((record) => [record.promotion_unit_id, record]));
  assert.equal(completed.size, replayUnits.length);

  const delivered = structuredClone(candidate);
  applyFinalOverlay(delivered);
  writeJson(values.root, dispositionPath, delivered);
  const assertPostOverlayComplete = () => {
    const state = refreshState(values.root);
    assert.ok(isCurrentPass(state, 'review'),
      'post-overlay review gate must be current');
    assert.ok(isCurrentPass(state, 'verify'),
      'post-overlay verification gate must be current');
    return auditSource({ root: values.root });
  };
  assert.throws(() => assertPostOverlayComplete(),
    /post-overlay review gate must be current/);
  recordPassingGates(values.root, 'wave4-post-overlay');
  const finalAudit = assertPostOverlayComplete();
  assert.equal(finalAudit.ok, true);
  assert.equal(finalAudit.durable_completion_units,
    candidateAudit.durable_completion_units + replayUnits.length);
  assertWave4State(delivered, completed);
});
