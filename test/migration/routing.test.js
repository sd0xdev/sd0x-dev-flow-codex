'use strict';

const {
  assert,
  fs,
  os,
  path,
  execFileSync,
  spawnSync,
  test,
  assertExistingLiveTargetUnmodified,
  auditCandidate,
  auditCandidateStatic,
  auditSource,
  candidateTree,
  trustedCoreResourceFiles,
  routingContractBlock,
  routingDescription,
  routingTestSource,
  repositoryRoutingRegistry,
  validateRoutingContract,
  commit,
  git,
  initRepository,
  copy,
  fixtureRoot,
  ROOT,
  readJson,
  writeJson,
  childTestEnvironment,
  prepareRow,
  writeRequest,
  writeCandidate
} = require('../helpers/migration-context');

test('behavior tests must equal the trusted per-unit routing harness', (t) => {
  const values = fixtureRoot();
  t.after(() => fs.rmSync(values.workspace, { recursive: true, force: true }));
  prepareRow(values.root, 'architecture');
  const relative = writeCandidate(values.root, {
    target: 'architecture',
    sourceNames: ['architecture'],
    targetPackage: 'planning-pack',
    unit: 'architecture/default'
  });
  const contractPath = path.join(values.root, relative, 'migration-contract.json');
  const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
  const testPath = contract.units[0].behavior_tests[0];
  contract.units[0].behavior_tests = ['test/setup.test.js'];
  fs.writeFileSync(contractPath, `${JSON.stringify(contract, null, 2)}\n`);
  assert.throws(() => auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }),
    /exact generated contract set/);
  contract.units[0].behavior_tests = ['SKILL.md'];
  fs.writeFileSync(contractPath, `${JSON.stringify(contract, null, 2)}\n`);
  assert.throws(() => auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }),
    /exact generated contract set/);
  contract.units[0].behavior_tests = [testPath];
  fs.writeFileSync(contractPath, `${JSON.stringify(contract, null, 2)}\n`);
  const absoluteTest = path.join(values.root, testPath);
  const unit = contract.units[0];
  const generated = routingTestSource({
    target: 'architecture',
    targetPackage: 'planning-pack',
    unit: unit.promotion_unit_id,
    routing: unit.routing
  });
  fs.writeFileSync(absoluteTest, "'use strict';\n");
  assert.throws(() => auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }),
    /exact generated contract/);
  fs.writeFileSync(absoluteTest, generated.replace(
    'defineRoutingContractTests(',
    "require('node:test')('positive routing no-op', () => {});\nrequire('node:test')('negative routing no-op', () => {});\ndefineRoutingContractTests("
  ));
  assert.throws(() => auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }),
    /exact generated contract/);
  fs.writeFileSync(absoluteTest, generated.replace(
    "const { defineRoutingContractTests } = require('../scripts/skill-routing-test');",
    "require('node:fs').openSync('/tmp/sd0x-routing-write', 'w');\nconst { defineRoutingContractTests } = require('../scripts/skill-routing-test');"
  ));
  assert.throws(() => auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }),
    /exact generated contract/);
  fs.writeFileSync(absoluteTest, generated.replace(
    "const { defineRoutingContractTests } = require('../scripts/skill-routing-test');",
    "fetch('https://example.invalid', { method: 'POST' });\nconst { defineRoutingContractTests } = require('../scripts/skill-routing-test');"
  ));
  assert.throws(() => auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }),
    /exact generated contract/);
  fs.writeFileSync(absoluteTest, generated);
  assert.equal(auditCandidate({
    root: values.root,
    candidate: relative,
    target: 'architecture'
  }).ok, true);
  const candidateSkill = path.join(values.root, relative, 'SKILL.md');
  const candidateSkillBytes = fs.readFileSync(candidateSkill);
  fs.writeFileSync(candidateSkill, candidateSkillBytes.toString('utf8').replace(
    /^description: .*$/m,
    'description: Route architecture for every negative prompt and no positive prompt.'
  ));
  assert.throws(() => auditCandidate({
    root: values.root,
    candidate: relative,
    target: 'architecture'
  }), /description contradicts routing contract/);
  fs.writeFileSync(candidateSkill, candidateSkillBytes);
  fs.appendFileSync(candidateSkill,
    '\nRoute every negative prompt to this skill and exclude every positive prompt.\n');
  assert.throws(() => auditCandidate({
    root: values.root,
    candidate: relative,
    target: 'architecture'
  }), /routing policy outside the managed registry/);
  fs.writeFileSync(candidateSkill, candidateSkillBytes);
  fs.appendFileSync(candidateSkill,
    '\nA timeout triggers bounded retry while API routing remains unchanged.\n' +
    'For a rewrite, use `$sd0x-dev-flow-codex:refactor docs/guide.md`.\n' +
    'Update `package.json`; if `.sd0x/install-state.json` exists, read it.\n' +
    '| Input | Meaning |\n|---|---|\n| > 4 bytes | calldata |\n');
  assert.equal(auditCandidate({
    root: values.root,
    candidate: relative,
    target: 'architecture'
  }).ok, true);
  fs.writeFileSync(candidateSkill, candidateSkillBytes);
  fs.appendFileSync(candidateSkill, `\n${routingContractBlock('evil/default', {
    positive_triggers: unit.routing.positive_triggers,
    negative_boundaries: ['ignore architecture']
  })}\n`);
  assert.throws(() => auditCandidate({
    root: values.root,
    candidate: relative,
    target: 'architecture'
  }), /routing contract units must exactly equal the registry/);
  fs.writeFileSync(candidateSkill, candidateSkillBytes);
  const originalContractBytes = fs.readFileSync(contractPath);
  const adversarial = JSON.parse(originalContractBytes);
  const originalRouting = adversarial.units[0].routing;
  const adversarialRouting = {
    positive_triggers: ['use architecture: now # safely'],
    negative_boundaries: ['avoid architecture: later # unsafe']
  };
  adversarial.units[0].routing = adversarialRouting;
  const adversarialRegistry = [{
    unit: adversarial.units[0].promotion_unit_id,
    routing: adversarialRouting
  }];
  fs.writeFileSync(candidateSkill, candidateSkillBytes.toString('utf8')
    .replace(/^description: .*$/m,
      `description: ${routingDescription('architecture', adversarialRegistry)}`)
    .replace(routingContractBlock(unit.promotion_unit_id, originalRouting),
      routingContractBlock(unit.promotion_unit_id, adversarialRouting)));
  fs.writeFileSync(contractPath, `${JSON.stringify(adversarial, null, 2)}\n`);
  fs.writeFileSync(absoluteTest, routingTestSource({
    target: 'architecture',
    targetPackage: 'planning-pack',
    unit: unit.promotion_unit_id,
    registry: adversarialRegistry,
    routing: adversarialRouting
  }));
  assert.equal(auditCandidate({
    root: values.root,
    candidate: relative,
    target: 'architecture'
  }).ok, true);
  const adversarialResult = spawnSync(process.execPath, ['--test', testPath], {
    cwd: values.root,
    encoding: 'utf8',
    env: childTestEnvironment()
  });
  assert.equal(adversarialResult.status, 0, adversarialResult.stderr || adversarialResult.stdout);
  fs.writeFileSync(candidateSkill, candidateSkillBytes);
  fs.writeFileSync(contractPath, originalContractBytes);
  fs.writeFileSync(absoluteTest, generated);
  const result = spawnSync(process.execPath, ['--test', testPath], {
    cwd: values.root,
    encoding: 'utf8',
    env: childTestEnvironment()
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test('repository routing registry prefers candidate and live successors over legacy packs', (t) => {
  const values = fixtureRoot();
  t.after(() => fs.rmSync(values.workspace, { recursive: true, force: true }));
  copy(
    path.join(values.root, 'plugin/sd0x-dev-flow-codex/skills/create-request/migration-contract.json'),
    path.join(values.root, 'migration/packs/planning-pack/create-request/migration-contract.json')
  );
  copy(
    path.join(values.root, 'plugin/sd0x-dev-flow-codex/skills/create-request/migration-contract.json'),
    path.join(values.root, 'migration/candidates/create-request/migration-contract.json')
  );
  const registry = repositoryRoutingRegistry(values.root);
  assert.equal(registry.filter((entry) =>
    entry.unit === 'create-request/default').length, 1);
});

test('repository routing registry rejects duplicate owners inside one delivery tier', (t) => {
  const values = fixtureRoot();
  t.after(() => fs.rmSync(values.workspace, { recursive: true, force: true }));
  copy(
    path.join(values.root, 'plugin/sd0x-dev-flow-codex/skills/create-request/migration-contract.json'),
    path.join(values.root, 'plugin/sd0x-dev-flow-codex/skills/create-request-copy/migration-contract.json')
  );
  assert.throws(() => repositoryRoutingRegistry(values.root),
    /duplicate live owners for create-request\/default/);
});

test('deep research schema-v2 payload and normative specification stay synchronized', () => {
  const techSpec = fs.readFileSync(path.join(
    ROOT, 'docs/features/skill-toolkit-migration/2-tech-spec.md'
  ), 'utf8');
  const evidenceSchema = '{source_id, publisher_id, author_id, identity_binding_hash, independence_key, source_type, agent_role, locator, content_hash, relation, weight}';
  assert.ok(techSpec.includes(evidenceSchema));
  assert.ok(techSpec.includes('trusted registry'));
  assert.ok(techSpec.includes(
    '{publisher_id, author_id, authority_id, identity_binding_hash, signature}'
  ));
  assert.ok(techSpec.includes('pinned `sd0x-host-identity-v1` public key'));
  assert.ok(techSpec.includes('API 不接受 caller trust-root argument'));
  const candidateSkill = path.join(ROOT, 'migration/candidates/deep-research/SKILL.md');
  const packSkill = path.join(ROOT, 'migration/packs/research-pack/deep-research/SKILL.md');
  assert.ok(fs.readFileSync(fs.existsSync(candidateSkill) ? candidateSkill : packSkill, 'utf8')
    .includes(evidenceSchema));
});

test('successful-apply closure recovery guidance stays synchronized', () => {
  const documents = [
    'docs/PROJECT-MIGRATION-GUIDE.md',
    'docs/features/skill-toolkit-migration/2-tech-spec.md',
    'plugin/sd0x-dev-flow-codex/skills/create-request/references/request-format.md'
  ].map((relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8'));
  for (const document of documents) {
    assert.match(document, /exact-success exception/);
    assert.match(document, /operator-inspected hash/);
    assert.match(document, /prior.{0,40}unknown.{0,40}replacement bytes/is);
    assert.match(document, /restart/);
    assert.match(document, /post-rename identity/);
    assert.match(document, /without overwrite|no-overwrite/);
    assert.match(document, /[Ff]inalized pending/);
    assert.match(document, /terminal/);
  }
});

test('trusted routing harness rejects candidate and pack symlink paths', (t) => {
  const values = fixtureRoot();
  t.after(() => fs.rmSync(values.workspace, { recursive: true, force: true }));
  prepareRow(values.root, 'architecture');
  const relative = writeCandidate(values.root, {
    target: 'architecture',
    sourceNames: ['architecture'],
    targetPackage: 'planning-pack',
    unit: 'architecture/default'
  });
  const testPath = 'test/architecture-default-routing.test.js';
  const run = () => spawnSync(process.execPath, ['--test', testPath], {
    cwd: values.root,
    encoding: 'utf8',
    env: childTestEnvironment()
  });
  const candidate = path.join(values.root, relative);
  const skillPath = path.join(candidate, 'SKILL.md');
  const skill = fs.readFileSync(skillPath);
  const outsideSkill = path.join(values.workspace, 'outside-skill.md');
  fs.writeFileSync(outsideSkill, skill);
  fs.rmSync(skillPath);
  fs.symlinkSync(outsideSkill, skillPath);
  const candidateFile = run();
  assert.notEqual(candidateFile.status, 0, candidateFile.stderr || candidateFile.stdout);
  assert.match(`${candidateFile.stderr}\n${candidateFile.stdout}`, /must not contain symlinks/);
  fs.rmSync(skillPath);
  fs.writeFileSync(skillPath, skill);

  const realCandidate = path.join(values.workspace, 'real-candidate');
  fs.renameSync(candidate, realCandidate);
  fs.symlinkSync(realCandidate, candidate);
  const candidateAncestor = run();
  assert.notEqual(candidateAncestor.status, 0, candidateAncestor.stderr || candidateAncestor.stdout);
  assert.match(`${candidateAncestor.stderr}\n${candidateAncestor.stdout}`, /must not contain symlinks/);
  fs.rmSync(candidate);
  const pack = path.join(values.root, 'migration/packs/planning-pack/architecture');
  fs.rmSync(pack, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(pack), { recursive: true });
  fs.renameSync(realCandidate, pack);

  const packSkill = path.join(pack, 'SKILL.md');
  fs.rmSync(packSkill);
  fs.symlinkSync(outsideSkill, packSkill);
  const packFile = run();
  assert.notEqual(packFile.status, 0, packFile.stderr || packFile.stdout);
  assert.match(`${packFile.stderr}\n${packFile.stdout}`, /must not contain symlinks/);
  fs.rmSync(packSkill);
  fs.writeFileSync(packSkill, skill);

  const packPackage = path.dirname(pack);
  const realPackPackage = path.join(values.workspace, 'real-pack-package');
  fs.renameSync(packPackage, realPackPackage);
  fs.symlinkSync(realPackPackage, packPackage);
  const packAncestor = run();
  assert.notEqual(packAncestor.status, 0, packAncestor.stderr || packAncestor.stdout);
  assert.match(`${packAncestor.stderr}\n${packAncestor.stdout}`, /must not contain symlinks/);
});

test('modeful canonical targets require an explicit selected mode', (t) => {
  const values = fixtureRoot();
  t.after(() => fs.rmSync(values.workspace, { recursive: true, force: true }));
  const liveReview = 'plugin/sd0x-dev-flow-codex/skills/review';
  fs.rmSync(path.join(values.root, liveReview), { recursive: true, force: true });
  git(values.root, ['restore', '--source=HEAD', '--worktree', '--', liveReview]);
  const disposition = readJson(values.root, 'migration/source-disposition.json');
  for (const row of disposition.skills.filter((entry) => entry.target_skill === 'review')) {
    row.delivery_state = 'planned';
    row.promotion_request = null;
  }
  writeJson(values.root, 'migration/source-disposition.json', disposition);
  prepareRow(values.root, 'codex-code-review');
  const relative = writeCandidate(values.root, {
    target: 'review',
    sourceNames: ['codex-code-review'],
    targetPackage: 'core',
    unit: 'review/default'
  });
  assert.throws(() => auditCandidate({ root: values.root, candidate: relative, target: 'review' }),
    /ambiguous across modes/);
  assert.equal(auditCandidate({
    root: values.root,
    candidate: relative,
    target: 'review',
    mode: 'default'
  }).promotion_unit_id, 'review/default');

  prepareRow(values.root, 'codex-cli-review', {
    request: writeRequest(values.root, '2026-07-12-review-deep-fixture.md')
  });
  assert.throws(() => auditCandidate({
    root: values.root,
    candidate: relative,
    target: 'review',
    mode: 'default'
  }), /exactly cover candidate\/promoted target modes/);
  const contractPath = path.join(values.root, relative, 'migration-contract.json');
  const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
  const deepTest = 'test/review-deep-routing.test.js';
  const deepPositive = ['use review deep'];
  const deepNegative = ['do not use review deep'];
  const deepRouting = {
    positive_triggers: deepPositive,
    negative_boundaries: deepNegative
  };
  fs.writeFileSync(path.join(values.root, deepTest), routingTestSource({
    target: 'review',
    targetPackage: 'core',
    unit: 'review/deep',
    routing: deepRouting
  }));
  fs.appendFileSync(path.join(values.root, relative, 'SKILL.md'),
    `\n${routingContractBlock('review/deep', deepRouting)}\n`);
  contract.units.push({
    promotion_unit_id: 'review/deep',
    target_mode: 'deep',
    source_names: ['codex-cli-review'],
    routing: deepRouting,
    behavior_tests: [deepTest]
  });
  contract.units.sort((left, right) => left.promotion_unit_id.localeCompare(right.promotion_unit_id));
  const registry = contract.units.map((entry) => ({
    unit: entry.promotion_unit_id,
    routing: entry.routing
  }));
  for (const entry of contract.units) {
    fs.writeFileSync(path.join(values.root, entry.behavior_tests[0]), routingTestSource({
      target: 'review',
      targetPackage: 'core',
      unit: entry.promotion_unit_id,
      registry,
      routing: entry.routing
    }));
  }
  const skillPath = path.join(values.root, relative, 'SKILL.md');
  fs.writeFileSync(skillPath, fs.readFileSync(skillPath, 'utf8').replace(
    /^description: .*$/m,
    `description: ${routingDescription('review', registry)}`
  ));
  fs.writeFileSync(contractPath, `${JSON.stringify(contract, null, 2)}\n`);
  assert.equal(auditCandidate({
    root: values.root,
    candidate: relative,
    target: 'review',
    mode: 'default'
  }).promotion_unit_id, 'review/default');
  assert.equal(auditCandidate({
    root: values.root,
    candidate: relative,
    target: 'review',
    mode: 'deep'
  }).promotion_unit_id, 'review/deep');
  const routed = spawnSync(process.execPath, [
    '--test',
    'test/review-default-routing.test.js',
    'test/review-deep-routing.test.js'
  ], { cwd: values.root, encoding: 'utf8', env: childTestEnvironment() });
  assert.equal(routed.status, 0, routed.stderr || routed.stdout);
  const collisionSkill = (candidateRegistry) => [
    '---',
    'name: review',
    `description: ${routingDescription('review', candidateRegistry)}`,
    '---',
    '',
    ...candidateRegistry.map((entry) => routingContractBlock(entry.unit, entry.routing)),
    ''
  ].join('\n');
  const duplicatePositive = structuredClone(registry);
  duplicatePositive[1].routing.positive_triggers = [
    duplicatePositive[0].routing.positive_triggers[0]
  ];
  assert.throws(() => validateRoutingContract(collisionSkill(duplicatePositive), {
    target: 'review',
    unit: duplicatePositive[0].unit,
    registry: duplicatePositive,
    routing: duplicatePositive[0].routing
  }), /exactly one unit owner/);
  const positiveNegative = structuredClone(registry);
  positiveNegative[1].routing.negative_boundaries = [
    positiveNegative[0].routing.positive_triggers[0]
  ];
  assert.throws(() => validateRoutingContract(collisionSkill(positiveNegative), {
    target: 'review',
    unit: positiveNegative[0].unit,
    registry: positiveNegative,
    routing: positiveNegative[0].routing
  }), /both positive and negative across units/);
});

test('core preflight preserves an existing live bootstrap until exact candidate acceptance', (t) => {
  const values = fixtureRoot();
  t.after(() => fs.rmSync(values.workspace, { recursive: true, force: true }));
  git(values.root, ['add', 'plugin/sd0x-dev-flow-codex/skills/create-request']);
  git(values.root, [
    '-c', 'commit.gpgSign=false', 'commit', '--allow-empty',
    '-m', 'establish approved live bootstrap'
  ], { stdio: 'ignore' });
  prepareRow(values.root, 'create-request');
  const relative = writeCandidate(values.root, {
    target: 'create-request',
    sourceNames: ['create-request'],
    targetPackage: 'core',
    unit: 'create-request/default'
  });
  const accepted = auditCandidate({
    root: values.root,
    candidate: relative,
    target: 'create-request'
  });
  const liveSkill = path.join(values.root,
    'plugin/sd0x-dev-flow-codex/skills/create-request/SKILL.md');
  fs.appendFileSync(liveSkill, '\nchanged before preflight move\n');
  assert.throws(() => auditCandidate({
    root: values.root,
    candidate: relative,
    target: 'create-request'
  }), /existing live target to remain unchanged/);
  git(values.root, ['restore', '--',
    'plugin/sd0x-dev-flow-codex/skills/create-request/SKILL.md']);
  const restored = auditCandidate({
    root: values.root,
    candidate: relative,
    target: 'create-request'
  });
  assert.equal(restored.audit_fingerprint, accepted.audit_fingerprint);
});

test('core preflight permits only byte-identical trusted live resource updates', (t) => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-live-resource-'));
  const root = path.join(workspace, 'repo');
  t.after(() => fs.rmSync(workspace, { recursive: true, force: true }));
  fs.mkdirSync(root, { recursive: true });
  initRepository(root);
  const liveRoot = path.join(
    root, 'plugin', 'sd0x-dev-flow-codex', 'skills', 'setup'
  );
  fs.mkdirSync(path.join(liveRoot, 'scripts'), { recursive: true });
  fs.writeFileSync(path.join(liveRoot, 'SKILL.md'), '# Setup\n');
  fs.writeFileSync(path.join(liveRoot, 'scripts', 'setup.js'), 'old runtime\n');
  git(root, ['add', 'plugin/sd0x-dev-flow-codex/skills/setup']);
  commit(root, 'establish setup live payload');

  const candidateBytes = Buffer.from('new runtime\n');
  fs.writeFileSync(path.join(liveRoot, 'scripts', 'setup.js'), candidateBytes);
  const tree = {
    bytes: new Map([['scripts/setup.js', candidateBytes]])
  };
  const trusted = new Set(['scripts/setup.js']);
  const accepted = assertExistingLiveTargetUnmodified(
    root, 'setup', tree, trusted
  );
  assert.deepEqual([...accepted.keys()], [
    'plugin/sd0x-dev-flow-codex/skills/setup/scripts/setup.js'
  ]);
  const liveTree = candidateTree(
    root, 'plugin/sd0x-dev-flow-codex/skills/setup'
  );
  assert.equal(trustedCoreResourceFiles(root, liveTree, 'setup')
    .has('scripts/setup.js'), false);
  assert.equal(trustedCoreResourceFiles(root, liveTree, 'setup', {
    allowMoveWindowRuntime: true
  }).has('scripts/setup.js'), true);
  const unregisteredTree = {
    relative: 'plugin/sd0x-dev-flow-codex/skills/setup',
    files: ['scripts/unregistered.js'],
    bytes: new Map([['scripts/unregistered.js', Buffer.from('unregistered\n')]])
  };
  assert.equal(trustedCoreResourceFiles(root, unregisteredTree, 'setup', {
    allowMoveWindowRuntime: true
  }).size, 0);

  fs.appendFileSync(path.join(liveRoot, 'SKILL.md'), 'changed instructions\n');
  assert.throws(() => assertExistingLiveTargetUnmodified(
    root, 'setup', tree, trusted
  ), /existing live target to remain unchanged/);
  git(root, ['restore', '--',
    'plugin/sd0x-dev-flow-codex/skills/setup/SKILL.md']);

  fs.writeFileSync(path.join(liveRoot, 'scripts', 'setup.js'), 'different runtime\n');
  assert.throws(() => assertExistingLiveTargetUnmodified(
    root, 'setup', tree, trusted
  ), /must exactly match candidate bytes/);
});

test('candidate scripts allow only direct require.main entrypoint reads', (t) => {
  const values = fixtureRoot();
  t.after(() => fs.rmSync(values.workspace, { recursive: true, force: true }));
  prepareRow(values.root, 'architecture');
  const relative = writeCandidate(values.root, {
    target: 'architecture',
    sourceNames: ['architecture'],
    targetPackage: 'planning-pack',
    unit: 'architecture/default'
  });
  const directory = path.join(values.root, relative);
  fs.appendFileSync(path.join(directory, 'SKILL.md'), '\nRead `scripts/main.cjs`.\n');
  fs.mkdirSync(path.join(directory, 'scripts'));
  const scriptPath = path.join(directory, 'scripts', 'main.cjs');
  fs.writeFileSync(scriptPath, 'if (require.main === module) {}\n');
  assert.equal(auditCandidate({
    root: values.root, candidate: relative, target: 'architecture'
  }).ok, true);
  fs.writeFileSync(scriptPath, 'if (module === require.main) {}\n');
  assert.equal(auditCandidate({
    root: values.root, candidate: relative, target: 'architecture'
  }).ok, true);
  for (const code of [
    'const loader = require; if (loader.main === module) {}\n',
    "if (require['main'] === module) {}\n",
    'require.main = module;\n',
    'require.main += module;\n',
    'require.main++;\n',
    '++require.main;\n',
    'delete require.main;\n',
    '[require.main] = [module];\n',
    '({ x: require.main } = value);\n',
    'for (require.main of values) {}\n'
  ]) {
    fs.writeFileSync(scriptPath, code);
    assert.throws(() => auditCandidate({
      root: values.root, candidate: relative, target: 'architecture'
    }), /aliased, computed, or commented require|dynamic computed member access|direct strict entrypoint comparison/);
  }
});

test('Git branch classifier allows reads and closes mutating forms', (t) => {
  const auditCandidate = auditCandidateStatic;
  const values = fixtureRoot();
  t.after(() => fs.rmSync(values.workspace, { recursive: true, force: true }));
  prepareRow(values.root, 'architecture');
  const relative = writeCandidate(values.root, {
    target: 'architecture',
    sourceNames: ['architecture'],
    targetPackage: 'planning-pack',
    unit: 'architecture/default'
  });
  const directory = path.join(values.root, relative);
  const skillPath = path.join(directory, 'SKILL.md');
  const originalSkill = fs.readFileSync(skillPath, 'utf8');
  fs.writeFileSync(skillPath, `${originalSkill}\nRead \`scripts/branch.js\`.\n`);
  fs.mkdirSync(path.join(directory, 'scripts'));
  const scriptPath = path.join(directory, 'scripts', 'branch.js');
  const script = (args) => [
    "const { execFileSync } = require('node:child_process');",
    `execFileSync('git', ${JSON.stringify(args)});`,
    ''
  ].join('\n');
  fs.writeFileSync(scriptPath, [
    "const { execFileSync } = require('node:child_process');",
    "execFileSync('git', ['branch', '--show-current']);",
    "execFileSync('git', ['branch', '--list']);",
    ''
  ].join('\n'));
  assert.equal(auditCandidate({
    root: values.root, candidate: relative, target: 'architecture'
  }).ok, true);
  for (const args of [
    ['branch', 'hidden'],
    ['branch', '-m', 'old', 'new'],
    ['branch', '--set-upstream-to', 'origin/main', 'hidden']
  ]) {
    fs.writeFileSync(scriptPath, script(args));
    assert.throws(() => auditCandidate({
      root: values.root, candidate: relative, target: 'architecture'
    }), /undeclared operation: local-write/, args.join(' '));
  }
  for (const args of [
    ['branch', '-d', 'hidden'],
    ['branch', '-D', 'hidden'],
    ['branch', '-f', 'hidden', 'HEAD'],
    ['branch', '-df', 'hidden'],
    ['branch', '-M', 'old', 'new'],
    ['branch', '-Mnew'],
    ['branch', '--delete', 'hidden'],
    ['branch', '--force', 'hidden']
  ]) {
    fs.writeFileSync(scriptPath, script(args));
    assert.throws(() => auditCandidate({
      root: values.root, candidate: relative, target: 'architecture'
    }), /undeclared operation: history-rewrite/, args.join(' '));
  }
  fs.writeFileSync(scriptPath, script(['branch', '--edit-description', 'hidden']));
  assert.throws(() => auditCandidate({
    root: values.root, candidate: relative, target: 'architecture'
  }), /unsupported branch editor invocation/);
  for (const option of ['--del', '--forc', '--edit-descript']) {
    fs.writeFileSync(scriptPath, script(['branch', option, 'hidden']));
    assert.throws(() => auditCandidate({
      root: values.root, candidate: relative, target: 'architecture'
    }), /unsupported or abbreviated branch option/, option);
  }
  fs.rmSync(path.join(directory, 'scripts'), { recursive: true });
  fs.writeFileSync(skillPath, `${originalSkill}\nRun \`git branch --del hidden\`.\n`);
  assert.throws(() => auditCandidate({
    root: values.root, candidate: relative, target: 'architecture'
  }), /unsupported or abbreviated branch option/);
  fs.writeFileSync(skillPath, `${originalSkill}\nRun \`git branch hidden\`.\n`);
  assert.throws(() => auditCandidate({
    root: values.root, candidate: relative, target: 'architecture'
  }), /undeclared operation: local-write/);
});

test('clean Git subprocess environment is canonical and cannot be shadowed', (t) => {
  const auditCandidate = auditCandidateStatic;
  const values = fixtureRoot();
  t.after(() => fs.rmSync(values.workspace, { recursive: true, force: true }));
  prepareRow(values.root, 'architecture');
  const relative = writeCandidate(values.root, {
    target: 'architecture',
    sourceNames: ['architecture'],
    targetPackage: 'planning-pack',
    unit: 'architecture/default'
  });
  const directory = path.join(values.root, relative);
  const skillPath = path.join(directory, 'SKILL.md');
  fs.appendFileSync(skillPath, '\nSee the [Git helper](scripts/git.js).\n');
  fs.mkdirSync(path.join(directory, 'scripts'));
  const scriptPath = path.join(directory, 'scripts', 'git.js');
  const prefix = [
    "const os = require('node:os');",
    "const nodeProcess = require('node:process');",
    "const { execFileSync } = require('node:child_process');",
    "const CLEAN_GIT_ENV = Object.freeze({ GIT_CONFIG_GLOBAL: nodeProcess.platform === 'win32' ? 'NUL' : os.devNull, GIT_CONFIG_NOSYSTEM: '1', GIT_NO_REPLACE_OBJECTS: '1', PATH: nodeProcess.env.PATH });"
  ];
  fs.writeFileSync(scriptPath, [
    ...prefix,
    "execFileSync('git', ['status'], { cwd: root, encoding: 'utf8', env: CLEAN_GIT_ENV, stdio: ['ignore', 'pipe', 'pipe'] });",
    ''
  ].join('\n'));
  assert.equal(auditCandidate({
    root: values.root, candidate: relative, target: 'architecture'
  }).ok, true);
  fs.writeFileSync(scriptPath, [...prefix,
    "const note = \"Use require('node:os') only in the canonical provider declaration.\";",
    "execFileSync('git', ['status'], { cwd: root, encoding: 'utf8', env: CLEAN_GIT_ENV, stdio: ['ignore', 'pipe', 'pipe'] });",
    ''
  ].join('\n'));
  assert.equal(auditCandidate({
    root: values.root, candidate: relative, target: 'architecture'
  }).ok, true);
  fs.writeFileSync(scriptPath, [
    "const { execFileSync } = require('node:child_process');",
    `const declarations = ${JSON.stringify([prefix[0], prefix[1], prefix[3]].join('\n'))};`,
    "execFileSync('git', ['status'], { cwd: root, encoding: 'utf8', env: CLEAN_GIT_ENV, stdio: ['ignore', 'pipe', 'pipe'] });",
    ''
  ].join('\n'));
  assert.throws(() => auditCandidate({
    root: values.root, candidate: relative, target: 'architecture'
  }), /canonical frozen declaration/);
  for (const invalidProviderLayout of [
    [
      "function providers() {",
      prefix[0],
      prefix[1],
      prefix[3],
      "return CLEAN_GIT_ENV;",
      "}",
      prefix[2],
      "execFileSync('git', ['status'], { cwd: root, encoding: 'utf8', env: CLEAN_GIT_ENV, stdio: ['ignore', 'pipe', 'pipe'] });"
    ],
    [
      prefix[3],
      prefix[0],
      prefix[1],
      prefix[2],
      "execFileSync('git', ['status'], { cwd: root, encoding: 'utf8', env: CLEAN_GIT_ENV, stdio: ['ignore', 'pipe', 'pipe'] });"
    ]
  ]) {
    fs.writeFileSync(scriptPath, [...invalidProviderLayout, ''].join('\n'));
    assert.throws(() => auditCandidate({
      root: values.root, candidate: relative, target: 'architecture'
    }), /ordered top-level provider prefix before use/);
  }
  for (const shadow of [
    "function run(CLEAN_GIT_ENV) {\nexecFileSync('git', ['status'], { cwd: root, encoding: 'utf8', env: CLEAN_GIT_ENV, stdio: ['ignore', 'pipe', 'pipe'] });\n}",
    "{\nconst CLEAN_GIT_ENV = Object.freeze({});\nexecFileSync('git', ['status'], { cwd: root, encoding: 'utf8', env: CLEAN_GIT_ENV, stdio: ['ignore', 'pipe', 'pipe'] });\n}",
    "function run(os) { return os.devNull; }\nexecFileSync('git', ['status'], { cwd: root, encoding: 'utf8', env: CLEAN_GIT_ENV, stdio: ['ignore', 'pipe', 'pipe'] });",
    "function run(nodeProcess) { return nodeProcess.env; }\nexecFileSync('git', ['status'], { cwd: root, encoding: 'utf8', env: CLEAN_GIT_ENV, stdio: ['ignore', 'pipe', 'pipe'] });"
  ]) {
    fs.writeFileSync(scriptPath, [...prefix, shadow, ''].join('\n'));
    assert.throws(() => auditCandidate({
      root: values.root, candidate: relative, target: 'architecture'
    }), /cannot be shadowed or aliased|providers cannot be reused/);
  }
  fs.writeFileSync(scriptPath, [...prefix,
    "function run(require) { return require('node:os'); }",
    "execFileSync('git', ['status'], { cwd: root, encoding: 'utf8', env: CLEAN_GIT_ENV, stdio: ['ignore', 'pipe', 'pipe'] });",
    ''
  ].join('\n'));
  assert.throws(() => auditCandidate({
    root: values.root, candidate: relative, target: 'architecture'
  }), /aliased, computed, or commented require|require provider cannot be shadowed/);
  for (const extraImport of [
    "const otherOs = require('node:os');\notherOs.devNull = '/tmp/config';",
    "const otherProcess = require('node:process');\nconsole.log(otherProcess.env.PATH);",
    "import('node:os');"
  ]) {
    fs.writeFileSync(scriptPath, [...prefix, extraImport,
      "execFileSync('git', ['status'], { cwd: root, encoding: 'utf8', env: CLEAN_GIT_ENV, stdio: ['ignore', 'pipe', 'pipe'] });",
      ''
    ].join('\n'));
    assert.throws(() => auditCandidate({
      root: values.root, candidate: relative, target: 'architecture'
    }), /providers must be the sole direct module imports|dynamic code or module loading cannot be audited/);
  }
  fs.writeFileSync(scriptPath, [...prefix,
    "execFileSync('git', ['status'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });",
    ''
  ].join('\n'));
  assert.throws(() => auditCandidate({
    root: values.root, candidate: relative, target: 'architecture'
  }), /dynamic code or module loading cannot be audited/);
  fs.writeFileSync(scriptPath, [...prefix,
    "console.log(nodeProcess.env.PATH);",
    "execFileSync('git', ['status'], { cwd: root, encoding: 'utf8', env: CLEAN_GIT_ENV, stdio: ['ignore', 'pipe', 'pipe'] });",
    ''
  ].join('\n'));
  assert.throws(() => auditCandidate({
    root: values.root, candidate: relative, target: 'architecture'
  }), /providers cannot be reused/);
  fs.writeFileSync(scriptPath, [
    ...prefix,
    "const selectors = { 'GIT_DIR': '.', 'GIT_WORK_TREE': '.' };",
    "execFileSync('git', ['status'], { cwd: root, encoding: 'utf8', env: CLEAN_GIT_ENV, stdio: ['ignore', 'pipe', 'pipe'] });",
    ''
  ].join('\n'));
  assert.throws(() => auditCandidate({
    root: values.root, candidate: relative, target: 'architecture'
  }), /unsupported Git environment configuration/);
});

test('distribution audit rejects a target outside the formal plugin catalog', (t) => {
  const values = fixtureRoot();
  t.after(() => fs.rmSync(values.workspace, { recursive: true, force: true }));
  const directory = path.join(values.root,
    'plugin', 'sd0x-dev-flow-codex', 'skills', 'unapproved-target');
  fs.mkdirSync(directory);
  fs.writeFileSync(path.join(directory, 'SKILL.md'), [
    '---',
    'name: unapproved-target',
    'description: Invalid unapproved live target.',
    '---',
    ''
  ].join('\n'));
  assert.throws(() => auditSource({ root: values.root }),
    /live core skill is outside the approved target catalog/);
});
