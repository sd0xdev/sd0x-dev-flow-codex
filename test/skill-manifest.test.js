'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const {
  buildSnapshot,
  checkSnapshot,
  directoryFiles,
  materialize
} = require('../scripts/generate-skill-manifest');
const {
  ALIAS_CANDIDATES,
  buildDisposition,
  initializeDisposition,
  targetPackage
} = require('../scripts/initialize-skill-disposition');
const { commit, git, initRepository } = require('./helpers/git');

const ROOT = path.resolve(__dirname, '..');
const BYTEWISE = (left, right) => Buffer.from(left).compare(Buffer.from(right));

function hash(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function write(root, relative, contents) {
  const filePath = path.join(root, ...relative.split('/'));
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents);
  return Buffer.from(contents);
}

function fixture() {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-skill-manifest-'));
  const sourceRepo = path.join(workspace, 'source');
  const outputRoot = path.join(workspace, 'target');
  fs.mkdirSync(sourceRepo);
  fs.mkdirSync(outputRoot);
  initRepository(sourceRepo);

  write(sourceRepo, 'LICENSE', 'Fixture MIT license\n');
  write(
    sourceRepo,
    'skills/alpha/SKILL.md',
    '# Alpha\n\nUses @rules/policy.md and scripts/tool.js.\n'
  );
  write(sourceRepo, 'skills/alpha/references/note.md', 'Pinned reference\n');
  write(sourceRepo, 'rules/policy.md', '# Policy\n');
  write(sourceRepo, 'scripts/tool.js', "'use strict';\n");
  git(sourceRepo, ['add', '.']);
  commit(sourceRepo, 'primary source');
  const sourceCommit = git(sourceRepo, ['rev-parse', 'HEAD']).toString().trim();

  const overlayBytes = write(sourceRepo, 'skills/beta/SKILL.md', '# Beta local overlay\n');
  const config = {
    schema_version: 1,
    generator_version: 1,
    repository: 'https://example.test/source.git',
    primary: {
      id: 'fixture-git',
      commit: sourceCommit,
      totals: { skills: 1, skill_files: 2, references: 1, scripts: 0 }
    },
    overlay: {
      id: 'fixture-overlay',
      base_commit: sourceCommit,
      observed_on: '2026-07-10',
      totals: { skills: 1, skill_files: 1, references: 0, scripts: 0 },
      files: [{
        path: 'skills/beta/SKILL.md',
        size: overlayBytes.length,
        sha256: hash(overlayBytes)
      }]
    },
    external_roots: ['rules', 'scripts']
  };
  return { workspace, sourceRepo, outputRoot, config };
}

function trackedInventory() {
  return JSON.parse(fs.readFileSync(
    path.join(ROOT, 'migration', 'source-inventory.generated.json'),
    'utf8'
  ));
}

function trackedDisposition() {
  return JSON.parse(fs.readFileSync(
    path.join(ROOT, 'migration', 'source-disposition.json'),
    'utf8'
  ));
}

function snapshotBytes(root) {
  const staging = path.join(root, 'migration', 'staging');
  return {
    inventory: fs.readFileSync(path.join(root, 'migration', 'source-inventory.generated.json')),
    staging: Object.fromEntries(directoryFiles(staging).map((relative) => [
      relative,
      hash(fs.readFileSync(path.join(staging, ...relative.split('/'))))
    ]))
  };
}

function runNode(script, args, options = {}) {
  return spawnSync(process.execPath, [path.join(ROOT, 'scripts', script), ...args], {
    cwd: options.cwd || ROOT,
    encoding: 'utf8',
    env: options.env || process.env
  });
}

function assertDeliveryPackage(skill) {
  if (skill.delivery_state === 'promoted') {
    assert.equal(skill.target_package, 'core', `${skill.source_name}: promoted requires core`);
  }
  if (skill.delivery_state === 'pack-ready') {
    assert.match(skill.target_package, /-pack$/, `${skill.source_name}: pack-ready requires a pack`);
  }
  if (skill.delivery_state === 'retired') {
    assert.equal(skill.disposition, 'retire', `${skill.source_name}: retired requires retire disposition`);
    assert.equal(skill.target_package, 'retired', `${skill.source_name}: retired requires retired package`);
  }
}

test('tracked composite inventory is complete, lossless, and raw-byte bound', () => {
  const inventory = trackedInventory();
  const disposition = trackedDisposition();
  assert.deepEqual(inventory.totals, {
    skills: 100,
    skill_files: 266,
    references: 139,
    scripts: 25
  });
  assert.deepEqual(inventory.sources.map((source) => source.totals), [
    { skills: 98, skill_files: 263, references: 138, scripts: 25 },
    { skills: 2, skill_files: 3, references: 1, scripts: 0 }
  ]);
  assert.equal(inventory.skills.length, 100);
  assert.equal(disposition.skills.length, 100);

  const inventoryNames = inventory.skills.map((skill) => skill.source_name);
  const dispositionNames = disposition.skills.map((skill) => skill.source_name);
  assert.deepEqual(inventoryNames, [...inventoryNames].sort(BYTEWISE));
  assert.deepEqual(dispositionNames, [...dispositionNames].sort(BYTEWISE));
  assert.deepEqual(dispositionNames, inventoryNames);
  assert.equal(new Set(inventoryNames).size, 100);

  const staging = path.join(ROOT, 'migration', 'staging');
  const payloadFiles = inventory.skills.flatMap((skill) => skill.source_files);
  assert.equal(payloadFiles.length, 266);
  for (const file of payloadFiles) {
    const staged = path.join(staging, ...file.path.replace(/^skills\//, '').split('/'));
    const bytes = fs.readFileSync(staged);
    assert.equal(bytes.length, file.size, file.path);
    assert.equal(hash(bytes), file.sha256, file.path);
  }

  const primary = inventory.sources[0];
  const licenseBytes = fs.readFileSync(path.join(ROOT, primary.license.staged_path));
  assert.equal(licenseBytes.length, primary.license.size);
  assert.equal(hash(licenseBytes), primary.license.sha256);
  assert.ok(disposition.skills.every((skill) => skill.license_status === 'approved'));
  assert.equal(path.resolve(staging).startsWith(path.join(ROOT, 'plugin') + path.sep), false);
});

test('tracked disposition closes package, routing, mode, alias, and rationale fields', () => {
  const disposition = trackedDisposition();
  assert.deepEqual(disposition.compatibility_alias_candidates, ALIAS_CANDIDATES);
  assert.deepEqual(disposition.alias_policy_decision, {
    policy: 'mapping-only',
    codex_version: 'codex-cli 0.144.4',
    evidence: 'migration/alias-capability.json',
    rationale: 'The Codex registry exposes explicit and implicit invocation but no inspectable automatic-candidate exclusion mechanism, so compatibility aliases remain mapping-only.'
  });
  const aliases = new Set(ALIAS_CANDIDATES);
  const dispositions = new Set(['keep', 'port', 'adapt', 'merge', 'optional', 'retire']);
  const deliveryStates = new Set(['planned', 'candidate', 'pack-ready', 'promoted', 'retired']);
  const capabilityValues = new Set(['core', 'git', 'web', 'connector', 'local-cli', 'claude-mcp']);
  const operationValues = new Set([
    'read',
    'local-write',
    'commit',
    'push',
    'pr-write',
    'history-rewrite',
    'connector-write'
  ]);
  const packages = new Set([
    'core',
    'planning-pack',
    'research-pack',
    'development-pack',
    'quality-pack',
    'delivery-pack',
    'docs-ops-pack',
    'domain-pack',
    'retired'
  ]);
  for (const skill of disposition.skills) {
    assert.ok(dispositions.has(skill.disposition), skill.source_name);
    assert.ok(packages.has(skill.target_package), skill.source_name);
    assert.equal(skill.target_package, targetPackage(skill), skill.source_name);
    assert.ok(deliveryStates.has(skill.delivery_state), skill.source_name);
    assert.ok(Number.isInteger(skill.wave) && skill.wave >= 1 && skill.wave <= 7);
    if (skill.target_skill !== null) assert.match(skill.target_skill, /^[a-z0-9][a-z0-9-]*$/);
    if (skill.target_mode !== null) assert.match(skill.target_mode, /^[a-z0-9][a-z0-9-]*$/);
    assert.equal(skill.alias_candidate, aliases.has(skill.source_name), skill.source_name);
    assert.ok(
      skill.alias_candidate
        ? ['mapping-only', 'manual-only'].includes(skill.alias_policy)
        : skill.alias_policy === 'none'
    );
    assert.deepEqual(skill.capabilities, [...new Set(skill.capabilities)].sort(BYTEWISE));
    assert.deepEqual(skill.operations, [...new Set(skill.operations)].sort(BYTEWISE));
    assert.ok(skill.capabilities.every((value) => capabilityValues.has(value)));
    assert.ok(skill.operations.every((value) => operationValues.has(value)));
    assert.ok(['approved', 'blocked', 'unknown'].includes(skill.license_status));
    assert.ok(skill.promotion_request === null || (
      typeof skill.promotion_request === 'string' && skill.promotion_request.length > 0
    ));
    if (['pack-ready', 'promoted'].includes(skill.delivery_state)) {
      assert.ok(skill.capabilities.length > 0, skill.source_name);
      assert.ok(skill.operations.includes('read'), skill.source_name);
      assert.equal(skill.license_status, 'approved', skill.source_name);
      assert.equal(typeof skill.promotion_request, 'string', skill.source_name);
    }
    assertDeliveryPackage(skill);
    assert.match(skill.rationale, /\S/);
    if (skill.disposition === 'retire') {
      assert.equal(skill.target_package, 'retired');
      assert.equal(skill.routing_owner, null);
      assert.equal(skill.promotion_unit_id, `retire/${skill.source_name}`);
    } else {
      assert.equal(skill.routing_owner, skill.target_skill);
      assert.equal(
        skill.promotion_unit_id,
        `${skill.target_skill}/${skill.target_mode || 'default'}`
      );
    }
  }
  const expectedTargets = {};
  for (const skill of disposition.skills) {
    if (!skill.target_mode) continue;
    expectedTargets[skill.target_skill] ||= { modes: [] };
    expectedTargets[skill.target_skill].modes.push(skill.target_mode);
  }
  for (const target of Object.values(expectedTargets)) {
    target.modes = [...new Set(target.modes)].sort(BYTEWISE);
  }
  assert.deepEqual(Object.keys(disposition.canonical_targets),
    Object.keys(disposition.canonical_targets).sort(BYTEWISE));
  assert.deepEqual(disposition.canonical_targets, expectedTargets);
});

test('delivery states reject cross-package promotion and retirement', () => {
  const base = {
    source_name: 'fixture',
    disposition: 'adapt',
    target_package: 'core',
    delivery_state: 'planned'
  };
  assert.doesNotThrow(() => assertDeliveryPackage(base));
  assert.doesNotThrow(() => assertDeliveryPackage({ ...base, delivery_state: 'candidate' }));
  assert.throws(
    () => assertDeliveryPackage({ ...base, delivery_state: 'pack-ready' }),
    /pack-ready requires a pack/
  );
  assert.throws(
    () => assertDeliveryPackage({
      ...base,
      target_package: 'quality-pack',
      delivery_state: 'promoted'
    }),
    /promoted requires core/
  );
  assert.throws(
    () => assertDeliveryPackage({
      ...base,
      target_package: 'retired',
      delivery_state: 'retired'
    }),
    /retired requires retire disposition/
  );
  assert.doesNotThrow(() => assertDeliveryPackage({
    ...base,
    disposition: 'retire',
    target_package: 'retired',
    delivery_state: 'retired'
  }));
});

test('external dependency catalog is sorted, unique, hashed, and consumer-closed', () => {
  const dependencies = trackedInventory().external_dependencies;
  const paths = dependencies.map((dependency) => dependency.path);
  assert.deepEqual(paths, [...paths].sort(BYTEWISE));
  assert.equal(new Set(paths).size, paths.length);
  assert.ok(dependencies.length > 0);
  for (const dependency of dependencies) {
    assert.ok(['rule', 'root-script', 'template', 'asset', 'other'].includes(dependency.kind));
    assert.match(dependency.sha256, /^[0-9a-f]{64}$/);
    assert.ok(dependency.size > 0);
    assert.ok(dependency.consumers.length > 0);
    assert.deepEqual(dependency.consumers, [...new Set(dependency.consumers)].sort(BYTEWISE));
  }
});

test('generator reads primary payload from Git objects and is byte stable', (t) => {
  const values = fixture();
  t.after(() => fs.rmSync(values.workspace, { recursive: true, force: true }));
  const options = {
    sourceRepo: values.sourceRepo,
    outputRoot: values.outputRoot,
    config: values.config
  };

  const first = buildSnapshot(options);
  materialize(first, values.outputRoot);
  const firstBytes = fs.readFileSync(path.join(
    values.outputRoot,
    'migration',
    'source-inventory.generated.json'
  ));
  const firstStaging = directoryFiles(path.join(values.outputRoot, 'migration', 'staging'));

  write(values.sourceRepo, 'skills/alpha/SKILL.md', 'dirty working-tree replacement\n');
  const second = buildSnapshot(options);
  assert.ok(second.inventoryBytes.equals(first.inventoryBytes));
  materialize(second, values.outputRoot);
  assert.ok(fs.readFileSync(path.join(
    values.outputRoot,
    'migration',
    'source-inventory.generated.json'
  )).equals(firstBytes));
  assert.deepEqual(
    directoryFiles(path.join(values.outputRoot, 'migration', 'staging')),
    firstStaging
  );
  assert.deepEqual(checkSnapshot(second, values.outputRoot), second.inventory);
});

test('Git replacement refs and inherited repository selectors cannot spoof the pinned tree', (t) => {
  const values = fixture();
  t.after(() => fs.rmSync(values.workspace, { recursive: true, force: true }));
  const original = values.config.primary.commit;
  write(values.sourceRepo, 'skills/alpha/SKILL.md', '# Malicious replacement\n');
  git(values.sourceRepo, ['add', 'skills/alpha/SKILL.md']);
  commit(values.sourceRepo, 'same-shape replacement');
  const replacement = git(values.sourceRepo, ['rev-parse', 'HEAD']).toString().trim();
  git(values.sourceRepo, ['checkout', '--detach', original]);
  git(values.sourceRepo, ['replace', original, replacement]);

  const previousGitDir = process.env.GIT_DIR;
  const previousObjectDirectory = process.env.GIT_OBJECT_DIRECTORY;
  process.env.GIT_DIR = path.join(values.workspace, 'bogus-git-dir');
  process.env.GIT_OBJECT_DIRECTORY = path.join(values.workspace, 'bogus-objects');
  t.after(() => {
    if (previousGitDir === undefined) delete process.env.GIT_DIR;
    else process.env.GIT_DIR = previousGitDir;
    if (previousObjectDirectory === undefined) delete process.env.GIT_OBJECT_DIRECTORY;
    else process.env.GIT_OBJECT_DIRECTORY = previousObjectDirectory;
  });

  const snapshot = buildSnapshot({
    sourceRepo: values.sourceRepo,
    outputRoot: values.outputRoot,
    config: values.config
  });
  const alpha = snapshot.stagedFiles.find((file) => file.path === 'alpha/SKILL.md');
  assert.equal(alpha.bytes.toString('utf8'),
    '# Alpha\n\nUses @rules/policy.md and scripts/tool.js.\n');
});

test('materialization rejects symlinked output and overlay ancestors', (t) => {
  const values = fixture();
  t.after(() => fs.rmSync(values.workspace, { recursive: true, force: true }));
  const snapshot = buildSnapshot({
    sourceRepo: values.sourceRepo,
    outputRoot: values.outputRoot,
    config: values.config
  });
  const outside = path.join(values.workspace, 'outside');
  fs.mkdirSync(path.join(outside, 'staging'), { recursive: true });
  const sentinel = path.join(outside, 'staging', 'sentinel.txt');
  fs.writeFileSync(sentinel, 'preserve me\n');
  fs.symlinkSync(outside, path.join(values.outputRoot, 'migration'));
  assert.throws(
    () => materialize(snapshot, values.outputRoot),
    /migration root must be a real directory/
  );
  assert.equal(fs.readFileSync(sentinel, 'utf8'), 'preserve me\n');
  assert.equal(fs.existsSync(path.join(outside, 'source-inventory.generated.json')), false);

  fs.rmSync(path.join(values.outputRoot, 'migration'));
  fs.symlinkSync(path.join(outside, 'missing-migration'), path.join(values.outputRoot, 'migration'));
  assert.throws(
    () => materialize(snapshot, values.outputRoot),
    /migration root must be a real directory/
  );
  assert.equal(fs.existsSync(path.join(outside, 'missing-migration')), false);
  fs.rmSync(path.join(values.outputRoot, 'migration'));
  const overlayDirectory = path.join(values.sourceRepo, 'skills', 'beta');
  const escapedDirectory = path.join(outside, 'beta');
  fs.renameSync(overlayDirectory, escapedDirectory);
  fs.symlinkSync(escapedDirectory, overlayDirectory);
  assert.throws(
    () => buildSnapshot({
      sourceRepo: values.sourceRepo,
      outputRoot: values.outputRoot,
      config: values.config
    }),
    /overlay path must not contain symlinks/
  );
  fs.rmSync(overlayDirectory);
  fs.symlinkSync(path.join(outside, 'missing-beta'), overlayDirectory);
  assert.throws(
    () => buildSnapshot({
      sourceRepo: values.sourceRepo,
      outputRoot: values.outputRoot,
      config: values.config
    }),
    /overlay path must not contain symlinks/
  );
});

test('publication failure restores the prior staging and inventory pair', (t) => {
  const values = fixture();
  t.after(() => fs.rmSync(values.workspace, { recursive: true, force: true }));
  const snapshot = buildSnapshot({
    sourceRepo: values.sourceRepo,
    outputRoot: values.outputRoot,
    config: values.config
  });
  materialize(snapshot, values.outputRoot);
  const before = snapshotBytes(values.outputRoot);

  for (const failureCall of [1, 2, 3, 4]) {
    let calls = 0;
    assert.throws(() => materialize(snapshot, values.outputRoot, {
      renameSync(source, destination) {
        calls += 1;
        if (calls === failureCall) throw new Error(`injected rename ${failureCall}`);
        fs.renameSync(source, destination);
      }
    }), new RegExp(`injected rename ${failureCall}`));
    assert.deepEqual(snapshotBytes(values.outputRoot), before);
  }
});

test('generator blocks overlay drift and leaves the mutable disposition untouched', (t) => {
  const values = fixture();
  t.after(() => fs.rmSync(values.workspace, { recursive: true, force: true }));
  const dispositionPath = path.join(values.outputRoot, 'migration', 'source-disposition.json');
  fs.mkdirSync(path.dirname(dispositionPath), { recursive: true });
  fs.writeFileSync(dispositionPath, '{"user_owned":true}\n');
  const before = fs.readFileSync(dispositionPath);

  const options = {
    sourceRepo: values.sourceRepo,
    outputRoot: values.outputRoot,
    config: values.config
  };
  materialize(buildSnapshot(options), values.outputRoot);
  assert.ok(fs.readFileSync(dispositionPath).equals(before));

  write(values.sourceRepo, 'skills/beta/SKILL.md', '# drifted overlay\n');
  assert.throws(() => buildSnapshot(options), /local overlay (?:size|hash) mismatch/);
  assert.ok(fs.readFileSync(dispositionPath).equals(before));
});

test('disposition initializer parses exactly 100 rows and never overwrites', (t) => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-disposition-'));
  t.after(() => fs.rmSync(workspace, { recursive: true, force: true }));
  const specPath = path.join(
    ROOT,
    'docs',
    'features',
    'skill-toolkit-migration',
    '2-tech-spec.md'
  );
  const markdown = fs.readFileSync(specPath, 'utf8');
  const value = buildDisposition(markdown);
  assert.equal(value.skills.length, 100);
  const outputPath = path.join(workspace, 'source-disposition.json');
  initializeDisposition({ specPath, outputPath });
  const bytes = fs.readFileSync(outputPath);
  assert.deepEqual(JSON.parse(bytes.toString('utf8')), value);
  assert.throws(
    () => initializeDisposition({ specPath, outputPath }),
    /EEXIST/
  );
  assert.ok(fs.readFileSync(outputPath).equals(bytes));
});

test('manifest and disposition CLIs fail closed without partial mutation', (t) => {
  const values = fixture();
  t.after(() => fs.rmSync(values.workspace, { recursive: true, force: true }));
  const configPath = path.join(values.workspace, 'fixture-config.json');
  fs.writeFileSync(configPath, `${JSON.stringify(values.config, null, 2)}\n`);
  const generatorArgs = [
    '--source-repo', values.sourceRepo,
    '--output-root', values.outputRoot,
    '--config', configPath
  ];
  const generated = runNode('generate-skill-manifest.js', generatorArgs);
  assert.equal(generated.status, 0, generated.stderr);
  const before = snapshotBytes(values.outputRoot);

  const escapedSnapshot = path.join(values.workspace, 'escaped-snapshot');
  fs.renameSync(path.join(values.outputRoot, 'migration'), escapedSnapshot);
  fs.symlinkSync(escapedSnapshot, path.join(values.outputRoot, 'migration'));
  const escapedCheck = runNode('generate-skill-manifest.js', [...generatorArgs, '--check']);
  assert.notEqual(escapedCheck.status, 0);
  assert.match(escapedCheck.stderr, /migration root must be a real directory/);
  fs.rmSync(path.join(values.outputRoot, 'migration'));
  fs.renameSync(escapedSnapshot, path.join(values.outputRoot, 'migration'));
  assert.deepEqual(snapshotBytes(values.outputRoot), before);

  assert.notEqual(runNode('generate-skill-manifest.js', ['--source-repo']).status, 0);
  assert.notEqual(runNode('generate-skill-manifest.js', ['--unknown']).status, 0);
  write(values.sourceRepo, 'skills/beta/SKILL.md', '# overlay drift\n');
  const drift = runNode('generate-skill-manifest.js', generatorArgs);
  assert.notEqual(drift.status, 0);
  assert.match(drift.stderr, /local overlay (?:size|hash) mismatch/);
  assert.deepEqual(snapshotBytes(values.outputRoot), before);

  write(values.sourceRepo, 'skills/beta/SKILL.md', '# Beta local overlay\n');
  fs.writeFileSync(path.join(values.outputRoot, 'migration', 'staging', 'alpha', 'SKILL.md'), 'stale\n');
  const stale = runNode('generate-skill-manifest.js', [...generatorArgs, '--check']);
  assert.notEqual(stale.status, 0);
  assert.match(stale.stderr, /differs from the pinned source/);

  write(values.sourceRepo, 'head-drift.txt', 'new commit\n');
  git(values.sourceRepo, ['add', 'head-drift.txt']);
  commit(values.sourceRepo, 'move overlay observation HEAD');
  const beforeHeadFailure = snapshotBytes(values.outputRoot);
  const headDrift = runNode('generate-skill-manifest.js', generatorArgs);
  assert.notEqual(headDrift.status, 0);
  assert.match(headDrift.stderr, /local overlay HEAD mismatch/);
  assert.deepEqual(snapshotBytes(values.outputRoot), beforeHeadFailure);

  const specPath = path.join(
    ROOT,
    'docs',
    'features',
    'skill-toolkit-migration',
    '2-tech-spec.md'
  );
  const dispositionPath = path.join(values.workspace, 'disposition.json');
  const initialized = runNode('initialize-skill-disposition.js', [
    '--tech-spec', specPath,
    '--output', dispositionPath
  ]);
  assert.equal(initialized.status, 0, initialized.stderr);
  const dispositionBytes = fs.readFileSync(dispositionPath);
  const overwrite = runNode('initialize-skill-disposition.js', [
    '--tech-spec', specPath,
    '--output', dispositionPath
  ]);
  assert.notEqual(overwrite.status, 0);
  assert.match(overwrite.stderr, /EEXIST/);
  assert.ok(fs.readFileSync(dispositionPath).equals(dispositionBytes));
  assert.notEqual(runNode('initialize-skill-disposition.js', ['--output']).status, 0);
});

test('repository check includes the sole migration audit owner', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.match(packageJson.scripts.check, /skill-migration-audit\.js audit-source/);
  assert.match(packageJson.scripts['migration:manifest:check'], /--check-tracked/);
});

test('immutable generator has no disposition overlay dependency', () => {
  const source = fs.readFileSync(
    path.join(ROOT, 'scripts', 'generate-skill-manifest.js'),
    'utf8'
  );
  assert.doesNotMatch(source, /source-disposition|initialize-skill-disposition/);
});
