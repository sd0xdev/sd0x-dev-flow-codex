'use strict';

const {
  assert,
  crypto,
  fs,
  os,
  path,
  test,
  auditCandidate,
  auditSource,
  validateAliasCapability,
  acquireProbeLease,
  buildDump,
  cleanupFixtureSkill,
  installFixtureSkill,
  markerFromJsonl,
  releaseProbeLease,
  runProbe,
  validateInstallation,
  git,
  fixtureRoot,
  ROOT,
  R4_REQUEST,
  readJson,
  writeJson,
  syncAliasOwnerRequest,
  prepareRow,
  writeCandidate
} = require('../helpers/migration-context');

test('migration fixture preserves immutable alias owner bytes and their ancestry', (t) => {
  const values = fixtureRoot();
  t.after(() => fs.rmSync(values.workspace, { recursive: true, force: true }));
  const decision = readJson(ROOT, 'migration/alias-capability.json');
  for (const owner of decision.owner_history) {
    const bytes = fs.readFileSync(path.join(values.root, owner.path));
    assert.deepEqual(bytes, fs.readFileSync(path.join(ROOT, owner.path)));
    const base = bytes.toString().match(
      /^> \*\*Implementation Base SHA\*\*: `([a-f0-9]{40})`$/m
    )[1];
    assert.doesNotThrow(() => git(values.root, ['merge-base', '--is-ancestor', base, 'HEAD']));
  }
  assert.equal(git(values.root, ['rev-parse', 'HEAD^{tree}']).toString(),
    git(values.root, ['rev-parse', '6bbdfbcf1294fb8cacd4efaa712ed3c51dfabc20^{tree}']).toString());
});

test('alias capability evidence locks every compatibility alias to mapping-only', () => {
  const disposition = readJson(ROOT, 'migration/source-disposition.json');
  const result = validateAliasCapability(ROOT, disposition);
  assert.deepEqual(result, {
    decision: 'mapping-only',
    codex_version: 'codex-cli 0.161.0'
  });
  const aliases = disposition.skills.filter((row) => row.alias_candidate);
  assert.equal(aliases.length, disposition.compatibility_alias_candidates.length);
  assert.ok(aliases.every((row) => row.alias_policy === 'mapping-only'));
  const live = new Set(fs.readdirSync(
    path.join(ROOT, 'plugin', 'sd0x-dev-flow-codex', 'skills')
  ));
  assert.ok(aliases.every((row) => !live.has(row.source_name)));
  const dump = readJson(ROOT, 'migration/evidence/alias-registry-dump.json');
  assert.deepEqual(dump.registry_schema.automatic_candidate_exclusion_fields, []);
  assert.equal(dump.observations.negative_prompt_regression.can_upgrade_policy, false);
});

test('R4 completion summary and executable probe evidence stay synchronized', () => {
  const request = fs.readFileSync(path.join(ROOT, R4_REQUEST), 'utf8');
  const techSpec = fs.readFileSync(path.join(ROOT,
    'docs/features/skill-toolkit-migration/2-tech-spec.md'), 'utf8');
  const packageJson = readJson(ROOT, 'package.json');
  const decision = readJson(ROOT, 'migration/alias-capability.json');
  const ownerRequest = fs.readFileSync(path.join(ROOT, decision.owner_request_path), 'utf8');
  const dumpPath = path.join(ROOT, decision.registry_dump_path);
  const dumpBytes = fs.readFileSync(dumpPath);
  const dump = JSON.parse(dumpBytes);

  assert.doesNotMatch(techSpec, /R4[^\n]*等待[^\n]*(?:gate|closure)/i);
  assert.match(techSpec, /R4[^\n]*已完成[^\n]*version-bound `mapping-only`/);
  assert.equal(packageJson.scripts['migration:alias:probe'],
    'node scripts/probe-alias-capability.js --check');
  assert.equal(crypto.createHash('sha256').update(dumpBytes).digest('hex'),
    decision.registry_dump_hash);
  assert.equal(dump.codex_version, decision.codex_version);
  assert.match(ownerRequest, /^> \*\*Status\*\*: (?:Candidate Complete|Completed)$/m);
  assert.doesNotMatch(ownerRequest, /- \[ \]/);
  assert.ok(ownerRequest.includes(`Codex version: \`${decision.codex_version}\``));
  assert.ok(ownerRequest.includes(`Tested at: \`${decision.tested_at}\``));
  assert.ok(ownerRequest.includes(`Alias decision: \`${decision.decision}\``));
  assert.ok(ownerRequest.includes('Registry mechanism: `null`'));
  assert.equal((ownerRequest.match(/sd0x-alias-capability-owner:v1/g) || []).length, 1);
  assert.equal(dump.observations.repository_probe.manual_invocation_marker_observed, true);
  assert.equal(dump.observations.repository_probe.user_or_account_data_retained, false);
  assert.equal(dump.observations.repository_probe.absolute_paths_retained, false);

  if (/^> \*\*Status\*\*: Completed$/m.test(request)) {
    assert.doesNotMatch(request, /- \[ \]/);
    assert.match(request, /Repository-only reload\/new-task procedure/);
  }
});

test('alias probe deterministically reproduces normalized evidence', () => {
  const dump = readJson(ROOT, 'migration/evidence/alias-registry-dump.json');
  const manifestPath = path.join(ROOT,
    'test/fixtures/alias-capability/plugin/.codex-plugin/plugin.json');
  const skillPath = path.join(ROOT,
    'test/fixtures/alias-capability/plugin/skills/r4-alias-probe/SKILL.md');
  const properties = (names) => Object.fromEntries(names.map((name) => [name, {}]));
  const generated = buildDump({
    codexVersion: dump.codex_version,
    fixture: {
      manifestRelative: dump.fixture.manifest_path,
      manifestBytes: fs.readFileSync(manifestPath),
      skillRelative: dump.fixture.skill_path,
      skillBytes: fs.readFileSync(skillPath)
    },
    metadata: { properties: properties(dump.registry_schema.skills_list_metadata_fields) },
    skillInterface: {
      properties: properties(dump.registry_schema.skills_list_interface_fields)
    },
    config: { properties: properties(dump.registry_schema.skills_config_write_fields) },
    skillInput: {
      properties: properties(dump.registry_schema.explicit_invocation_input_fields)
    },
    explicitText: '- r4-alias-probe: $r4-alias-probe',
    neutralText: '- r4-alias-probe:',
    markerObserved: true
  });
  assert.equal(`${JSON.stringify(generated, null, 2)}\n`,
    fs.readFileSync(path.join(ROOT, 'migration/evidence/alias-registry-dump.json'), 'utf8'));
  assert.equal(markerFromJsonl([
    JSON.stringify({
      type: 'item.completed',
      item: { type: 'agent_message', text: 'R4_ALIAS_PROBE_INVOKED' }
    }),
    ''
  ].join('\n')), true);
  assert.equal(markerFromJsonl(JSON.stringify({
    type: 'item.completed',
    item: { type: 'agent_message', text: 'selector resolved only' }
  })), false);
});

test('alias probe orchestration checks fake Codex output and cleanup failures', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-alias-e2e-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const fixtureRoot = path.join(ROOT, 'test', 'fixtures', 'alias-capability', 'plugin');
  const committedDump = path.join(ROOT, 'migration/evidence/alias-registry-dump.json');
  const makeHome = (name) => {
    const home = path.join(root, name);
    fs.mkdirSync(home);
    return home;
  };
  const schemaFields = readJson(ROOT,
    'migration/evidence/alias-registry-dump.json').registry_schema;
  const properties = (names) => Object.fromEntries(names.map((name) => [name, {}]));
  const fakeCodex = (behavior = {}) => (args) => {
    if (behavior.cliFailure && args[0] === behavior.cliFailure) {
      throw new Error('fixture CLI failure');
    }
    if (args[0] === '--version') {
      return `${readJson(ROOT, 'migration/evidence/alias-registry-dump.json').codex_version}\n`;
    }
    if (args[0] === 'app-server') {
      const output = args[args.indexOf('--out') + 1];
      const directory = path.join(output, 'v2');
      fs.mkdirSync(directory, { recursive: true });
      fs.writeFileSync(path.join(directory, 'SkillsListResponse.json'), JSON.stringify({
        definitions: {
          SkillMetadata: {
            properties: properties([
              ...schemaFields.skills_list_metadata_fields,
              ...(behavior.schemaDrift ? ['implicitInvocationDisabled'] : [])
            ])
          },
          SkillInterface: {
            properties: properties(schemaFields.skills_list_interface_fields)
          }
        }
      }));
      fs.writeFileSync(path.join(directory, 'SkillsConfigWriteParams.json'), JSON.stringify({
        properties: properties(schemaFields.skills_config_write_fields)
      }));
      fs.writeFileSync(path.join(directory, 'TurnStartParams.json'), JSON.stringify({
        nested: {
          title: 'SkillUserInput',
          properties: properties(schemaFields.explicit_invocation_input_fields)
        }
      }));
      return '';
    }
    if (args[0] === 'debug') {
      const prompt = args.at(-1);
      const include = prompt === '$r4-alias-probe'
        ? !behavior.missingExplicit
        : !behavior.missingNeutral;
      return JSON.stringify([{ text: `${prompt} ${include ? '- r4-alias-probe:' : ''}` }]);
    }
    if (args[0] === 'exec') {
      return `${JSON.stringify({
        type: 'item.completed',
        item: {
          type: 'agent_message',
          text: behavior.missingMarker ? 'wrong marker' : 'R4_ALIAS_PROBE_INVOKED'
        }
      })}\n`;
    }
    throw new Error(`unexpected fake Codex argv: ${args.join(' ')}`);
  };

  const successHome = makeHome('success-home');
  const success = runProbe({
    home: successHome,
    fixtureRoot,
    committedDump,
    runCodex: fakeCodex(),
    temporaryRoot: root,
    check: true
  });
  assert.equal(success.output, fs.readFileSync(committedDump, 'utf8'));
  assert.equal(fs.existsSync(path.join(successHome, 'skills', 'r4-alias-probe')), false);

  const temporaryFailureHome = makeHome('temporary-failure');
  assert.throws(() => runProbe({
    home: temporaryFailureHome,
    fixtureRoot,
    committedDump,
    runCodex: fakeCodex(),
    makeTemporary() {
      throw new Error('injected mkdtemp failure');
    },
    check: true
  }), /injected mkdtemp failure/);
  assert.equal(fs.existsSync(path.join(
    temporaryFailureHome, '.tmp', 'r4-alias-probe.lock'
  )), false);
  const afterTemporaryFailure = acquireProbeLease(temporaryFailureHome);
  releaseProbeLease(afterTemporaryFailure);

  const ownerFailureHome = makeHome('owner-failure');
  assert.throws(() => runProbe({
    home: ownerFailureHome,
    fixtureRoot,
    committedDump,
    runCodex: fakeCodex(),
    temporaryRoot: root,
    leaseOptions: {
      writeOwner(fd) {
        fs.writeSync(fd, Buffer.from('partial owner'));
        throw new Error('injected owner write failure');
      }
    },
    check: true
  }), /injected owner write failure/);
  assert.equal(fs.existsSync(path.join(
    ownerFailureHome, '.tmp', 'r4-alias-probe.lock'
  )), false);
  const afterOwnerFailure = acquireProbeLease(ownerFailureHome);
  releaseProbeLease(afterOwnerFailure);

  const foreignOwnerHome = makeHome('foreign-owner');
  const foreignOwnerBytes = 'foreign owner must survive\n';
  assert.throws(() => runProbe({
    home: foreignOwnerHome,
    fixtureRoot,
    committedDump,
    runCodex: fakeCodex(),
    temporaryRoot: root,
    leaseOptions: {
      openOwner(ownerPath, flags, mode) {
        fs.writeFileSync(ownerPath, foreignOwnerBytes);
        return fs.openSync(ownerPath, flags, mode);
      }
    },
    check: true
  }), /EEXIST/);
  const foreignOwnerLock = path.join(
    foreignOwnerHome, '.tmp', 'r4-alias-probe.lock'
  );
  assert.equal(fs.readFileSync(path.join(foreignOwnerLock, 'owner'), 'utf8'),
    foreignOwnerBytes);
  fs.rmSync(foreignOwnerLock, { recursive: true });

  const rollbackSwapHome = makeHome('rollback-lock-swap');
  const rollbackLock = path.join(
    rollbackSwapHome, '.tmp', 'r4-alias-probe.lock'
  );
  const displacedRollbackLock = path.join(root, 'displaced-rollback-lock');
  assert.throws(() => runProbe({
    home: rollbackSwapHome,
    fixtureRoot,
    committedDump,
    runCodex: fakeCodex(),
    temporaryRoot: root,
    leaseOptions: {
      writeOwner() {
        fs.renameSync(rollbackLock, displacedRollbackLock);
        fs.mkdirSync(rollbackLock);
        throw new Error('injected lock swap during rollback');
      }
    },
    check: true
  }), /injected lock swap/);
  assert.deepEqual(fs.readdirSync(rollbackLock), []);
  assert.equal(fs.lstatSync(path.join(displacedRollbackLock, 'owner')).isFile(), true);
  fs.rmdirSync(rollbackLock);
  fs.rmSync(displacedRollbackLock, { recursive: true });

  for (const [name, behavior, pattern] of [
    ['missing-marker', { missingMarker: true }, /manual invocation/],
    ['missing-explicit', { missingExplicit: true }, /catalogs/],
    ['missing-neutral', { missingNeutral: true }, /catalogs/],
    ['schema-drift', { schemaDrift: true }, /differs from committed evidence/],
    ['cli-failure', { cliFailure: 'exec' }, /fixture CLI failure/]
  ]) {
    assert.throws(() => runProbe({
      home: makeHome(name),
      fixtureRoot,
      committedDump,
      runCodex: fakeCodex(behavior),
      temporaryRoot: root,
      check: true
    }), pattern);
  }

  const foreignHome = makeHome('foreign-cleanup');
  assert.throws(() => runProbe({
    home: foreignHome,
    fixtureRoot,
    committedDump,
    runCodex: fakeCodex(),
    temporaryRoot: root,
    check: true,
    afterExecution({ installation }) {
      fs.writeFileSync(path.join(installation.directory, 'foreign'), 'preserve me\n');
    }
  }), /cleanup lost ownership/);
  assert.equal(fs.readFileSync(path.join(
    foreignHome, 'skills', 'r4-alias-probe', 'foreign'
  ), 'utf8'), 'preserve me\n');

  const replacementHome = makeHome('replacement-cleanup');
  assert.throws(() => runProbe({
    home: replacementHome,
    fixtureRoot,
    committedDump,
    runCodex: fakeCodex(),
    temporaryRoot: root,
    check: true,
    afterExecution({ installation }) {
      const displaced = path.join(root, 'owned-displaced');
      fs.renameSync(installation.filePath, displaced);
      fs.copyFileSync(displaced, installation.filePath);
    }
  }), /cleanup lost ownership/);
  assert.equal(fs.existsSync(path.join(
    replacementHome, 'skills', 'r4-alias-probe', 'SKILL.md'
  )), true);
});

test('alias probe lease and cleanup preserve concurrently created paths', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-alias-lease-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const home = path.join(root, 'home');
  fs.mkdirSync(home);
  const source = path.join(root, 'SKILL.md');
  fs.writeFileSync(source, 'fixture\n');
  const lease = acquireProbeLease(home);
  assert.throws(() => acquireProbeLease(home), /EEXIST/);
  const installation = installFixtureSkill({
    skillPath: source,
    skillBytes: fs.readFileSync(source)
  }, home, lease);
  assert.equal(validateInstallation(installation), true);
  assert.equal(cleanupFixtureSkill(installation), true);
  assert.equal(fs.existsSync(installation.directory), false);
  releaseProbeLease(lease);

  const foreignHome = path.join(root, 'foreign-home');
  fs.mkdirSync(foreignHome);
  const foreignLease = acquireProbeLease(foreignHome);
  const foreignInstallation = installFixtureSkill({
    skillPath: source,
    skillBytes: fs.readFileSync(source)
  }, foreignHome, foreignLease);
  const foreign = path.join(foreignInstallation.directory, 'foreign');
  fs.writeFileSync(foreign, 'do not delete\n');
  assert.equal(cleanupFixtureSkill(foreignInstallation), false);
  assert.equal(fs.readFileSync(foreign, 'utf8'), 'do not delete\n');
  assert.equal(fs.readFileSync(foreignInstallation.filePath, 'utf8'), 'fixture\n');
  releaseProbeLease(foreignLease);

  const secondHome = path.join(root, 'second-home');
  fs.mkdirSync(secondHome);
  const secondLease = acquireProbeLease(secondHome);
  const changed = installFixtureSkill({
    skillPath: source,
    skillBytes: fs.readFileSync(source)
  }, secondHome, secondLease);
  const displaced = path.join(root, 'displaced-skill');
  assert.equal(cleanupFixtureSkill(changed, {
    beforeQuarantine() {
      fs.renameSync(changed.filePath, displaced);
      fs.copyFileSync(source, changed.filePath);
    }
  }), false);
  assert.equal(fs.readFileSync(changed.filePath, 'utf8'), 'fixture\n');
  assert.equal(fs.readFileSync(displaced, 'utf8'), 'fixture\n');
  releaseProbeLease(secondLease);

  const seededHome = path.join(root, 'seeded-home');
  fs.mkdirSync(seededHome);
  const seededLease = acquireProbeLease(seededHome);
  const seeded = installFixtureSkill({
    skillPath: source,
    skillBytes: fs.readFileSync(source)
  }, seededHome, seededLease);
  fs.mkdirSync(seeded.quarantineContainer);
  const seededForeign = path.join(seeded.quarantineContainer, 'foreign');
  fs.writeFileSync(seededForeign, 'keep quarantine bytes\n');
  assert.throws(() => cleanupFixtureSkill(seeded), /EEXIST/);
  assert.equal(fs.readFileSync(seededForeign, 'utf8'), 'keep quarantine bytes\n');
  fs.rmSync(seeded.quarantineContainer, { recursive: true });
  releaseProbeLease(seededLease);

  const symlinkHome = path.join(root, 'symlink-home');
  const outside = path.join(root, 'outside');
  fs.mkdirSync(symlinkHome);
  fs.mkdirSync(outside);
  fs.symlinkSync(outside, path.join(symlinkHome, 'skills'));
  const symlinkLease = acquireProbeLease(symlinkHome);
  assert.throws(() => installFixtureSkill({
    skillPath: source,
    skillBytes: fs.readFileSync(source)
  }, symlinkHome, symlinkLease), /real directory|symlinks/);
  assert.deepEqual(fs.readdirSync(outside), []);
  releaseProbeLease(symlinkLease);

  const ownerReplacementHome = path.join(root, 'owner-replacement-home');
  fs.mkdirSync(ownerReplacementHome);
  const ownerReplacementLease = acquireProbeLease(ownerReplacementHome);
  const displacedOwner = path.join(root, 'displaced-owner');
  fs.renameSync(ownerReplacementLease.ownerPath, displacedOwner);
  fs.writeFileSync(ownerReplacementLease.ownerPath,
    ownerReplacementLease.ownerBytes, { mode: 0o600 });
  assert.throws(() => releaseProbeLease(ownerReplacementLease),
    /owner identity changed/);
  assert.equal(fs.readFileSync(ownerReplacementLease.ownerPath).equals(
    ownerReplacementLease.ownerBytes), true);
  assert.equal(fs.readFileSync(displacedOwner).equals(
    ownerReplacementLease.ownerBytes), true);
  fs.rmSync(ownerReplacementLease.lockPath, { recursive: true });

  const lockReplacementHome = path.join(root, 'lock-replacement-home');
  fs.mkdirSync(lockReplacementHome);
  const lockReplacementLease = acquireProbeLease(lockReplacementHome);
  const displacedLock = path.join(root, 'displaced-lock');
  fs.renameSync(lockReplacementLease.lockPath, displacedLock);
  fs.mkdirSync(lockReplacementLease.lockPath);
  assert.throws(() => releaseProbeLease(lockReplacementLease),
    /lock directory identity changed/);
  assert.deepEqual(fs.readdirSync(lockReplacementLease.lockPath), []);
  assert.equal(fs.readFileSync(path.join(displacedLock, 'owner')).equals(
    lockReplacementLease.ownerBytes), true);
  fs.rmdirSync(lockReplacementLease.lockPath);
  fs.rmSync(displacedLock, { recursive: true });

  const danglingReleaseHome = path.join(root, 'dangling-release-home');
  fs.mkdirSync(danglingReleaseHome);
  const danglingReleaseLease = acquireProbeLease(danglingReleaseHome);
  assert.throws(() => releaseProbeLease(danglingReleaseLease, {
    afterQuarantine() {
      fs.symlinkSync('missing-lock-target', danglingReleaseLease.lockPath);
    }
  }), /lock path was replaced/);
  assert.equal(fs.lstatSync(danglingReleaseLease.lockPath).isSymbolicLink(), true);
  fs.unlinkSync(danglingReleaseLease.lockPath);

  const danglingFixtureHome = path.join(root, 'dangling-fixture-home');
  fs.mkdirSync(danglingFixtureHome);
  const danglingFixtureLease = acquireProbeLease(danglingFixtureHome);
  const danglingFixture = installFixtureSkill({
    skillPath: source,
    skillBytes: fs.readFileSync(source)
  }, danglingFixtureHome, danglingFixtureLease);
  assert.equal(cleanupFixtureSkill(danglingFixture, {
    afterQuarantine({ payload }) {
      fs.appendFileSync(path.join(payload, 'SKILL.md'), 'foreign change\n');
      fs.symlinkSync('missing-skill-target', danglingFixture.directory);
    }
  }), false);
  assert.equal(fs.lstatSync(danglingFixture.directory).isSymbolicLink(), true);
  assert.match(fs.readFileSync(path.join(
    danglingFixture.quarantineContainer, 'payload', 'SKILL.md'
  ), 'utf8'), /foreign change/);
  fs.unlinkSync(danglingFixture.directory);
  fs.rmSync(danglingFixture.quarantineContainer, { recursive: true });
  releaseProbeLease(danglingFixtureLease);
});

test('alias capability audit rejects missing, tampered, and version-stale evidence', (t) => {
  const values = fixtureRoot();
  t.after(() => fs.rmSync(values.workspace, { recursive: true, force: true }));
  const decisionPath = path.join(values.root, 'migration/alias-capability.json');
  const dumpPath = path.join(values.root, 'migration/evidence/alias-registry-dump.json');
  const fixtureManifestPath = path.join(values.root,
    'test/fixtures/alias-capability/plugin/.codex-plugin/plugin.json');
  const fixtureSkillPath = path.join(values.root,
    'test/fixtures/alias-capability/plugin/skills/r4-alias-probe/SKILL.md');
  const pluginManifestPath = path.join(values.root,
    'plugin/sd0x-dev-flow-codex/.codex-plugin/plugin.json');
  const ownerRequestPath = path.join(values.root,
    readJson(values.root, 'migration/alias-capability.json').owner_request_path);
  const historicalOwnerPath = path.join(values.root,
    'docs/features/skill-toolkit-migration/requests/2026-07-23-alias-capability-codex-0-144-6-refresh.md');
  const dispositionPath = path.join(values.root, 'migration/source-disposition.json');
  const originals = new Map([
    [decisionPath, fs.readFileSync(decisionPath)],
    [dumpPath, fs.readFileSync(dumpPath)],
    [fixtureManifestPath, fs.readFileSync(fixtureManifestPath)],
    [fixtureSkillPath, fs.readFileSync(fixtureSkillPath)],
    [pluginManifestPath, fs.readFileSync(pluginManifestPath)],
    [ownerRequestPath, fs.readFileSync(ownerRequestPath)],
    [historicalOwnerPath, fs.readFileSync(historicalOwnerPath)],
    [dispositionPath, fs.readFileSync(dispositionPath)]
  ]);
  const restore = () => {
    for (const [file, bytes] of originals) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, bytes);
    }
  };
  const candidateRejects = (pattern) => assert.throws(() => auditCandidate({
    root: values.root,
    candidate: 'migration/candidates/architecture',
    target: 'architecture'
  }), pattern);

  fs.rmSync(dumpPath);
  assert.throws(() => auditSource({ root: values.root }), /alias registry dump is missing/);
  candidateRejects(/alias registry dump is missing/);
  restore();
  fs.appendFileSync(dumpPath, ' ');
  assert.throws(() => auditSource({ root: values.root }), /registry dump hash mismatch/);
  candidateRejects(/registry dump hash mismatch/);
  restore();
  fs.rmSync(fixtureManifestPath);
  assert.throws(() => auditSource({ root: values.root }), /alias fixture manifest is missing/);
  candidateRejects(/alias fixture manifest is missing/);
  restore();
  fs.appendFileSync(fixtureManifestPath, ' ');
  assert.throws(() => auditSource({ root: values.root }), /fixture manifest hash mismatch/);
  candidateRejects(/fixture manifest hash mismatch/);
  restore();
  fs.rmSync(fixtureSkillPath);
  assert.throws(() => auditSource({ root: values.root }), /alias fixture skill is missing/);
  candidateRejects(/alias fixture skill is missing/);
  restore();
  fs.appendFileSync(fixtureSkillPath, ' ');
  assert.throws(() => auditSource({ root: values.root }), /fixture skill hash mismatch/);
  candidateRejects(/fixture skill hash mismatch/);
  restore();
  fs.appendFileSync(pluginManifestPath, ' ');
  assert.throws(() => auditSource({ root: values.root }), /stale for the core plugin fingerprint/);
  candidateRejects(/stale for the core plugin fingerprint/);
  restore();
  fs.rmSync(ownerRequestPath);
  assert.throws(() => auditSource({ root: values.root }), /alias capability owner request is missing/);
  candidateRejects(/alias capability owner request is missing/);
  restore();
  fs.appendFileSync(historicalOwnerPath, '\nhistorical owner drift\n');
  assert.throws(() => auditSource({ root: values.root }),
    /historical alias capability owner request hash mismatch/);
  candidateRejects(/historical alias capability owner request hash mismatch/);
  restore();
  const truncatedOwnerHistory = readJson(
    values.root, 'migration/alias-capability.json'
  );
  truncatedOwnerHistory.owner_history = truncatedOwnerHistory.owner_history.slice(-1);
  writeJson(values.root, 'migration/alias-capability.json', truncatedOwnerHistory);
  syncAliasOwnerRequest(values.root, truncatedOwnerHistory);
  assert.throws(() => auditSource({ root: values.root }),
    /owner history must match the complete canonical R4 owner chain/);
  candidateRejects(/owner history must match the complete canonical R4 owner chain/);
  restore();
  const missingMiddleOwnerHistory = readJson(
    values.root, 'migration/alias-capability.json'
  );
  missingMiddleOwnerHistory.owner_history.splice(1, 1);
  writeJson(values.root, 'migration/alias-capability.json', missingMiddleOwnerHistory);
  syncAliasOwnerRequest(values.root, missingMiddleOwnerHistory);
  assert.throws(() => auditSource({ root: values.root }),
    /owner history must match the complete canonical R4 owner chain/);
  candidateRejects(/owner history must match the complete canonical R4 owner chain/);
  restore();
  fs.writeFileSync(ownerRequestPath, fs.readFileSync(ownerRequestPath, 'utf8')
    .replace('"codex_version":"codex-cli 0.161.0"',
      '"codex_version":"codex-cli 0.145.1"') +
    '\nCodex version: `codex-cli 0.161.0`; Tested at: `2026-07-23T17:08:50+08:00`\n');
  assert.throws(() => auditSource({ root: values.root }),
    /owner evidence does not match the decision artifact/);
  candidateRejects(/owner evidence does not match the decision artifact/);
  restore();
  fs.writeFileSync(ownerRequestPath, fs.readFileSync(ownerRequestPath, 'utf8')
    .replace('"decision":"mapping-only"', '"decision":"manual-only"'));
  assert.throws(() => auditSource({ root: values.root }),
    /owner evidence does not match the decision artifact/);
  candidateRejects(/owner evidence does not match the decision artifact/);
  restore();
  const duplicateOwnerEvidence = fs.readFileSync(ownerRequestPath, 'utf8')
    .match(/^<!-- sd0x-alias-capability-owner:v1 [^\r\n]+ -->$/m)[0];
  fs.appendFileSync(ownerRequestPath, `\n${duplicateOwnerEvidence}\n`);
  assert.throws(() => auditSource({ root: values.root }),
    /must contain exactly one evidence record/);
  candidateRejects(/must contain exactly one evidence record/);
  restore();
  fs.writeFileSync(ownerRequestPath, fs.readFileSync(ownerRequestPath, 'utf8')
    .replace('> **Status**: Candidate Complete', '> **Status**: In Progress')
    .replace('## Background', '## Background\n\n> **Status**: Candidate Complete'));
  assert.throws(() => auditSource({ root: values.root }),
    /owner request must be acceptance-ready/);
  candidateRejects(/owner request must be acceptance-ready/);
  restore();
  fs.writeFileSync(ownerRequestPath, fs.readFileSync(ownerRequestPath, 'utf8')
    .replace(/^## Acceptance Criteria\n\n(?:- \[[ xX]\].*\n)+/m, '## Acceptance Criteria\n\n'));
  assert.throws(() => auditSource({ root: values.root }),
    /owner request must have complete acceptance criteria/);
  candidateRejects(/owner request must have complete acceptance criteria/);
  restore();
  const ownerMutationOptions = () => ({
    codexVersion: 'codex-cli 0.161.0',
    afterOwnerRequestRead({ ownerRequestPath: capturedPath }) {
      fs.writeFileSync(capturedPath, fs.readFileSync(capturedPath, 'utf8')
        .replace(/^<!-- sd0x-alias-capability-owner:v1 [^\r\n]+ -->\n?/m, ''));
    }
  });
  const raceDisposition = readJson(values.root, 'migration/source-disposition.json');
  assert.throws(() => validateAliasCapability(
    values.root, raceDisposition, ownerMutationOptions()
  ), /owner request changed while validating capability/);
  restore();
  assert.throws(() => auditSource({
    root: values.root,
    aliasCapability: ownerMutationOptions()
  }), /owner request changed while validating capability/);
  restore();
  assert.throws(() => auditCandidate({
    root: values.root,
    candidate: 'migration/candidates/architecture',
    target: 'architecture',
    aliasCapability: ownerMutationOptions()
  }), /owner request changed while validating capability/);
  restore();
  const splitDecisionOptions = () => ({
    codexVersion: 'codex-cli 0.161.0',
    afterDecisionRead() {
      const mutated = readJson(values.root, 'migration/alias-capability.json');
      mutated.reproduce_argv[0] = 'CODEX_HOME=~/.codex codex --version';
      writeJson(values.root, 'migration/alias-capability.json', mutated);
      syncAliasOwnerRequest(values.root, mutated);
    }
  });
  assert.throws(() => validateAliasCapability(
    values.root, raceDisposition, splitDecisionOptions()
  ), /owner evidence does not match the decision artifact/);
  restore();
  assert.throws(() => auditSource({
    root: values.root,
    aliasCapability: splitDecisionOptions()
  }), /owner evidence does not match the decision artifact/);
  restore();
  assert.throws(() => auditCandidate({
    root: values.root,
    candidate: 'migration/candidates/architecture',
    target: 'architecture',
    aliasCapability: splitDecisionOptions()
  }), /owner evidence does not match the decision artifact/);
  restore();
  const ownerRelative = path.relative(values.root, ownerRequestPath).split(path.sep).join('/');
  const lateOwnerMutationOptions = () => {
    let mutated = false;
    return {
      afterRequestRead({ relative }) {
        if (mutated || relative === ownerRelative) return;
        fs.writeFileSync(ownerRequestPath, fs.readFileSync(ownerRequestPath, 'utf8')
          .replace(/^<!-- sd0x-alias-capability-owner:v1 [^\r\n]+ -->\n?/m, ''));
        mutated = true;
      }
    };
  };
  assert.throws(() => auditSource({
    root: values.root,
    aliasCapability: { codexVersion: 'codex-cli 0.161.0' },
    requestDag: lateOwnerMutationOptions()
  }), /request differs from its prior source snapshot/);
  restore();
  assert.throws(() => auditCandidate({
    root: values.root,
    candidate: 'migration/candidates/architecture',
    target: 'architecture',
    aliasCapability: { codexVersion: 'codex-cli 0.161.0' },
    requestDag: lateOwnerMutationOptions()
  }), /request differs from its prior source snapshot/);
  restore();

  const mappingDisposition = readJson(values.root, 'migration/source-disposition.json');
  assert.throws(() => validateAliasCapability(values.root, mappingDisposition, {
    codexVersion: 'codex-cli 9.9.9'
  }), /mapping-only alias evidence is stale for Codex version/);
  assert.throws(() => auditSource({
    root: values.root,
    aliasCapability: { codexVersion: 'codex-cli 9.9.9' }
  }), /mapping-only alias evidence is stale for Codex version/);
  assert.throws(() => auditCandidate({
    root: values.root,
    candidate: 'migration/candidates/architecture',
    target: 'architecture',
    aliasCapability: { codexVersion: 'codex-cli 9.9.9' }
  }), /mapping-only alias evidence is stale for Codex version/);

  const invalidMappingDecision = readJson(values.root, 'migration/alias-capability.json');
  invalidMappingDecision.registry_mechanism = 'unexpectedExclusion';
  writeJson(values.root, 'migration/alias-capability.json', invalidMappingDecision);
  syncAliasOwnerRequest(values.root, invalidMappingDecision);
  assert.throws(() => auditSource({
    root: values.root,
    aliasCapability: { codexVersion: 'codex-cli 0.161.0' }
  }), /mapping-only decision cannot claim a registry exclusion mechanism/);
  assert.throws(() => auditCandidate({
    root: values.root,
    candidate: 'migration/candidates/architecture',
    target: 'architecture',
    aliasCapability: { codexVersion: 'codex-cli 0.161.0' }
  }), /mapping-only decision cannot claim a registry exclusion mechanism/);
  restore();

  const decision = readJson(values.root, 'migration/alias-capability.json');
  const dump = readJson(values.root, 'migration/evidence/alias-registry-dump.json');
  const disposition = readJson(values.root, 'migration/source-disposition.json');
  decision.decision = 'manual-only';
  decision.registry_mechanism = 'implicitInvocationDisabled';
  decision.auto_route_excluded = true;
  dump.registry_schema.automatic_candidate_exclusion_fields = ['implicitInvocationDisabled'];
  dump.observations.manual_only_exclusion.supported = true;
  dump.observations.manual_only_exclusion.inspectable_mechanism =
    'implicitInvocationDisabled';
  for (const row of disposition.skills) {
    if (row.alias_candidate) row.alias_policy = 'manual-only';
  }
  disposition.alias_policy_decision.policy = 'manual-only';
  writeJson(values.root, 'migration/evidence/alias-registry-dump.json', dump);
  decision.registry_dump_hash = crypto.createHash('sha256')
    .update(fs.readFileSync(dumpPath)).digest('hex');
  writeJson(values.root, 'migration/alias-capability.json', decision);
  writeJson(values.root, 'migration/source-disposition.json', disposition);
  syncAliasOwnerRequest(values.root, decision);
  assert.throws(() => validateAliasCapability(values.root, disposition, {
    codexVersion: 'codex-cli 0.161.0'
  }), /manual-only registry evidence is missing or ambiguous/);
  dump.observations.repository_probe.neutral_catalog_has_alias = false;
  writeJson(values.root, 'migration/evidence/alias-registry-dump.json', dump);
  decision.registry_dump_hash = crypto.createHash('sha256')
    .update(fs.readFileSync(dumpPath)).digest('hex');
  writeJson(values.root, 'migration/alias-capability.json', decision);
  syncAliasOwnerRequest(values.root, decision);
  assert.deepEqual(validateAliasCapability(values.root, disposition, {
    codexVersion: 'codex-cli 0.161.0'
  }), {
    decision: 'manual-only',
    codex_version: 'codex-cli 0.161.0'
  });
  prepareRow(values.root, 'architecture', { capabilities: ['core'] });
  const manualCandidate = writeCandidate(values.root, {
    target: 'architecture',
    sourceNames: ['architecture'],
    targetPackage: 'planning-pack',
    unit: 'architecture/default'
  });
  assert.equal(auditCandidate({
    root: values.root,
    candidate: manualCandidate,
    target: 'architecture',
    aliasCapability: { codexVersion: 'codex-cli 0.161.0' }
  }).ok, true);
  assert.equal(auditSource({
    root: values.root,
    aliasCapability: { codexVersion: 'codex-cli 0.161.0' },
    skipDeliveredEvidence: true
  }).ok, true);

  const consistentDecision = structuredClone(decision);
  const consistentDump = structuredClone(dump);
  const negativeManualCases = [
    ['mechanism', (candidateDecision) => { candidateDecision.registry_mechanism = null; },
      /manual-only requires an inspectable registry mechanism/],
    ['exclusion-result', (candidateDecision) => {
      candidateDecision.auto_route_excluded = false;
    }, /manual-only requires an inspectable registry mechanism/],
    ['support-flag', (_candidateDecision, candidateDump) => {
      candidateDump.observations.manual_only_exclusion.supported = false;
    }, /manual-only registry evidence is missing or ambiguous/],
    ['manual-invocation', (candidateDecision) => {
      candidateDecision.manual_invocation = false;
    }, /must record successful explicit invocation support/],
    ['marker', (_candidateDecision, candidateDump) => {
      candidateDump.observations.repository_probe.manual_invocation_marker_observed = false;
    }, /repository-only alias probe evidence is incomplete/],
    ['explicit-catalog', (_candidateDecision, candidateDump) => {
      candidateDump.observations.repository_probe.explicit_catalog_has_alias = false;
    }, /repository-only alias probe evidence is incomplete/]
  ];
  for (const [name, mutate, pattern] of negativeManualCases) {
    const candidateDecision = structuredClone(consistentDecision);
    const candidateDump = structuredClone(consistentDump);
    mutate(candidateDecision, candidateDump);
    writeJson(values.root, 'migration/evidence/alias-registry-dump.json', candidateDump);
    candidateDecision.registry_dump_hash = crypto.createHash('sha256')
      .update(fs.readFileSync(dumpPath)).digest('hex');
    writeJson(values.root, 'migration/alias-capability.json', candidateDecision);
    syncAliasOwnerRequest(values.root, candidateDecision);
    assert.throws(() => validateAliasCapability(values.root, disposition, {
      codexVersion: 'codex-cli 0.161.0'
    }), pattern, name);
    assert.throws(() => auditCandidate({
      root: values.root,
      candidate: manualCandidate,
      target: 'architecture',
      aliasCapability: { codexVersion: 'codex-cli 0.161.0' }
    }), pattern, `${name}-candidate`);
  }
  writeJson(values.root, 'migration/evidence/alias-registry-dump.json', consistentDump);
  consistentDecision.registry_dump_hash = crypto.createHash('sha256')
    .update(fs.readFileSync(dumpPath)).digest('hex');
  writeJson(values.root, 'migration/alias-capability.json', consistentDecision);
  syncAliasOwnerRequest(values.root, consistentDecision);
  Object.assign(decision, consistentDecision);

  assert.throws(() => validateAliasCapability(values.root, disposition, {
    codexVersion: 'codex-cli 9.9.9'
  }), /stale for Codex version/);
  dump.codex_version = 'codex-cli 9.9.9';
  decision.codex_version = 'codex-cli 9.9.9';
  disposition.alias_policy_decision.codex_version = 'codex-cli 9.9.9';
  writeJson(values.root, 'migration/source-disposition.json', disposition);
  writeJson(values.root, 'migration/evidence/alias-registry-dump.json', dump);
  decision.registry_dump_hash = crypto.createHash('sha256')
    .update(fs.readFileSync(dumpPath)).digest('hex');
  writeJson(values.root, 'migration/alias-capability.json', decision);
  assert.throws(() => auditCandidate({
    root: values.root,
    candidate: 'migration/candidates/architecture',
    target: 'architecture',
    aliasCapability: { codexVersion: 'codex-cli 0.161.0' }
  }), /stale for Codex version/);
});
