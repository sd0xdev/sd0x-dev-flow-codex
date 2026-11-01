'use strict';

const {
  assert,
  crypto,
  fs,
  os,
  path,
  spawnSync,
  test,
  auditCandidate,
  auditDeliveredPayload,
  auditSource,
  compareCheckout,
  validateWave1Readiness,
  commit,
  git,
  initRepository,
  fixtureRoot,
  ROOT,
  requestDocumentCount,
  readJson,
  writeJson
} = require('../helpers/migration-context');

test('current repository passes the source, distribution, and request-DAG audit', () => {
  // Exercise CLI serialization and the full repository audit in one invocation.
  // Fixture tests below retain direct API coverage for source mutations.
  const success = spawnSync(process.execPath, [
    path.join(ROOT, 'scripts', 'skill-migration-audit.js'),
    'audit-source'
  ], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(success.status, 0, success.stderr);
  const result = JSON.parse(success.stdout);
  assert.equal(result.ok, true);
  assert.deepEqual(result.totals, {
    skills: 100,
    skill_files: 266,
    references: 139,
    scripts: 25
  });
  assert.equal(result.disposition_rows, 100);
  assert.equal(result.external_dependencies, 36);
  assert.equal(result.requests, requestDocumentCount(ROOT));
  assert.equal(result.alias_policy, 'mapping-only');
  assert.equal(result.alias_codex_version, 'codex-cli 0.161.0');
  assert.equal(result.readiness_units, 9);
});

test('Wave 1 readiness requires the exact reviewed Candidate Complete unit set', (t) => {
  const values = fixtureRoot();
  t.after(() => fs.rmSync(values.workspace, { recursive: true, force: true }));
  const readinessPath = 'migration/evidence/wave1-delivery-readiness.json';
  const disposition = readJson(values.root, 'migration/source-disposition.json');
  const baseline = readJson(values.root, readinessPath);

  const missingUnit = structuredClone(baseline);
  delete missingUnit.units['architecture/default'];
  writeJson(values.root, readinessPath, missingUnit);
  assert.throws(() => validateWave1Readiness(values.root, disposition),
    /unit set differs from reviewed Candidate Complete requests/);

  const substitutedUnit = structuredClone(baseline);
  substitutedUnit.units['substitute/default'] =
    substitutedUnit.units['architecture/default'];
  delete substitutedUnit.units['architecture/default'];
  writeJson(values.root, readinessPath, substitutedUnit);
  assert.throws(() => validateWave1Readiness(values.root, disposition),
    /unit set differs from reviewed Candidate Complete requests/);

  const missingTechSpecMode = structuredClone(baseline);
  delete missingTechSpecMode.units['tech-spec/deep'];
  writeJson(values.root, readinessPath, missingTechSpecMode);
  assert.throws(() => validateWave1Readiness(values.root, disposition),
    /unit set differs from reviewed Candidate Complete requests/);
});

test('Wave 1 readiness derives audit fingerprints from reviewed inputs', (t) => {
  const values = fixtureRoot();
  t.after(() => fs.rmSync(values.workspace, { recursive: true, force: true }));
  const readinessPath = 'migration/evidence/wave1-delivery-readiness.json';
  const dispositionPath = 'migration/source-disposition.json';
  const random = readJson(values.root, readinessPath);
  random.units['create-request/default'].preflight_audit_fingerprint = '1'.repeat(64);
  random.units['create-request/default'].final_audit_fingerprint = '2'.repeat(64);
  writeJson(values.root, readinessPath, random);
  assert.throws(() => validateWave1Readiness(
    values.root, readJson(values.root, dispositionPath)
  ), /readiness audit fingerprints differ from reviewed subject/);

  writeJson(values.root, readinessPath, readJson(ROOT, readinessPath));
  const originalDisposition = readJson(values.root, dispositionPath);
  const promoted = structuredClone(originalDisposition);
  promoted.skills.find((row) => row.source_name === 'create-request').delivery_state =
    'promoted';
  writeJson(values.root, dispositionPath, promoted);
  assert.deepEqual(validateWave1Readiness(values.root, promoted), { units: 9 });

  const packReady = structuredClone(originalDisposition);
  packReady.skills.find((row) => row.source_name === 'architecture').delivery_state =
    'pack-ready';
  writeJson(values.root, dispositionPath, packReady);
  assert.deepEqual(validateWave1Readiness(values.root, packReady), { units: 9 });

  const disposition = structuredClone(originalDisposition);
  disposition.skills.find((row) => row.source_name === 'create-request').delivery_state =
    'promoted';
  const driftedArchitecture = disposition.skills.find((row) =>
    row.source_name === 'architecture'
  );
  driftedArchitecture.rationale += ' reviewed-subject drift';
  writeJson(values.root, dispositionPath, disposition);
  assert.deepEqual(validateWave1Readiness(values.root, disposition), { units: 9 });
});

test('Wave 1 readiness independently binds canonical behavior-test bytes', (t) => {
  const values = fixtureRoot();
  t.after(() => fs.rmSync(values.workspace, { recursive: true, force: true }));
  const readinessPath = 'migration/evidence/wave1-delivery-readiness.json';
  const disposition = readJson(values.root, 'migration/source-disposition.json');
  const behaviorPath = 'test/create-request-default-routing.test.js';
  const alternatePath = 'test/create-request-alternate-routing.test.js';
  fs.copyFileSync(path.join(values.root, behaviorPath), path.join(values.root, alternatePath));
  const alternate = readJson(values.root, readinessPath);
  alternate.units['create-request/default'].behavior_test_path = alternatePath;
  writeJson(values.root, readinessPath, alternate);
  assert.throws(() => validateWave1Readiness(values.root, disposition),
    /readiness behavior test path is invalid/);

  fs.rmSync(path.join(values.root, alternatePath));
  writeJson(values.root, readinessPath, readJson(ROOT, readinessPath));
  fs.appendFileSync(path.join(values.root, behaviorPath), '\n// post-review drift\n');
  const drifted = readJson(values.root, readinessPath);
  drifted.units['create-request/default'].behavior_test_sha256 = crypto
    .createHash('sha256').update(fs.readFileSync(path.join(values.root, behaviorPath)))
    .digest('hex');
  writeJson(values.root, readinessPath, drifted);
  git(values.root, ['add', behaviorPath, readinessPath]);
  git(values.root, ['-c', 'commit.gpgSign=false', 'commit', '-m',
    'post-subject behavior drift'], { stdio: 'ignore' });
  assert.throws(() => validateWave1Readiness(values.root, disposition),
    /readiness behavior test differs from reviewed subject/);
});

test('delivered source payload audit binds traversal and post-ledger bytes', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-delivered-payload-'));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-delivered-outside-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }));
  const relative = 'plugin/sd0x-dev-flow-codex/skills/fixture';
  const directory = path.join(root, relative);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, 'SKILL.md'), '# Fixture\n');
  assert.throws(() => auditDeliveredPayload(root, relative, {
    promotionUnitId: 'fixture/default',
    beforeEvidenceAudit() {
      fs.appendFileSync(path.join(directory, 'SKILL.md'), 'drift\n');
    }
  }), /delivered payload changed during evidence audit/);
  fs.writeFileSync(path.join(directory, 'SKILL.md'), '# Fixture\n');
  let evidenceOid = 'a'.repeat(40);
  assert.throws(() => auditDeliveredPayload(root, relative, {
    currentEvidenceOid: () => evidenceOid,
    afterEvidenceAudit() {
      evidenceOid = 'b'.repeat(40);
    }
  }, () => ({ oid: 'a'.repeat(40) })), /evidence ref changed/);
  fs.writeFileSync(path.join(outside, 'SKILL.md'), '# Outside\n');
  const saved = `${directory}.saved`;
  assert.throws(() => auditDeliveredPayload(root, relative, {
    payloadHooks: {
      beforePayloadTraversal() {
        fs.renameSync(directory, saved);
        fs.symlinkSync(outside, directory);
      }
    }
  }), /payload file identity changed|missing path or symlink/);
  fs.rmSync(directory);
  fs.renameSync(saved, directory);
});

test('source audit rejects staged bytes, disposition, attribution, markers, and discovery drift', (t) => {
  const values = fixtureRoot();
  t.after(() => fs.rmSync(values.workspace, { recursive: true, force: true }));
  const fixtureDisposition = readJson(values.root, 'migration/source-disposition.json');
  assert.equal(fixtureDisposition.skills.some((row) =>
    ['pack-ready', 'promoted', 'retired'].includes(row.delivery_state)), false);
  assert.equal(auditSource({ root: values.root }).ok, true);
  const ignoredStagingAddition = path.join(values.root,
    'migration/staging/concurrent-extra.log');
  const addIgnoredStagingFile = () => fs.writeFileSync(ignoredStagingAddition, 'late\n');
  assert.throws(() => auditSource({
    root: values.root,
    beforeSourceSnapshotRevalidation: addIgnoredStagingFile
  }), /staging manifest changed while auditing/);
  fs.rmSync(ignoredStagingAddition);
  assert.throws(() => auditCandidate({
    root: values.root,
    candidate: 'migration/candidates/architecture',
    target: 'architecture',
    beforeSourceSnapshotRevalidation: addIgnoredStagingFile
  }), /staging manifest changed while auditing/);
  fs.rmSync(ignoredStagingAddition);

  const staged = path.join(values.root, 'migration', 'staging', 'architecture', 'SKILL.md');
  const stagedBytes = fs.readFileSync(staged);
  fs.appendFileSync(staged, 'drift\n');
  assert.throws(() => auditSource({ root: values.root }), /staged raw bytes differ/);
  fs.writeFileSync(staged, stagedBytes);

  const extraStaging = path.join(values.root, 'migration', 'staging', 'EXTRA.txt');
  fs.writeFileSync(extraStaging, 'not inventoried\n');
  assert.throws(() => auditSource({ root: values.root }), /staging file set differs/);
  fs.rmSync(extraStaging);
  const linkedStaging = path.join(values.root, 'migration', 'staging', 'LINKED.txt');
  fs.symlinkSync(path.join(values.root, 'AGENTS.md'), linkedStaging);
  assert.throws(() => auditSource({ root: values.root }), /tree contains symlink/);
  fs.rmSync(linkedStaging);

  const dispositionPath = path.join(values.root, 'migration', 'source-disposition.json');
  const dispositionBytes = fs.readFileSync(dispositionPath);
  const disposition = JSON.parse(dispositionBytes);
  disposition.skills[0].target_package =
    disposition.skills[0].target_package === 'core' ? 'planning-pack' : 'core';
  writeJson(values.root, 'migration/source-disposition.json', disposition);
  assert.throws(() => auditSource({ root: values.root }), /target_package drift/);
  fs.writeFileSync(dispositionPath, dispositionBytes);

  const lateMutationRejects = (mutate) => {
    assert.throws(() => auditSource({
      root: values.root,
      beforeSourceSnapshotRevalidation: mutate
    }), /source snapshot changed while auditing/);
    fs.writeFileSync(dispositionPath, dispositionBytes);
    assert.throws(() => auditCandidate({
      root: values.root,
      candidate: 'migration/candidates/architecture',
      target: 'architecture',
      beforeSourceSnapshotRevalidation: mutate
    }), /source snapshot changed while auditing/);
    fs.writeFileSync(dispositionPath, dispositionBytes);
  };
  lateMutationRejects(() => {
    const lateDisposition = JSON.parse(dispositionBytes);
    lateDisposition.skills[0].delivery_state = 'bogus';
    writeJson(values.root, 'migration/source-disposition.json', lateDisposition);
  });

  const inventoryPath = path.join(values.root, 'migration/source-inventory.generated.json');
  const inventoryBytes = fs.readFileSync(inventoryPath);
  const mutateInventory = () => fs.appendFileSync(inventoryPath, ' ');
  assert.throws(() => auditSource({
    root: values.root,
    beforeSourceSnapshotRevalidation: mutateInventory
  }), /source snapshot changed while auditing/);
  fs.writeFileSync(inventoryPath, inventoryBytes);
  assert.throws(() => auditCandidate({
    root: values.root,
    candidate: 'migration/candidates/architecture',
    target: 'architecture',
    beforeSourceSnapshotRevalidation: mutateInventory
  }), /source snapshot changed while auditing/);
  fs.writeFileSync(inventoryPath, inventoryBytes);

  const architectureRequestPath = path.join(values.root,
    'docs/features/skill-toolkit-migration/requests/2026-07-14-wave1-architecture-pack-ready.md');
  const architectureRequestBytes = fs.readFileSync(architectureRequestPath);
  const mutateArchitectureRequest = () => fs.writeFileSync(
    architectureRequestPath,
    fs.readFileSync(architectureRequestPath, 'utf8').replace(/^> \*\*Status\*\*:.*\n/m, '')
  );
  assert.throws(() => auditSource({
    root: values.root,
    beforeDeliveredEvidenceAudit: mutateArchitectureRequest
  }), /source snapshot changed while auditing/);
  fs.writeFileSync(architectureRequestPath, architectureRequestBytes);
  assert.throws(() => auditCandidate({
    root: values.root,
    candidate: 'migration/candidates/architecture',
    target: 'architecture',
    beforeSourceSnapshotRevalidation: mutateArchitectureRequest
  }), /source snapshot changed while auditing/);
  fs.writeFileSync(architectureRequestPath, architectureRequestBytes);

  const remappedCore = JSON.parse(dispositionBytes);
  const createRequest = remappedCore.skills.find((row) => row.source_name === 'create-request');
  createRequest.target_skill = 'arbitrary-core';
  createRequest.routing_owner = 'arbitrary-core';
  createRequest.promotion_unit_id = 'arbitrary-core/default';
  writeJson(values.root, 'migration/source-disposition.json', remappedCore);
  assert.throws(() => auditSource({ root: values.root }), /approved R1 catalog/);
  fs.writeFileSync(dispositionPath, dispositionBytes);

  const movedWave = JSON.parse(dispositionBytes);
  const architecture = movedWave.skills.find((row) => row.source_name === 'architecture');
  architecture.wave = 2;
  architecture.target_package = 'research-pack';
  writeJson(values.root, 'migration/source-disposition.json', movedWave);
  assert.throws(() => auditSource({ root: values.root }), /approved R1 catalog/);
  fs.writeFileSync(dispositionPath, dispositionBytes);

  const duplicate = JSON.parse(dispositionBytes);
  duplicate.skills[1].source_name = duplicate.skills[0].source_name;
  writeJson(values.root, 'migration/source-disposition.json', duplicate);
  assert.throws(() => auditSource({ root: values.root }), /sorted and unique/);
  fs.writeFileSync(dispositionPath, dispositionBytes);

  const invalidRetire = JSON.parse(dispositionBytes);
  const retired = invalidRetire.skills.find((row) => row.source_name === 'statusline-config');
  if (retired.disposition === 'retire') {
    retired.target_skill = 'statusline-config';
  } else {
    retired.disposition = 'retire';
  }
  writeJson(values.root, 'migration/source-disposition.json', invalidRetire);
  assert.throws(() => auditSource({ root: values.root }),
    /retired row cannot have a target|formal-plugin disposition cannot derive a retired package/);
  fs.writeFileSync(dispositionPath, dispositionBytes);

  const license = path.join(values.root, 'migration', 'staging', 'LICENSE.upstream');
  const licenseBytes = fs.readFileSync(license);
  fs.appendFileSync(license, 'drift\n');
  assert.throws(() => auditSource({ root: values.root }), /license raw bytes differ/);
  fs.writeFileSync(license, licenseBytes);

  const agents = path.join(values.root, 'AGENTS.md');
  const agentsBytes = fs.readFileSync(agents, 'utf8');
  fs.writeFileSync(agents, agentsBytes.replace('sd0x-skill-migration-boundary:v2', 'removed'));
  assert.throws(() => auditSource({ root: values.root }), /AGENTS\.md is missing/);
  fs.writeFileSync(agents, agentsBytes);

  const manifest = readJson(values.root,
    'plugin/sd0x-dev-flow-codex/.codex-plugin/plugin.json');
  manifest.skills = '../../../migration/staging';
  writeJson(values.root, 'plugin/sd0x-dev-flow-codex/.codex-plugin/plugin.json', manifest);
  assert.throws(() => auditSource({ root: values.root }), /skills path must remain/);

  writeJson(values.root, 'plugin/sd0x-dev-flow-codex/.codex-plugin/plugin.json', {
    ...manifest,
    skills: './skills/'
  });
  const unknownLive = path.join(values.root, 'plugin/sd0x-dev-flow-codex/skills/unknown-live');
  fs.mkdirSync(unknownLive);
  fs.writeFileSync(path.join(unknownLive, 'SKILL.md'), [
    '---', 'name: unknown-live', 'description: Unknown live skill.', '---', ''
  ].join('\n'));
  assert.throws(() => auditSource({ root: values.root }), /outside the approved target catalog/);
});

test('fresh-clone fixture normalizes retirement evidence back to planned state', (t) => {
  const values = fixtureRoot({
    deliveryStateOverrides: { 'statusline-config': 'retired' }
  });
  t.after(() => fs.rmSync(values.workspace, { recursive: true, force: true }));
  const disposition = readJson(values.root, 'migration/source-disposition.json');
  const statusline = disposition.skills.find((row) => row.source_name === 'statusline-config');
  assert.equal(statusline.delivery_state, 'planned');
  assert.equal(disposition.skills.some((row) =>
    ['pack-ready', 'promoted', 'retired'].includes(row.delivery_state)), false);
  assert.equal(auditSource({ root: values.root }).ok, true);
});

test('compare mode separates committed primary drift from exact local overlay drift', (t) => {
  const values = fixtureRoot();
  t.after(() => fs.rmSync(values.workspace, { recursive: true, force: true }));
  const checkout = path.join(values.workspace, 'source');
  fs.mkdirSync(checkout);
  initRepository(checkout);
  const inventory = readJson(values.root, 'migration/source-inventory.generated.json');
  for (const skill of inventory.skills.filter((entry) => entry.source_id === 'upstream-git')) {
    for (const file of skill.source_files) {
      const source = path.join(values.root, 'migration', 'staging',
        file.path.replace(/^skills\//, ''));
      const destination = path.join(checkout, file.path);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(source, destination);
    }
  }
  git(checkout, ['add', 'skills']);
  commit(checkout, 'pinned primary tree');
  for (const file of inventory.sources[1].files) {
    const source = path.join(values.root, 'migration', 'staging',
      file.path.replace(/^skills\//, ''));
    const destination = path.join(checkout, file.path);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(source, destination);
  }
  fs.writeFileSync(path.join(checkout, '.gitignore'), 'skills/arbitrary-local/\n');
  fs.mkdirSync(path.join(checkout, 'skills', 'arbitrary-local'));
  fs.writeFileSync(path.join(checkout, 'skills', 'arbitrary-local', 'SKILL.md'), 'ignored\n');

  const clean = compareCheckout(values.root, inventory, checkout);
  assert.deepEqual(clean.primary, { added: [], removed: [], modified: [] });
  assert.deepEqual(clean.local_overlay, { missing: [], mismatched: [] });

  fs.appendFileSync(path.join(checkout, 'skills', 'architecture', 'SKILL.md'), 'dirty only\n');
  const dirty = compareCheckout(values.root, inventory, checkout);
  assert.deepEqual(dirty.primary, clean.primary);
  git(checkout, ['add', 'skills/architecture/SKILL.md']);
  commit(checkout, 'upstream drift');
  fs.appendFileSync(path.join(checkout, 'skills', 'update-readme', 'SKILL.md'), 'overlay drift\n');
  const drift = compareCheckout(values.root, inventory, checkout);
  assert.deepEqual(drift.primary.modified, ['skills/architecture/SKILL.md']);
  assert.deepEqual(drift.local_overlay.mismatched, ['skills/update-readme/SKILL.md']);
  assert.equal(drift.primary.added.includes('skills/arbitrary-local/SKILL.md'), false);
});
