'use strict';

const {
  assert,
  fs,
  path,
  test,
  auditActiveCandidates,
  auditSource,
  validateWave1Readiness,
  hashPayloadTree,
  commit,
  git,
  fixtureRoot,
  ROOT,
  completionEvidenceSnapshot,
  readJson,
  writeJson
} = require('../helpers/migration-context');

const { wave3Context, wave4Context } = require('../helpers/migration-waves');

test('Wave 3 delivery overlay follows all eight durable completion records', (t) => {
  const { dispositionPath, units, assertRepositoryWave3State } = wave3Context();
  const repositoryDisposition = readJson(ROOT, dispositionPath);
  const historicalCompletions = new Map(completionEvidenceSnapshot(ROOT)
    .filter((record) => units.some((unit) =>
      unit.id === record.promotion_unit_id
    ))
    .map((record) => [record.promotion_unit_id, record]));
  assert.equal(historicalCompletions.size, units.length,
    'prior Wave 3 completion history must remain durable');
  const currentOwners = new Map(units.map((unit) => [unit.id,
    repositoryDisposition.skills.find((row) =>
      row.promotion_unit_id === unit.id
    )?.promotion_request
  ]));
  const repositoryCompletions = new Map([...historicalCompletions]
    .filter(([unit, record]) => record.request_path === currentOwners.get(unit)));
  const currentCandidates = new Set(repositoryDisposition.skills
    .filter((row) => units.some((unit) => unit.id === row.promotion_unit_id) &&
      row.delivery_state === 'candidate')
    .map((row) => row.promotion_unit_id));
  assert.equal(repositoryCompletions.size, units.length - currentCandidates.size);
  for (const unit of currentCandidates) {
    assert.notEqual(historicalCompletions.get(unit)?.request_path,
      currentOwners.get(unit), `${unit}: replacement owner must supersede old evidence`);
  }
  assertRepositoryWave3State(repositoryDisposition, repositoryCompletions, true);
  // A new revision can legitimately leave every current owner pending. Mutate
  // the current overlay in either direction without requiring a delivered owner.
  const changedUnit = units[0];
  const reverted = structuredClone(repositoryDisposition);
  reverted.skills.find((row) =>
    row.promotion_unit_id === changedUnit.id
  ).delivery_state = repositoryCompletions.has(changedUnit.id)
    ? 'candidate' : 'promoted';
  assert.throws(() => assertRepositoryWave3State(
    reverted, repositoryCompletions, true
  ), new RegExp(`${changedUnit.id.replace('/', '\\/')}:`));
  // Exercise loss of a delivered overlay against immutable historical evidence
  // independently of whichever revision currently owns the live unit.
  const historicalDisposition = structuredClone(repositoryDisposition);
  for (const unit of units) {
    for (const row of historicalDisposition.skills.filter((row) =>
      row.promotion_unit_id === unit.id)) {
      row.delivery_state = historicalCompletions.get(unit.id).kind === 'promotion'
        ? 'promoted' : 'pack-ready';
    }
  }
  assertRepositoryWave3State(historicalDisposition, historicalCompletions, true);
  historicalDisposition.skills.find((row) =>
    row.promotion_unit_id === changedUnit.id).delivery_state = 'candidate';
  assert.throws(() => assertRepositoryWave3State(
    historicalDisposition, historicalCompletions, true
  ), new RegExp(`${changedUnit.id.replace('/', '\\/')}:`));
  const lifecycleSpec = fs.readFileSync(path.join(
    ROOT, 'docs/features/skill-toolkit-migration/2-tech-spec.md'
  ), 'utf8');
  assert.match(lifecycleSpec,
    /<!-- sd0x-delivery-transaction:v1 order=payload-final-gates,completion-evidence,delivered-overlay,post-overlay-gates -->/);
});

test('Wave 4 delivery overlay follows current request lineage across re-promotion', (t) => {
  const { dispositionPath, units, assertWave4State } = wave4Context();
  const repositoryDisposition = readJson(ROOT, dispositionPath);
  const historicalCompletions = new Map(completionEvidenceSnapshot(ROOT)
    .filter((record) => units.some((unit) =>
      unit.id === record.promotion_unit_id
    ))
    .map((record) => [record.promotion_unit_id, record]));
  assert.equal(historicalCompletions.size, units.length,
    'prior Wave 4 completion history must remain durable');
  const currentOwners = new Map(units.map((unit) => [unit.id,
    repositoryDisposition.skills.find((row) =>
      row.promotion_unit_id === unit.id
    )?.promotion_request
  ]));
  const repositoryCompletions = new Map([...historicalCompletions]
    .filter(([unit, record]) => record.request_path === currentOwners.get(unit)));
  const currentCandidates = new Set(repositoryDisposition.skills
    .filter((row) => units.some((unit) => unit.id === row.promotion_unit_id) &&
      row.delivery_state === 'candidate')
    .map((row) => row.promotion_unit_id));
  assert.equal(repositoryCompletions.size, units.length - currentCandidates.size);
  for (const unit of currentCandidates) {
    assert.notEqual(historicalCompletions.get(unit)?.request_path,
      currentOwners.get(unit), `${unit}: replacement owner must supersede old evidence`);
  }
  assertWave4State(repositoryDisposition, repositoryCompletions, true);
});

test('deep-research live payload revision follows replacement-owner lifecycle', () => {
  const disposition = readJson(ROOT, 'migration/source-disposition.json');
  const row = disposition.skills.find((entry) =>
    entry.promotion_unit_id === 'deep-research/default'
  );
  const current = completionEvidenceSnapshot(ROOT).find((record) =>
    record.promotion_unit_id === row.promotion_unit_id
  );
  const live = 'plugin/sd0x-dev-flow-codex/skills/deep-research';
  const candidate = 'migration/candidates/deep-research';

  assert.ok(current);
  if (row.delivery_state === 'candidate') {
    assert.notEqual(current.request_path, row.promotion_request);
    if (fs.existsSync(candidate)) {
      assert.equal(current.payload_tree_sha256, hashPayloadTree(ROOT, live));
      assert.notEqual(hashPayloadTree(ROOT, candidate), current.payload_tree_sha256);
    } else {
      assert.notEqual(current.payload_tree_sha256, hashPayloadTree(ROOT, live));
    }
    assert.match(fs.readFileSync(path.join(ROOT, row.promotion_request), 'utf8'),
      new RegExp(path.basename(current.request_path)
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    return;
  }

  assert.equal(row.delivery_state, 'promoted');
  assert.equal(current.request_path, row.promotion_request);
  assert.equal(current.payload_tree_sha256, hashPayloadTree(ROOT, live));
  assert.match(current.supersedes_record_sha256, /^[0-9a-f]{64}$/);
});

test('Wave 1 readiness is an immutable subject checkpoint, not current delivery evidence', (t) => {
  const values = fixtureRoot({ copyEvidenceRef: true });
  t.after(() => fs.rmSync(values.workspace, { recursive: true, force: true }));
  const disposition = readJson(values.root, 'migration/source-disposition.json');
  assert.deepEqual(validateWave1Readiness(values.root, disposition), { units: 9 });

  const readinessPath = 'migration/evidence/wave1-delivery-readiness.json';
  const readiness = readJson(values.root, readinessPath);
  readiness.units['create-request/default'].payload_tree_sha256 = '0'.repeat(64);
  writeJson(values.root, readinessPath, readiness);
  assert.throws(() => validateWave1Readiness(values.root, disposition),
    /readiness payload differs from reviewed subject/);

  writeJson(values.root, readinessPath,
    readJson(ROOT, 'migration/evidence/wave1-delivery-readiness.json'));
  const payloadPath = 'plugin/sd0x-dev-flow-codex/skills/create-request';
  fs.appendFileSync(path.join(values.root, payloadPath, 'SKILL.md'), '\npost-review drift\n');
  const drifted = readJson(values.root, readinessPath);
  const unit = drifted.units['create-request/default'];
  unit.payload_tree_sha256 = hashPayloadTree(values.root, payloadPath);
  writeJson(values.root, readinessPath, drifted);
  git(values.root, ['add', payloadPath, readinessPath]);
  git(values.root, ['-c', 'commit.gpgSign=false', 'commit', '-m',
    'post-subject payload drift'], { stdio: 'ignore' });
  assert.throws(() => validateWave1Readiness(values.root, disposition),
    /readiness payload differs from reviewed subject/);

  writeJson(values.root, readinessPath,
    readJson(ROOT, 'migration/evidence/wave1-delivery-readiness.json'));
  assert.deepEqual(validateWave1Readiness(values.root, disposition), { units: 9 });
  const active = readJson(values.root, 'migration/source-disposition.json');
  for (const row of active.skills) {
    if (row.promotion_unit_id === 'create-request/default') {
      row.delivery_state = 'planned';
    }
  }
  writeJson(values.root, 'migration/source-disposition.json', active);
  assert.throws(() => auditSource({ root: values.root }),
    /current readiness unit is outside candidate\/delivered evidence/);
  for (const row of active.skills) {
    if (row.promotion_unit_id === 'create-request/default') {
      row.delivery_state = 'candidate';
    }
  }
  writeJson(values.root, 'migration/source-disposition.json', active);
  const currentOwnerRelative = active.skills.find((row) =>
    row.promotion_unit_id === 'create-request/default'
  ).promotion_request;
  const currentOwnerPath = path.join(values.root, currentOwnerRelative);
  const currentOwner = fs.readFileSync(currentOwnerPath, 'utf8');
  fs.writeFileSync(currentOwnerPath, currentOwner
    .replace(/^> \*\*Depends On\*\*:.*\n/m, ''));
  assert.throws(() => auditSource({ root: values.root }),
    /Current request no longer matches durable completion evidence/);
  fs.writeFileSync(currentOwnerPath, currentOwner);
  for (const row of active.skills) {
    if (row.promotion_unit_id === 'create-request/default') {
      row.delivery_state = 'promoted';
    }
  }
  writeJson(values.root, 'migration/source-disposition.json', active);
  assert.throws(() => auditSource({ root: values.root }),
    /Evidence completion mismatch for (?:disposition_row_sha256|payload_tree_sha256|request_path)/);
  const repositoryDisposition = JSON.parse(git(values.root, [
    'show', 'HEAD:migration/source-disposition.json'
  ]).toString());
  const repositoryStateBySource = new Map(repositoryDisposition.skills.map((row) =>
    [row.source_name, row.delivery_state]
  ));
  for (const row of active.skills) {
    if (row.promotion_unit_id !== 'create-request/default') {
      row.delivery_state = repositoryStateBySource.get(row.source_name);
    }
  }
  for (const row of active.skills) {
    if (row.promotion_unit_id === 'create-request/default') {
      row.delivery_state = 'candidate';
    }
  }
  fs.writeFileSync(currentOwnerPath, currentOwner
    .replace('> **Status**: Completed', '> **Status**: Candidate Complete')
    .replace(/^\| Acceptance \| Complete \|.*$/m,
      '| Acceptance | Candidate Complete | Candidate evidence remains pending. |'));
  writeJson(values.root, 'migration/source-disposition.json', active);
  assert.throws(() => auditActiveCandidates({ root: values.root }),
    /Current request no longer matches durable completion evidence/);
});
