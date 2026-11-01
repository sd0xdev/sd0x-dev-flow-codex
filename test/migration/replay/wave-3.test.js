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

const { wave3Context } = require('../../helpers/migration-waves');

test('historical replay: Wave 3 delivery overlay follows all eight durable completion records', (t) => {
  const { dispositionPath, units, assertRepositoryWave3State } = wave3Context();
  const values = fixtureRoot({ copyEvidenceRef: true });
  t.after(() => fs.rmSync(values.workspace, { recursive: true, force: true }));
  const evidenceRef = 'refs/sd0x-dev-flow-codex/evidence/v1';
  const closureCheckpoint = '3b437aad7280f2e9737bb8c9658616b762a0388b';
  git(values.root, [
    'merge-base', '--is-ancestor', closureCheckpoint, evidenceRef
  ]);
  git(values.root, ['update-ref', evidenceRef, closureCheckpoint]);
  const closureAudit = auditRequestClosures(values.root, units.map((unit) => ({
    kind: 'request-closure',
    promotion_unit_id: unit.id,
    record_sha256: unit.closure
  })));
  const closures = new Map(closureAudit.selected.map((record) => [
    record.promotion_unit_id, record
  ]));

  const candidate = readJson(values.root, dispositionPath);
  for (const unit of units) {
    for (const row of candidate.skills.filter((entry) =>
      entry.promotion_unit_id === unit.id
    )) {
      row.promotion_request = closures.get(unit.id).request_path;
    }
  }
  for (const request of [
    '2026-07-26-feature-dev-single-primary-repromotion.md',
    '2026-07-26-feature-dev-final-audit-closure.md'
  ]) {
    fs.rmSync(path.join(values.root,
      'docs/features/skill-toolkit-migration/requests', request));
  }
  demoteUnboundCompletedCandidateOwners(values.root, candidate);
  restoreHistoricalCompletionLineage(
    values.root,
    candidate,
    new Set(units.map((unit) => unit.id))
  );
  const wave3Rows = candidate.skills.filter((row) =>
    units.some((unit) => unit.id === row.promotion_unit_id)
  );
  assert.equal(wave3Rows.length, 9);
  assert.deepEqual(wave3Rows.filter((row) =>
    row.promotion_unit_id === 'feature-dev/default'
  ).map((row) => row.source_name).sort(), ['codex-implement', 'feature-dev']);
  assert.equal(wave3Rows.find((row) =>
    row.source_name === 'codex-test-gen').alias_policy, 'mapping-only');
  assert.ok(wave3Rows.every((row) => row.delivery_state === 'candidate'));

  const applyFinalOverlay = (disposition) => {
    for (const unit of units) {
      const rows = disposition.skills.filter((row) =>
        row.promotion_unit_id === unit.id
      );
      assert.ok(rows.length > 0, unit.id);
      for (const row of rows) row.delivery_state = unit.final;
    }
  };
  const premature = structuredClone(candidate);
  applyFinalOverlay(premature);
  writeJson(values.root, dispositionPath, premature);
  assert.throws(() => auditSource({ root: values.root }),
    /Evidence has no completion record for bug-fix\/default/);

  writeJson(values.root, dispositionPath, candidate);
  assert.equal(auditSource({ root: values.root }).ok, true,
    'removing the premature lifecycle overlay must remove the completion failure');
  recordPassingGates(values.root, 'wave3-completion-batch');
  const recordedAfter = Math.max(...[...closures.values()].map((record) =>
    Date.parse(record.recorded_at)
  ));
  for (const [index, unit] of units.entries()) {
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
  recordPassingGates(values.root, 'wave3-post-overlay');
  const finalAudit = assertPostOverlayComplete();
  assert.equal(finalAudit.ok, true);
  assert.equal(finalAudit.durable_completion_units, 8);
  assert.deepEqual(delivered.skills.filter((row) =>
    row.promotion_unit_id === 'feature-dev/default'
  ).map((row) => row.delivery_state), ['promoted', 'promoted']);
  assert.equal(delivered.skills.find((row) =>
    row.source_name === 'codex-test-gen').delivery_state, 'pack-ready');
});
