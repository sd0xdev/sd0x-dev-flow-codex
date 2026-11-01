'use strict';

const {
  assert,
  fs,
  os,
  path,
  spawnSync,
  test,
  recordRequest,
  capturePreservedLive,
  copyPreservedLiveFiles,
  withPreparedCandidateDirectory,
  writePreparedText,
  applyPromotionMoves,
  buildPromotionPlan,
  captureRegularTree,
  copyCapturedTree,
  recoverPromotion,
  promotionTreeDigest,
  openBoundDirectory,
  assertTreeContent,
  captureBoundTree,
  linkBoundTree,
  removeBoundTree,
  writeBoundTree,
  atomicWriteContainedFile,
  restageCoreCandidate,
  initRepository,
  copy,
  ROOT,
  restageFixtureRoot
} = require('../helpers/migration-context');

test('wave promotion prevalidates every target and safely recognizes an interrupted move', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-promotion-plan-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const targets = ['alpha', 'beta'];
  const plan = {
    targets: targets.map((target) => ({
      target,
      target_package: 'quality-pack',
      units: [{ promotion_unit_id: `${target}/default` }]
    }))
  };
  const disposition = { skills: [] };
  for (const target of targets) {
    const candidate = path.join(root, 'migration', 'candidates', target);
    fs.mkdirSync(candidate, { recursive: true });
    fs.writeFileSync(path.join(candidate, 'SKILL.md'), `# ${target}\n`);
    const request = `requests/${target}.md`;
    fs.mkdirSync(path.join(root, 'requests'), { recursive: true });
    fs.writeFileSync(path.join(root, request), [
      `# ${target}`,
      '',
      '> **Status**: Candidate Complete',
      '',
      `Candidate payload \`${promotionTreeDigest(candidate)}\`.`,
      ''
    ].join('\n'));
    disposition.skills.push({
      target_skill: target,
      promotion_unit_id: `${target}/default`,
      delivery_state: 'candidate',
      promotion_request: request
    });
  }

  const beta = path.join(root, 'migration', 'candidates', 'beta', 'SKILL.md');
  fs.appendFileSync(beta, 'drift\n');
  assert.throws(() => buildPromotionPlan(root, plan, disposition),
    /beta: candidate drifted after Candidate Complete preflight/);
  assert.equal(fs.existsSync(path.join(root, 'migration', 'candidates', 'alpha')), true);
  assert.equal(fs.existsSync(path.join(
    root, 'migration', 'packs', 'quality-pack', 'alpha'
  )), false);

  fs.writeFileSync(beta, '# beta\n');
  const alphaCandidate = path.join(root, 'migration', 'candidates', 'alpha');
  const alphaFinal = path.join(root, 'migration', 'packs', 'quality-pack', 'alpha');
  fs.mkdirSync(path.dirname(alphaFinal), { recursive: true });
  fs.renameSync(alphaCandidate, alphaFinal);
  const retry = buildPromotionPlan(root, plan, disposition);
  assert.equal(retry.find((move) => move.target === 'alpha').action, 'already-moved');
  assert.equal(retry.find((move) => move.target === 'beta').action, 'move');
});

test('core promotion rollback restores the full accepted candidate after partial cleanup', (t) => {
  const initialCwd = process.cwd();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-core-promotion-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const candidate = path.join(root, 'candidate');
  const destination = path.join(root, 'live');
  fs.mkdirSync(candidate, { recursive: true });
  fs.mkdirSync(destination, { recursive: true });
  fs.writeFileSync(path.join(candidate, 'SKILL.md'), '# accepted\n');
  fs.writeFileSync(path.join(candidate, 'contract.json'), '{"accepted":true}\n');
  fs.writeFileSync(path.join(destination, 'SKILL.md'), '# prior\n');
  const accepted = promotionTreeDigest(candidate);
  const prior = promotionTreeDigest(destination);
  const moves = [{
    target: 'fixture',
    target_package: 'core',
    payload_tree_sha256: accepted,
    action: 'move',
    candidate,
    destination
  }];

  assert.throws(() => applyPromotionMoves(root, moves, {
    removeCoreCandidate(directory) {
      fs.rmSync(path.join(directory, 'SKILL.md'));
      throw new Error('injected cleanup failure');
    }
  }), /injected cleanup failure/);
  assert.equal(promotionTreeDigest(destination), prior);
  assert.equal(promotionTreeDigest(candidate), accepted);
  assert.deepEqual(fs.readdirSync(root).filter((name) => name !== '.sd0x').sort(),
    ['candidate', 'live']);
  assert.equal(process.cwd(), initialCwd);
});

test('promotion replacement staging leaves exact parent inventories on mid-copy failure', (t) => {
  for (const targetPackage of ['core', 'quality-pack']) {
    const root = fs.mkdtempSync(path.join(
      os.tmpdir(), `sd0x-${targetPackage}-replacement-failure-`
    ));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const candidateParent = path.join(root, 'migration', 'candidates');
    const destinationParent = targetPackage === 'core'
      ? path.join(root, 'plugin', 'sd0x-dev-flow-codex', 'skills')
      : path.join(root, 'migration', 'packs', 'quality-pack');
    const candidate = path.join(candidateParent, 'fixture');
    const destination = path.join(destinationParent, 'fixture');
    fs.mkdirSync(candidate, { recursive: true });
    fs.mkdirSync(destinationParent, { recursive: true });
    fs.writeFileSync(path.join(candidate, 'A'), 'first\n');
    fs.writeFileSync(path.join(candidate, 'B'), 'second\n');
    if (targetPackage === 'core') {
      fs.mkdirSync(destination);
      fs.writeFileSync(path.join(destination, 'SKILL.md'), '# prior\n');
    }
    const candidateInventory = fs.readdirSync(candidateParent).sort();
    const destinationInventory = fs.readdirSync(destinationParent).sort();
    let writes = 0;
    assert.throws(() => applyPromotionMoves(root, [{
      target: 'fixture', target_package: targetPackage, action: 'move',
      candidate, destination,
      payload_tree_sha256: promotionTreeDigest(candidate)
    }], {
      beforeReplacementWrite() {
        writes += 1;
        if (writes === 2) throw new Error('injected replacement copy failure');
      }
    }), /injected replacement copy failure/);
    assert.deepEqual(fs.readdirSync(candidateParent).sort(), candidateInventory);
    assert.deepEqual(fs.readdirSync(destinationParent).sort(), destinationInventory);
  }
});

test('promotion recovery removes fingerprinted partial replacement staging', (t) => {
  for (const targetPackage of ['core', 'quality-pack']) {
    const root = fs.mkdtempSync(path.join(
      os.tmpdir(), `sd0x-${targetPackage}-replacement-crash-`
    ));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const candidateParent = path.join(root, 'migration', 'candidates');
    const destinationParent = targetPackage === 'core'
      ? path.join(root, 'plugin', 'sd0x-dev-flow-codex', 'skills')
      : path.join(root, 'migration', 'packs', 'quality-pack');
    const candidate = path.join(candidateParent, 'fixture');
    const destination = path.join(destinationParent, 'fixture');
    fs.mkdirSync(candidate, { recursive: true });
    fs.mkdirSync(destinationParent, { recursive: true });
    fs.writeFileSync(path.join(candidate, 'A'), 'first\n');
    fs.writeFileSync(path.join(candidate, 'B'), 'second\n');
    if (targetPackage === 'core') {
      fs.mkdirSync(destination);
      fs.writeFileSync(path.join(destination, 'SKILL.md'), '# prior\n');
    }
    const candidateInventory = fs.readdirSync(candidateParent).sort();
    const destinationInventory = fs.readdirSync(destinationParent).sort();
    const modulePath = path.join(ROOT, 'scripts', 'promote-skill-wave.js');
    const result = spawnSync(process.execPath, ['-e', [
      "const {applyPromotionMoves,treeDigest}=require(process.argv[1]);",
      'const [root,candidate,destination,targetPackage]=process.argv.slice(2);',
      'let writes=0;',
      "applyPromotionMoves(root,[{target:'fixture',target_package:targetPackage,",
      "action:'move',candidate,destination,payload_tree_sha256:treeDigest(candidate)}],",
      '{beforeReplacementWrite(){writes+=1;if(writes===2)process.exit(86);}});'
    ].join(''), modulePath, root, candidate, destination, targetPackage]);
    assert.equal(result.status, 86);
    const recovery = fs.readdirSync(path.join(root, '.sd0x'))
      .map((name) => path.join(root, '.sd0x', name))
      .find((entry) => fs.existsSync(path.join(entry, 'recovery.json')));
    assert.ok(recovery);
    const manifest = JSON.parse(fs.readFileSync(
      path.join(recovery, 'recovery.json'), 'utf8'
    ));
    assert.equal(manifest.moves[0].replacement_identity, null);
    recoverPromotion(root, recovery);
    assert.deepEqual(fs.readdirSync(candidateParent).sort(), candidateInventory);
    assert.deepEqual(fs.readdirSync(destinationParent).sort(), destinationInventory);
  }
});

test('promotion crash recovery contains roots created before managed installation', (t) => {
  const scenarios = [
    { targetPackage: 'core', hook: 'afterReplacementStagingRootCreate' },
    { targetPackage: 'quality-pack', hook: 'afterReplacementStagingRootCreate' },
    { targetPackage: 'core', hook: 'afterCandidateBackupStagingRootCreate' }
  ];
  for (const scenario of scenarios) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-staging-root-crash-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const candidateParent = path.join(root, 'migration', 'candidates');
    const destinationParent = scenario.targetPackage === 'core'
      ? path.join(root, 'plugin', 'sd0x-dev-flow-codex', 'skills')
      : path.join(root, 'migration', 'packs', 'quality-pack');
    const candidate = path.join(candidateParent, 'fixture');
    const destination = path.join(destinationParent, 'fixture');
    fs.mkdirSync(candidate, { recursive: true });
    fs.mkdirSync(destinationParent, { recursive: true });
    fs.writeFileSync(path.join(candidate, 'A'), 'first\n');
    fs.writeFileSync(path.join(candidate, 'B'), 'second\n');
    if (scenario.targetPackage === 'core') {
      fs.mkdirSync(destination);
      fs.writeFileSync(path.join(destination, 'SKILL.md'), '# prior\n');
    }
    const candidateInventory = fs.readdirSync(candidateParent).sort();
    const destinationInventory = fs.readdirSync(destinationParent).sort();
    const modulePath = path.join(ROOT, 'scripts', 'promote-skill-wave.js');
    const result = spawnSync(process.execPath, ['-e', [
      "const {applyPromotionMoves,treeDigest}=require(process.argv[1]);",
      'const [root,candidate,destination,targetPackage,hook]=process.argv.slice(2);',
      'const options={[hook](){process.exit(86);}};',
      "applyPromotionMoves(root,[{target:'fixture',target_package:targetPackage,",
      "action:'move',candidate,destination,payload_tree_sha256:treeDigest(candidate)}],",
      'options);'
    ].join(''), modulePath, root, candidate, destination,
    scenario.targetPackage, scenario.hook]);
    assert.equal(result.status, 86);
    const recovery = fs.readdirSync(path.join(root, '.sd0x'))
      .map((name) => path.join(root, '.sd0x', name))
      .find((entry) => fs.existsSync(path.join(entry, 'recovery.json')));
    assert.ok(recovery);
    recoverPromotion(root, recovery);
    assert.deepEqual(fs.readdirSync(candidateParent).sort(), candidateInventory);
    assert.deepEqual(fs.readdirSync(destinationParent).sort(), destinationInventory);
  }
});

test('managed promotion publication recovers root-create and first-child crashes', (t) => {
  const scenarios = [
    {
      targetPackage: 'core',
      hook: 'beforeReplacementManagedRootRegister'
    },
    {
      targetPackage: 'quality-pack',
      hook: 'beforeReplacementManagedRootRegister'
    },
    {
      targetPackage: 'core',
      hook: 'beforeCandidateBackupManagedRootRegister'
    },
    {
      targetPackage: 'core',
      hook: 'afterReplacementManagedChildWrite'
    },
    {
      targetPackage: 'quality-pack',
      hook: 'afterReplacementManagedChildWrite'
    },
    {
      targetPackage: 'core',
      hook: 'afterCandidateBackupManagedChildWrite'
    }
  ];
  for (const scenario of scenarios) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-managed-crash-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const candidateParent = path.join(root, 'migration', 'candidates');
    const destinationParent = scenario.targetPackage === 'core'
      ? path.join(root, 'plugin', 'sd0x-dev-flow-codex', 'skills')
      : path.join(root, 'migration', 'packs', 'quality-pack');
    const candidate = path.join(candidateParent, 'fixture');
    const destination = path.join(destinationParent, 'fixture');
    fs.mkdirSync(candidate, { recursive: true });
    fs.mkdirSync(destinationParent, { recursive: true });
    fs.writeFileSync(path.join(candidate, 'A'), 'first\n');
    fs.writeFileSync(path.join(candidate, 'B'), 'second\n');
    if (scenario.targetPackage === 'core') {
      fs.mkdirSync(destination);
      fs.writeFileSync(path.join(destination, 'SKILL.md'), '# prior\n');
    }
    const candidateInventory = fs.readdirSync(candidateParent).sort();
    const destinationInventory = fs.readdirSync(destinationParent).sort();
    const modulePath = path.join(ROOT, 'scripts', 'promote-skill-wave.js');
    const result = spawnSync(process.execPath, ['-e', [
      "const {applyPromotionMoves,treeDigest}=require(process.argv[1]);",
      'const [root,candidate,destination,targetPackage,hook]=process.argv.slice(2);',
      'let called=false;',
      'const options={[hook](){if(!called){called=true;process.exit(86);}}};',
      "applyPromotionMoves(root,[{target:'fixture',target_package:targetPackage,",
      "action:'move',candidate,destination,payload_tree_sha256:treeDigest(candidate)}],",
      'options);'
    ].join(''), modulePath, root, candidate, destination,
    scenario.targetPackage, scenario.hook]);
    assert.equal(result.status, 86, scenario.hook);
    const recovery = fs.readdirSync(path.join(root, '.sd0x'))
      .map((name) => path.join(root, '.sd0x', name))
      .find((entry) => fs.existsSync(path.join(entry, 'recovery.json')));
    assert.ok(recovery, scenario.hook);
    recoverPromotion(root, recovery);
    assert.deepEqual(
      fs.readdirSync(candidateParent).sort(),
      candidateInventory,
      scenario.hook
    );
    assert.deepEqual(
      fs.readdirSync(destinationParent).sort(),
      destinationInventory,
      scenario.hook
    );
  }
});

test('registered promotion staging rejects recovery path swaps for core and pack', (t) => {
  for (const targetPackage of ['core', 'quality-pack']) {
    const root = fs.mkdtempSync(path.join(
      os.tmpdir(), `sd0x-${targetPackage}-registered-path-swap-`
    ));
    const outside = fs.mkdtempSync(path.join(
      os.tmpdir(), `sd0x-${targetPackage}-registered-path-outside-`
    ));
    t.after(() => {
      fs.rmSync(root, { recursive: true, force: true });
      fs.rmSync(outside, { recursive: true, force: true });
    });
    const candidateParent = path.join(root, 'migration', 'candidates');
    const destinationParent = targetPackage === 'core'
      ? path.join(root, 'plugin', 'sd0x-dev-flow-codex', 'skills')
      : path.join(root, 'migration', 'packs', 'quality-pack');
    const candidate = path.join(candidateParent, 'fixture');
    const destination = path.join(destinationParent, 'fixture');
    fs.mkdirSync(candidate, { recursive: true });
    fs.mkdirSync(destinationParent, { recursive: true });
    fs.writeFileSync(path.join(candidate, 'SKILL.md'), '# accepted\n');
    if (targetPackage === 'core') {
      fs.mkdirSync(destination);
      fs.writeFileSync(path.join(destination, 'SKILL.md'), '# prior\n');
    }
    fs.writeFileSync(path.join(outside, 'KEEP'), 'outside unchanged\n');
    const candidateInventory = fs.readdirSync(candidateParent).sort();
    const destinationInventory = fs.readdirSync(destinationParent).sort();
    let recovery;
    let heldRecovery;
    assert.throws(() => applyPromotionMoves(root, [{
      target: 'fixture', target_package: targetPackage, action: 'move',
      candidate, destination,
      payload_tree_sha256: promotionTreeDigest(candidate)
    }], {
      afterReplacementStagingRegistered(details) {
        recovery = details.recoveryDirectory;
        heldRecovery = `${recovery}-held`;
        fs.renameSync(recovery, heldRecovery);
        fs.mkdirSync(path.join(outside, details.stagingName));
        fs.writeFileSync(path.join(
          outside, details.stagingName, 'SKILL.md'
        ), '# attacker replacement\n');
        fs.symlinkSync(outside, recovery);
      }
    }), /recovery|Recovery|bound|rollback was incomplete/);
    assert.deepEqual(fs.readdirSync(candidateParent).sort(), candidateInventory);
    if (targetPackage === 'core') {
      assert.equal(fs.readFileSync(path.join(destination, 'SKILL.md'), 'utf8'),
        '# prior\n');
    } else {
      assert.equal(fs.existsSync(destination), false);
    }
    assert.equal(fs.readFileSync(path.join(outside, 'KEEP'), 'utf8'),
      'outside unchanged\n');
    assert.equal(fs.readFileSync(path.join(
      outside,
      fs.readdirSync(outside).find((name) => name.startsWith('.staging-')),
      'SKILL.md'
    ), 'utf8'), '# attacker replacement\n');
    if (fs.existsSync(recovery)) fs.unlinkSync(recovery);
    fs.renameSync(heldRecovery, recovery);
    recoverPromotion(root, recovery);
    assert.deepEqual(fs.readdirSync(candidateParent).sort(), candidateInventory);
    assert.deepEqual(fs.readdirSync(destinationParent).sort(), destinationInventory);
  }
});

test('registered promotion staging contains destination parent swaps', (t) => {
  for (const targetPackage of ['core', 'quality-pack']) {
    const root = fs.mkdtempSync(path.join(
      os.tmpdir(), `sd0x-${targetPackage}-destination-path-swap-`
    ));
    const outside = fs.mkdtempSync(path.join(
      os.tmpdir(), `sd0x-${targetPackage}-destination-path-outside-`
    ));
    t.after(() => {
      fs.rmSync(root, { recursive: true, force: true });
      fs.rmSync(outside, { recursive: true, force: true });
    });
    const candidateParent = path.join(root, 'migration', 'candidates');
    const destinationParent = targetPackage === 'core'
      ? path.join(root, 'plugin', 'sd0x-dev-flow-codex', 'skills')
      : path.join(root, 'migration', 'packs', 'quality-pack');
    const candidate = path.join(candidateParent, 'fixture');
    const destination = path.join(destinationParent, 'fixture');
    fs.mkdirSync(candidate, { recursive: true });
    fs.mkdirSync(destinationParent, { recursive: true });
    fs.writeFileSync(path.join(candidate, 'SKILL.md'), '# accepted\n');
    if (targetPackage === 'core') {
      fs.mkdirSync(destination);
      fs.writeFileSync(path.join(destination, 'SKILL.md'), '# prior\n');
    }
    fs.writeFileSync(path.join(outside, 'KEEP'), 'outside unchanged\n');
    const candidateInventory = fs.readdirSync(candidateParent).sort();
    const destinationInventory = fs.readdirSync(destinationParent).sort();
    const heldDestinationParent = `${destinationParent}-held`;
    assert.throws(() => applyPromotionMoves(root, [{
      target: 'fixture', target_package: targetPackage, action: 'move',
      candidate, destination,
      payload_tree_sha256: promotionTreeDigest(candidate)
    }], {
      afterReplacementStagingRegistered() {
        fs.renameSync(destinationParent, heldDestinationParent);
        fs.symlinkSync(outside, destinationParent);
      }
    }), /bound|rollback was incomplete|identity changed/);
    assert.deepEqual(fs.readdirSync(candidateParent).sort(), candidateInventory);
    assert.deepEqual(fs.readdirSync(outside), ['KEEP']);
    fs.unlinkSync(destinationParent);
    fs.renameSync(heldDestinationParent, destinationParent);
    const recovery = fs.readdirSync(path.join(root, '.sd0x'))
      .map((name) => path.join(root, '.sd0x', name))
      .find((entry) => fs.existsSync(path.join(entry, 'recovery.json')));
    assert.ok(recovery);
    recoverPromotion(root, recovery);
    assert.deepEqual(fs.readdirSync(candidateParent).sort(), candidateInventory);
    assert.deepEqual(fs.readdirSync(destinationParent).sort(), destinationInventory);
    assert.deepEqual(fs.readdirSync(outside), ['KEEP']);
  }
});

test('registered promotion payloads are revalidated after registration', (t) => {
  for (const targetPackage of ['core', 'quality-pack']) {
    const root = fs.mkdtempSync(path.join(
      os.tmpdir(), `sd0x-${targetPackage}-registered-content-`
    ));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const candidateParent = path.join(root, 'migration', 'candidates');
    const destinationParent = targetPackage === 'core'
      ? path.join(root, 'plugin', 'sd0x-dev-flow-codex', 'skills')
      : path.join(root, 'migration', 'packs', 'quality-pack');
    const candidate = path.join(candidateParent, 'fixture');
    const destination = path.join(destinationParent, 'fixture');
    fs.mkdirSync(candidate, { recursive: true });
    fs.mkdirSync(destinationParent, { recursive: true });
    fs.writeFileSync(path.join(candidate, 'SKILL.md'), '# accepted\n');
    if (targetPackage === 'core') {
      fs.mkdirSync(destination);
      fs.writeFileSync(path.join(destination, 'SKILL.md'), '# prior\n');
    }
    const candidateInventory = fs.readdirSync(candidateParent).sort();
    const destinationInventory = fs.readdirSync(destinationParent).sort();
    assert.throws(() => applyPromotionMoves(root, [{
      target: 'fixture', target_package: targetPackage, action: 'move',
      candidate, destination,
      payload_tree_sha256: promotionTreeDigest(candidate)
    }], {
      afterReplacementStagingRegistered(details) {
        fs.writeFileSync(path.join(
          details.destinationParent,
          details.destinationName,
          'SKILL.md'
        ), '# modified after registration\n');
      }
    }), /content changed|accepted payload/);
    assert.deepEqual(fs.readdirSync(candidateParent).sort(), candidateInventory);
    assert.deepEqual(fs.readdirSync(destinationParent).sort(), destinationInventory);
    assert.deepEqual(fs.readdirSync(path.join(root, '.sd0x')), []);
  }
});

test('core recovery restores a candidate retired immediately before a crash', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-core-retire-crash-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const candidateParent = path.join(root, 'migration', 'candidates');
  const destinationParent = path.join(root, 'plugin', 'sd0x-dev-flow-codex', 'skills');
  const candidate = path.join(candidateParent, 'fixture');
  const destination = path.join(destinationParent, 'fixture');
  fs.mkdirSync(candidate, { recursive: true });
  fs.mkdirSync(destination, { recursive: true });
  fs.writeFileSync(path.join(candidate, 'SKILL.md'), '# accepted\n');
  fs.writeFileSync(path.join(destination, 'SKILL.md'), '# prior\n');
  const candidateInventory = fs.readdirSync(candidateParent).sort();
  const destinationInventory = fs.readdirSync(destinationParent).sort();
  const modulePath = path.join(ROOT, 'scripts', 'promote-skill-wave.js');
  const result = spawnSync(process.execPath, ['-e', [
    "const {applyPromotionMoves,treeDigest}=require(process.argv[1]);",
    'const [root,candidate,destination]=process.argv.slice(2);',
    "applyPromotionMoves(root,[{target:'fixture',target_package:'core',action:'move',",
    'candidate,destination,payload_tree_sha256:treeDigest(candidate)}],',
    '{afterCoreCandidateRetire(){process.exit(86);}});'
  ].join(''), modulePath, root, candidate, destination]);
  assert.equal(result.status, 86);
  const recovery = fs.readdirSync(path.join(root, '.sd0x'))
    .map((name) => path.join(root, '.sd0x', name))
    .find((entry) => fs.existsSync(path.join(entry, 'recovery.json')));
  assert.ok(recovery);
  recoverPromotion(root, recovery);
  assert.deepEqual(fs.readdirSync(candidateParent).sort(), candidateInventory);
  assert.deepEqual(fs.readdirSync(destinationParent).sort(), destinationInventory);
});

test('core recovery fallback is registered and retry-safe after a mid-copy failure', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-core-retry-restore-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const candidateParent = path.join(root, 'migration', 'candidates');
  const destinationParent = path.join(root, 'plugin', 'sd0x-dev-flow-codex', 'skills');
  const candidate = path.join(candidateParent, 'fixture');
  const destination = path.join(destinationParent, 'fixture');
  fs.mkdirSync(candidate, { recursive: true });
  fs.mkdirSync(destination, { recursive: true });
  fs.writeFileSync(path.join(candidate, 'A'), 'first\n');
  fs.writeFileSync(path.join(candidate, 'B'), 'second\n');
  fs.writeFileSync(path.join(destination, 'SKILL.md'), '# prior\n');
  const candidateInventory = fs.readdirSync(candidateParent).sort();
  const destinationInventory = fs.readdirSync(destinationParent).sort();
  const modulePath = path.join(ROOT, 'scripts', 'promote-skill-wave.js');
  const result = spawnSync(process.execPath, ['-e', [
    "const {applyPromotionMoves,treeDigest}=require(process.argv[1]);",
    'const [root,candidate,destination]=process.argv.slice(2);',
    "applyPromotionMoves(root,[{target:'fixture',target_package:'core',action:'move',",
    'candidate,destination,payload_tree_sha256:treeDigest(candidate)}],',
    '{afterCoreCandidateRetire(){process.exit(86);}});'
  ].join(''), modulePath, root, candidate, destination]);
  assert.equal(result.status, 86);
  const recovery = fs.readdirSync(path.join(root, '.sd0x'))
    .map((name) => path.join(root, '.sd0x', name))
    .find((entry) => fs.existsSync(path.join(entry, 'recovery.json')));
  assert.ok(recovery);
  const manifest = JSON.parse(fs.readFileSync(
    path.join(recovery, 'recovery.json'), 'utf8'
  ));
  const move = manifest.moves[0];
  fs.rmSync(path.join(candidateParent, move.candidate_removed), {
    recursive: true
  });
  fs.rmSync(path.join(candidateParent, move.candidate_sibling_backup), {
    recursive: true
  });
  let writes = 0;
  assert.throws(() => recoverPromotion(root, recovery, {
    beforeRecoveryCandidateRestoreWrite() {
      writes += 1;
      if (writes === 2) throw new Error('injected recovery restore failure');
    }
  }), /injected recovery restore failure/);
  assert.deepEqual(fs.readdirSync(candidateParent).sort(), []);
  assert.equal(fs.existsSync(recovery), true);
  assert.throws(() => recoverPromotion(root, recovery, {
    afterRecoveryCandidateRestore() {
      throw new Error('injected post-restore recovery failure');
    }
  }), /injected post-restore recovery failure/);
  assert.deepEqual(fs.readdirSync(candidateParent).sort(), candidateInventory);
  assert.equal(fs.existsSync(recovery), true);
  recoverPromotion(root, recovery);
  assert.deepEqual(fs.readdirSync(candidateParent).sort(), candidateInventory);
  assert.deepEqual(fs.readdirSync(destinationParent).sort(), destinationInventory);
  assert.equal(fs.existsSync(recovery), false);
});

test('recovery candidate sibling publication resets stale phase before retry', (t) => {
  for (const hook of [
    'beforeRecoveryCandidateRestoreManagedRootRegister',
    'afterRecoveryCandidateRestoreManagedChildWrite'
  ]) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-recovery-phase-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const candidateParent = path.join(root, 'migration', 'candidates');
    const destinationParent = path.join(
      root, 'plugin', 'sd0x-dev-flow-codex', 'skills'
    );
    const candidate = path.join(candidateParent, 'fixture');
    const destination = path.join(destinationParent, 'fixture');
    fs.mkdirSync(candidate, { recursive: true });
    fs.mkdirSync(destination, { recursive: true });
    fs.writeFileSync(path.join(candidate, 'A'), 'first\n');
    fs.writeFileSync(path.join(candidate, 'B'), 'second\n');
    fs.writeFileSync(path.join(destination, 'SKILL.md'), '# prior\n');
    const candidateInventory = fs.readdirSync(candidateParent).sort();
    const destinationInventory = fs.readdirSync(destinationParent).sort();
    const modulePath = path.join(ROOT, 'scripts', 'promote-skill-wave.js');
    const interruptedPromotion = spawnSync(process.execPath, ['-e', [
      "const {applyPromotionMoves,treeDigest}=require(process.argv[1]);",
      'const [root,candidate,destination]=process.argv.slice(2);',
      "applyPromotionMoves(root,[{target:'fixture',target_package:'core',action:'move',",
      'candidate,destination,payload_tree_sha256:treeDigest(candidate)}],',
      '{afterCoreCandidateRetire(){process.exit(86);}});'
    ].join(''), modulePath, root, candidate, destination]);
    assert.equal(interruptedPromotion.status, 86, hook);
    const recovery = fs.readdirSync(path.join(root, '.sd0x'))
      .map((name) => path.join(root, '.sd0x', name))
      .find((entry) => fs.existsSync(path.join(entry, 'recovery.json')));
    assert.ok(recovery, hook);
    const initialManifest = JSON.parse(fs.readFileSync(
      path.join(recovery, 'recovery.json'), 'utf8'
    ));
    const move = initialManifest.moves[0];
    assert.equal(move.candidate_sibling_backup_complete, true, hook);
    fs.rmSync(path.join(candidateParent, move.candidate_removed), {
      recursive: true
    });
    fs.rmSync(path.join(candidateParent, move.candidate_sibling_backup), {
      recursive: true
    });
    const interruptedRecovery = spawnSync(process.execPath, ['-e', [
      "const {recoverPromotion}=require(process.argv[1]);",
      'const [root,recovery,hook]=process.argv.slice(2);',
      'let called=false;',
      'recoverPromotion(root,recovery,{[hook](){if(!called){called=true;process.exit(86);}}});'
    ].join(''), modulePath, root, recovery, hook]);
    assert.equal(interruptedRecovery.status, 86, hook);
    const interruptedManifest = JSON.parse(fs.readFileSync(
      path.join(recovery, 'recovery.json'), 'utf8'
    ));
    assert.equal(
      interruptedManifest.moves[0].candidate_sibling_backup_complete,
      false,
      hook
    );
    recoverPromotion(root, recovery);
    assert.deepEqual(
      fs.readdirSync(candidateParent).sort(),
      candidateInventory,
      hook
    );
    assert.deepEqual(
      fs.readdirSync(destinationParent).sort(),
      destinationInventory,
      hook
    );
  }
});

test('core recovery rejects a modified registered sibling before mutation', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-core-sibling-content-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const candidateParent = path.join(root, 'migration', 'candidates');
  const destinationParent = path.join(root, 'plugin', 'sd0x-dev-flow-codex', 'skills');
  const candidate = path.join(candidateParent, 'fixture');
  const destination = path.join(destinationParent, 'fixture');
  fs.mkdirSync(candidate, { recursive: true });
  fs.mkdirSync(destination, { recursive: true });
  fs.writeFileSync(path.join(candidate, 'SKILL.md'), '# accepted\n');
  fs.writeFileSync(path.join(destination, 'SKILL.md'), '# prior\n');
  const candidateInventory = fs.readdirSync(candidateParent).sort();
  const destinationInventory = fs.readdirSync(destinationParent).sort();
  const modulePath = path.join(ROOT, 'scripts', 'promote-skill-wave.js');
  const result = spawnSync(process.execPath, ['-e', [
    "const {applyPromotionMoves,treeDigest}=require(process.argv[1]);",
    'const [root,candidate,destination]=process.argv.slice(2);',
    "applyPromotionMoves(root,[{target:'fixture',target_package:'core',action:'move',",
    'candidate,destination,payload_tree_sha256:treeDigest(candidate)}],',
    '{afterCoreCandidateRetire(){process.exit(86);}});'
  ].join(''), modulePath, root, candidate, destination]);
  assert.equal(result.status, 86);
  const recovery = fs.readdirSync(path.join(root, '.sd0x'))
    .map((name) => path.join(root, '.sd0x', name))
    .find((entry) => fs.existsSync(path.join(entry, 'recovery.json')));
  assert.ok(recovery);
  const manifest = JSON.parse(fs.readFileSync(
    path.join(recovery, 'recovery.json'), 'utf8'
  ));
  const move = manifest.moves[0];
  fs.rmSync(path.join(candidateParent, move.candidate_removed), {
    recursive: true
  });
  const siblingSkill = path.join(
    candidateParent, move.candidate_sibling_backup, 'SKILL.md'
  );
  const accepted = fs.readFileSync(siblingSkill);
  fs.writeFileSync(siblingSkill, '# modified registered sibling\n');
  assert.throws(() => recoverPromotion(root, recovery),
    /content differs from the accepted payload/);
  assert.equal(fs.existsSync(candidate), false);
  fs.writeFileSync(siblingSkill, accepted);
  recoverPromotion(root, recovery);
  assert.deepEqual(fs.readdirSync(candidateParent).sort(), candidateInventory);
  assert.deepEqual(fs.readdirSync(destinationParent).sort(), destinationInventory);
});

test('pack post-install failure rolls back without retaining recovery', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-pack-install-failure-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const candidateParent = path.join(root, 'migration', 'candidates');
  const destinationParent = path.join(root, 'migration', 'packs', 'quality-pack');
  const candidate = path.join(candidateParent, 'fixture');
  const destination = path.join(destinationParent, 'fixture');
  fs.mkdirSync(candidate, { recursive: true });
  fs.mkdirSync(destinationParent, { recursive: true });
  fs.writeFileSync(path.join(candidate, 'SKILL.md'), '# accepted\n');
  const candidateInventory = fs.readdirSync(candidateParent).sort();
  const destinationInventory = fs.readdirSync(destinationParent).sort();
  assert.throws(() => applyPromotionMoves(root, [{
    target: 'fixture', target_package: 'quality-pack', action: 'move',
    candidate, destination,
    payload_tree_sha256: promotionTreeDigest(candidate)
  }], {
    afterPackInstall() {
      throw new Error('injected post-install failure');
    }
  }), /injected post-install failure/);
  assert.deepEqual(fs.readdirSync(candidateParent).sort(), candidateInventory);
  assert.deepEqual(fs.readdirSync(destinationParent).sort(), destinationInventory);
  assert.deepEqual(fs.readdirSync(path.join(root, '.sd0x')), []);
});

test('multi-core promotion rollback restores exact managed parent inventories', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-multi-core-rollback-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const candidateParent = path.join(root, 'migration', 'candidates');
  const destinationParent = path.join(
    root, 'plugin', 'sd0x-dev-flow-codex', 'skills'
  );
  fs.mkdirSync(candidateParent, { recursive: true });
  fs.mkdirSync(destinationParent, { recursive: true });
  const expected = new Map();
  const moves = ['alpha', 'beta'].map((target) => {
    const candidate = path.join(candidateParent, target);
    const destination = path.join(destinationParent, target);
    fs.mkdirSync(candidate);
    fs.mkdirSync(destination);
    fs.writeFileSync(path.join(candidate, 'SKILL.md'), `# accepted ${target}\n`);
    fs.writeFileSync(path.join(destination, 'SKILL.md'), `# prior ${target}\n`);
    expected.set(target, {
      candidate: promotionTreeDigest(candidate),
      destination: promotionTreeDigest(destination)
    });
    return {
      target,
      target_package: 'core',
      payload_tree_sha256: expected.get(target).candidate,
      action: 'move',
      candidate,
      destination
    };
  });
  let removals = 0;
  assert.throws(() => applyPromotionMoves(root, moves, {
    removeCoreCandidate(directory) {
      removals += 1;
      if (removals === 1) {
        fs.rmSync(directory, { recursive: true });
        return;
      }
      fs.rmSync(path.join(directory, 'SKILL.md'));
      throw new Error('injected second candidate cleanup failure');
    }
  }), /injected second candidate cleanup failure/);
  assert.deepEqual(fs.readdirSync(candidateParent).sort(), ['alpha', 'beta']);
  assert.deepEqual(fs.readdirSync(destinationParent).sort(), ['alpha', 'beta']);
  for (const move of moves) {
    assert.equal(promotionTreeDigest(move.candidate),
      expected.get(move.target).candidate);
    assert.equal(promotionTreeDigest(move.destination),
      expected.get(move.target).destination);
  }
});

test('core promotion rejects a live-file symlink swap without external writes', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-promotion-swap-'));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-promotion-outside-'));
  t.after(() => {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  });
  const candidate = path.join(root, 'candidate');
  const destination = path.join(root, 'live');
  const outsideFile = path.join(outside, 'external.md');
  fs.mkdirSync(candidate);
  fs.mkdirSync(destination);
  fs.writeFileSync(path.join(candidate, 'SKILL.md'), '# accepted\n');
  fs.writeFileSync(path.join(destination, 'SKILL.md'), '# prior\n');
  fs.writeFileSync(outsideFile, 'outside unchanged\n');
  const accepted = promotionTreeDigest(candidate);

  assert.throws(() => applyPromotionMoves(root, [{
    target: 'fixture',
    target_package: 'core',
    payload_tree_sha256: accepted,
    action: 'move',
    candidate,
    destination
  }], {
    beforeInstall() {
      fs.rmSync(path.join(destination, 'SKILL.md'));
      fs.symlinkSync(outsideFile, path.join(destination, 'SKILL.md'));
    }
  }), /payload contains symlink|identity changed/);
  assert.equal(fs.readFileSync(outsideFile, 'utf8'), 'outside unchanged\n');
  assert.equal(promotionTreeDigest(candidate), accepted);
});

test('request preflight rejects file and ancestor swaps without external writes', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-request-swap-'));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-request-outside-'));
  t.after(() => {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  });
  const relative = 'docs/requests/review.md';
  const request = path.join(root, relative);
  const outsideFile = path.join(outside, 'review.md');
  fs.mkdirSync(path.dirname(request), { recursive: true });
  const initial = [
    '> **Status**: In Progress',
    '',
    '## Acceptance Criteria',
    '',
    '- [ ] Candidate preserves the complete review workflow and its meaningful failure boundaries.',
    '- [ ] Contract binds every assigned source name to this single canonical promotion unit.',
    '- [ ] Compatibility aliases remain mapping-only and add no discovered skill entrypoints.',
    '- [ ] Trusted routing tests distinguish positive prompts from adjacent skill boundaries.',
    '- [ ] Candidate preflight binds exact payload and behavioral-test identity.',
    '- [ ] Final core destination and move-window comparison are fixed for the accepted candidate bytes.',
    '- [ ] R3 closure inputs identify this exact request, promotion unit, evidence kind, and final-fingerprint fields.',
    '',
    '## Progress',
    '',
    '| Development | In Progress | pending |',
    '| Testing | Pending | pending |',
    '| Acceptance | Pending | pending |',
    ''
  ].join('\n');
  const result = {
    payload_tree_sha256: 'a'.repeat(64),
    audit_fingerprint: 'b'.repeat(64)
  };
  fs.writeFileSync(request, initial);
  fs.writeFileSync(outsideFile, 'outside unchanged\n');
  assert.throws(() => recordRequest(relative, result, {
    root,
    beforeCommit() {
      fs.rmSync(request);
      fs.symlinkSync(outsideFile, request);
    }
  }), /contained file identity changed/);
  assert.equal(fs.readFileSync(outsideFile, 'utf8'), 'outside unchanged\n');

  fs.rmSync(request);
  fs.writeFileSync(request, initial);
  const parent = path.dirname(request);
  const movedParent = path.join(root, 'docs', 'requests-real');
  assert.throws(() => recordRequest(relative, result, {
    root,
    beforeCommit({ temporary }) {
      fs.renameSync(parent, movedParent);
      fs.symlinkSync(outside, parent);
      fs.writeFileSync(path.join(outside, path.basename(temporary)), 'KEEP\n');
    }
  }), /path ancestor identity changed/);
  assert.equal(fs.readFileSync(outsideFile, 'utf8'), 'outside unchanged\n');
  const outsideTemporary = fs.readdirSync(outside).find((name) =>
    name.includes('.review.md.sd0x-'));
  assert.ok(outsideTemporary);
  assert.equal(fs.readFileSync(path.join(outside, outsideTemporary), 'utf8'), 'KEEP\n');

  fs.rmSync(parent);
  fs.renameSync(movedParent, parent);
  fs.writeFileSync(request, initial);
  assert.throws(() => recordRequest(relative, result, {
    root,
    beforeCommit() {
      fs.writeFileSync(request, initial.replace('pending |', 'PENDING |'));
    }
  }), /contained file content changed/);
  assert.match(fs.readFileSync(request, 'utf8'), /PENDING \|/);
});

test('wave preparation rejects an ancestor swap before atomic installation', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-prepare-swap-'));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-prepare-outside-'));
  t.after(() => {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  });
  const parent = path.join(root, 'requests');
  const target = path.join(parent, 'new.md');
  fs.mkdirSync(parent);
  assert.throws(() => writePreparedText(target, 'new request\n', {
    root,
    beforeCommit() {
      fs.renameSync(parent, path.join(root, 'requests-real'));
      fs.symlinkSync(outside, parent);
    }
  }), /path ancestor identity changed/);
  assert.deepEqual(fs.readdirSync(outside), []);

  const symlinked = path.join(root, 'linked');
  fs.symlinkSync(outside, symlinked);
  assert.throws(() => writePreparedText(
    path.join(symlinked, 'nested', 'new.md'),
    'new request\n',
    { root }
  ), /path ancestor must be a real directory/);
  assert.deepEqual(fs.readdirSync(outside), []);
});

test('wave preparation rejects a symlinked candidates ancestor without external deletion', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-prepare-candidates-'));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-prepare-candidates-outside-'));
  t.after(() => {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  });
  fs.mkdirSync(path.join(root, 'migration'));
  fs.mkdirSync(path.join(outside, 'fixture'));
  const sentinel = path.join(outside, 'fixture', 'KEEP');
  fs.writeFileSync(sentinel, 'outside unchanged\n');
  fs.symlinkSync(outside, path.join(root, 'migration', 'candidates'));

  assert.throws(() => withPreparedCandidateDirectory(root, 'fixture', () => {
    throw new Error('callback must not run');
  }), /ancestors must be real directories/);
  assert.equal(fs.readFileSync(sentinel, 'utf8'), 'outside unchanged\n');
  assert.deepEqual(fs.readdirSync(path.join(outside, 'fixture')), ['KEEP']);
});

test('wave preparation releases its lease after candidate preflight failure', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-prepare-release-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  initRepository(root);
  const candidate = path.join(root, 'migration', 'candidates', 'fixture');
  fs.mkdirSync(path.dirname(candidate), { recursive: true });
  fs.writeFileSync(candidate, 'invalid candidate\n');
  assert.throws(() => withPreparedCandidateDirectory(
    root, 'fixture', () => {}
  ), /existing candidate must be a real directory/);

  fs.unlinkSync(candidate);
  let called = false;
  withPreparedCandidateDirectory(root, 'fixture', () => { called = true; });
  assert.equal(called, true);
});

test('wave preparation rejects replacement after candidate capture', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-prepare-retire-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  initRepository(root);
  const candidates = path.join(root, 'migration', 'candidates');
  const candidate = path.join(candidates, 'fixture');
  fs.mkdirSync(candidate, { recursive: true });
  fs.writeFileSync(path.join(candidate, 'ORIGINAL'), 'original candidate\n');

  assert.throws(() => withPreparedCandidateDirectory(root, 'fixture', () => {
    throw new Error('callback must not run');
  }, {
    afterCandidateCapture() {
      fs.renameSync(candidate, `${candidate}-captured`);
      fs.mkdirSync(candidate);
      fs.writeFileSync(path.join(candidate, 'KEEP'), 'replacement survives\n');
    }
  }), /existing candidate root identity changed/);
  assert.equal(fs.readFileSync(path.join(candidate, 'KEEP'), 'utf8'),
    'replacement survives\n');
  assert.equal(fs.readFileSync(path.join(`${candidate}-captured`, 'ORIGINAL'), 'utf8'),
    'original candidate\n');
});

test('wave preparation never deletes a replaced retirement quarantine', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-prepare-quarantine-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  initRepository(root);
  const candidate = path.join(root, 'migration', 'candidates', 'fixture');
  fs.mkdirSync(candidate, { recursive: true });
  fs.writeFileSync(path.join(candidate, 'ORIGINAL'), 'captured candidate\n');
  let captured;
  let replacement;

  assert.throws(() => withPreparedCandidateDirectory(root, 'fixture', () => {
    throw new Error('callback must not run');
  }, {
    afterCandidateQuarantine({ retiredCandidate }) {
      captured = `${retiredCandidate}-captured`;
      replacement = retiredCandidate;
      fs.renameSync(retiredCandidate, captured);
      fs.mkdirSync(replacement);
      fs.writeFileSync(path.join(replacement, 'KEEP'), 'replacement survives\n');
    }
  }), /retired candidate root identity changed|retired candidate content changed/);
  assert.equal(fs.readFileSync(path.join(captured, 'ORIGINAL'), 'utf8'),
    'captured candidate\n');
  assert.equal(fs.readFileSync(path.join(replacement, 'KEEP'), 'utf8'),
    'replacement survives\n');
  assert.equal(fs.readFileSync(path.join(candidate, 'ORIGINAL'), 'utf8'),
    'captured candidate\n');
});

test('wave preparation retirement preserves open-descriptor writes', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-prepare-inode-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  initRepository(root);
  const candidate = path.join(root, 'migration', 'candidates', 'fixture');
  fs.mkdirSync(candidate, { recursive: true });
  const source = path.join(candidate, 'ORIGINAL');
  fs.writeFileSync(source, 'captured candidate\n');
  const descriptor = fs.openSync(source, 'a');
  t.after(() => fs.closeSync(descriptor));
  let retiredCandidate;

  withPreparedCandidateDirectory(root, 'fixture', () => {
    fs.writeSync(descriptor, 'late accepted edit\n');
  }, {
    afterCandidateQuarantine(details) {
      retiredCandidate = details.retiredCandidate;
    }
  });
  assert.equal(fs.readFileSync(path.join(
    retiredCandidate, 'ORIGINAL'
  ), 'utf8'), 'captured candidate\nlate accepted edit\n');
  assert.deepEqual(fs.readdirSync(candidate), []);
});

test('wave preparation rejects a candidates swap during recovery-bound restore', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-prepare-restore-'));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-prepare-restore-outside-'));
  t.after(() => {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  });
  initRepository(root);
  const candidates = path.join(root, 'migration', 'candidates');
  const candidate = path.join(candidates, 'fixture');
  fs.mkdirSync(candidate, { recursive: true });
  fs.writeFileSync(path.join(candidate, 'ORIGINAL'), 'captured candidate\n');
  fs.mkdirSync(path.join(outside, 'fixture'));
  fs.writeFileSync(path.join(outside, 'fixture', 'KEEP'), 'outside unchanged\n');

  assert.throws(() => withPreparedCandidateDirectory(root, 'fixture', () => {
    throw new Error('callback must not run');
  }, {
    beforeRetirementAssertRestore(previous) {
      assert.equal(fs.realpathSync(previous), fs.realpathSync(candidates));
      fs.renameSync(candidates, `${candidates}-captured`);
      fs.symlinkSync(outside, candidates);
    }
  }), /Previous directory changed before Recovery root \.sd0x restore|bound directory changed before it could be entered/);
  assert.equal(fs.readFileSync(path.join(outside, 'fixture', 'KEEP'), 'utf8'),
    'outside unchanged\n');
  assert.equal(fs.readFileSync(path.join(
    `${candidates}-captured`, 'fixture', 'ORIGINAL'
  ), 'utf8'), 'captured candidate\n');
  const recovery = path.join(root, '.sd0x', fs.readdirSync(path.join(root, '.sd0x'))
    .find((name) => name.startsWith('candidate-preparation-')));
  assert.equal(fs.existsSync(path.join(recovery, 'retired-candidate')), false);
});

test('preserved resource copies reject same-size edits and directory swaps', (t) => {
  const fixture = (prefix) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    const liveRoot = path.join(root, 'live');
    const candidate = path.join(root, 'candidate');
    fs.mkdirSync(liveRoot);
    fs.mkdirSync(candidate);
    return { root, liveRoot, candidate };
  };
  const target = { preserve_live_resources: true };

  const edited = fixture('sd0x-preserved-edit-');
  t.after(() => fs.rmSync(edited.root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(edited.liveRoot, 'resources'));
  const editedFile = path.join(edited.liveRoot, 'resources', 'config.txt');
  fs.writeFileSync(editedFile, 'AAAA\n');
  const editedSnapshot = captureRegularTree(edited.liveRoot);
  const editedDirectory = openBoundDirectory(edited.candidate);
  try {
    assert.throws(() => copyPreservedLiveFiles(target, editedDirectory, {
      liveRoot: edited.liveRoot,
      snapshot: editedSnapshot,
      rootStat: fs.lstatSync(edited.liveRoot),
      body: null
    }, {
      beforeSourceFileRead({ relative }) {
        if (relative === 'resources/config.txt') fs.writeFileSync(editedFile, 'BBBB\n');
      }
    }), /content changed before copy|tree changed during copy/);
  } finally {
    editedDirectory.close();
  }
  assert.equal(fs.existsSync(path.join(
    edited.candidate, 'resources', 'config.txt'
  )), false);

  const swapped = fixture('sd0x-preserved-swap-');
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-preserved-outside-'));
  t.after(() => {
    fs.rmSync(swapped.root, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  });
  fs.mkdirSync(path.join(swapped.liveRoot, 'resources', 'nested'), {
    recursive: true
  });
  fs.writeFileSync(path.join(
    swapped.liveRoot, 'resources', 'nested', 'inside.txt'
  ), 'trusted\n');
  fs.mkdirSync(path.join(outside, 'nested'));
  fs.writeFileSync(path.join(outside, 'nested', 'inside.txt'), 'external\n');
  const swappedSnapshot = captureRegularTree(swapped.liveRoot);
  const swappedDirectory = openBoundDirectory(swapped.candidate);
  try {
    assert.throws(() => copyPreservedLiveFiles(target, swappedDirectory, {
      liveRoot: swapped.liveRoot,
      snapshot: swappedSnapshot,
      rootStat: fs.lstatSync(swapped.liveRoot),
      body: null
    }, {
      afterSourceDirectoryOpen({ relative }) {
        if (relative !== 'resources') return;
        fs.renameSync(path.join(swapped.liveRoot, 'resources'),
          path.join(swapped.liveRoot, 'resources-real'));
        fs.symlinkSync(outside, path.join(swapped.liveRoot, 'resources'));
      }
    }), /bound directory changed before it could be entered/);
  } finally {
    swappedDirectory.close();
  }
  assert.equal(fs.existsSync(path.join(
    swapped.candidate, 'resources', 'nested', 'inside.txt'
  )), false);
  assert.equal(fs.readFileSync(path.join(outside, 'nested', 'inside.txt'), 'utf8'),
    'external\n');
});

test('detached preserved resources recreate nested files through bound parents', (t) => {
  const recoveryRoot = path.resolve(ROOT, '.sd0x');
  fs.mkdirSync(recoveryRoot, { recursive: true });
  const root = fs.mkdtempSync(path.join(recoveryRoot, 'preserved-detached-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const liveRoot = path.join(root, 'live');
  const candidate = path.join(root, 'candidate');
  fs.mkdirSync(path.join(liveRoot, 'scripts', 'nested'), { recursive: true });
  fs.mkdirSync(candidate);
  fs.writeFileSync(path.join(liveRoot, 'SKILL.md'), '# preserved body\n');
  fs.writeFileSync(path.join(liveRoot, 'migration-contract.json'), '{}\n');
  fs.writeFileSync(path.join(liveRoot, 'scripts', 'nested', 'run.js'),
    'module.exports = true;\n', { mode: 0o744 });
  fs.chmodSync(path.join(liveRoot, 'scripts', 'nested', 'run.js'), 0o744);
  const target = {
    target: 'fixture',
    preserve_live_body: true,
    preserve_live_resources: true,
    preserve_source_root: liveRoot,
    detach_preserved_resources: true
  };
  const preserved = capturePreservedLive(target);
  fs.rmSync(liveRoot, { recursive: true });
  const candidateDirectory = openBoundDirectory(candidate);
  const priorUmask = process.umask(0o077);
  try {
    copyPreservedLiveFiles(target, candidateDirectory, preserved);
  } finally {
    process.umask(priorUmask);
    candidateDirectory.close();
  }
  const copied = path.join(candidate, 'scripts', 'nested', 'run.js');
  assert.equal(fs.readFileSync(copied, 'utf8'), 'module.exports = true;\n');
  assert.equal(fs.statSync(copied).mode & 0o777, 0o744);
  assert.equal(fs.existsSync(path.join(candidate, 'SKILL.md')), false);
  assert.equal(fs.existsSync(path.join(candidate, 'migration-contract.json')), false);
});

test('contained atomic writes bind temporary and final-boundary identities', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-contained-cas-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const existing = path.join(root, 'existing.md');
  fs.writeFileSync(existing, 'ORIGINAL\n');
  atomicWriteContainedFile(root, existing, 'REPLACED\n');
  assert.equal(fs.readFileSync(existing, 'utf8'), 'REPLACED\n');
  fs.writeFileSync(existing, 'ORIGINAL\n');
  assert.throws(() => atomicWriteContainedFile(root, existing, 'REPLACED\n', {
    beforeCommit({ temporary }) {
      fs.rmSync(temporary);
      fs.writeFileSync(temporary, 'ATTACKER\n');
    }
  }), /temporary file (?:identity|content) changed/);
  assert.equal(fs.readFileSync(existing, 'utf8'), 'ORIGINAL\n');

  assert.throws(() => atomicWriteContainedFile(root, existing, 'REPLACED\n', {
    beforeCommit({ temporary }) {
      fs.writeFileSync(temporary, 'MUTATED!\n');
    }
  }), /temporary file content changed/);
  assert.equal(fs.readFileSync(existing, 'utf8'), 'ORIGINAL\n');

  assert.throws(() => atomicWriteContainedFile(root, existing, 'REPLACED\n', {
    beforeInstall({ displaced }) {
      fs.writeFileSync(displaced, 'CONCURNT\n');
    }
  }), /displaced file content changed/);
  assert.equal(fs.readFileSync(existing, 'utf8'), 'CONCURNT\n');

  const missing = path.join(root, 'missing.md');
  assert.throws(() => atomicWriteContainedFile(root, missing, 'GENERATED\n', {
    beforeInstall() {
      fs.writeFileSync(missing, 'CREATED!\n');
    }
  }), /appeared during atomic installation/);
  assert.equal(fs.readFileSync(missing, 'utf8'), 'CREATED!\n');
});

test('core promotion installs a new canonical target and rolls back before install', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-new-core-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const candidates = path.join(root, 'migration', 'candidates');
  const live = path.join(root, 'plugin', 'sd0x-dev-flow-codex', 'skills');
  fs.mkdirSync(candidates, { recursive: true });
  fs.mkdirSync(live, { recursive: true });

  const candidate = path.join(candidates, 'fixture');
  const destination = path.join(live, 'fixture');
  fs.mkdirSync(candidate);
  fs.writeFileSync(path.join(candidate, 'SKILL.md'), '# accepted\n');
  const accepted = promotionTreeDigest(candidate);
  assert.throws(() => applyPromotionMoves(root, [{
    target: 'fixture', target_package: 'core', action: 'move',
    candidate, destination, payload_tree_sha256: accepted
  }], {
    beforeInstall() {
      throw new Error('stop before new core install');
    }
  }), /stop before new core install/);
  assert.equal(fs.existsSync(destination), false);
  assert.equal(promotionTreeDigest(candidate), accepted);
  assert.deepEqual(fs.readdirSync(candidates), ['fixture']);
  assert.deepEqual(fs.readdirSync(live), []);

  assert.throws(() => applyPromotionMoves(root, [{
    target: 'fixture', target_package: 'core', action: 'move',
    candidate, destination, payload_tree_sha256: accepted
  }], {
    removeCoreCandidate(directory) {
      fs.rmSync(path.join(directory, 'SKILL.md'));
      throw new Error('stop during new core cleanup');
    }
  }), /stop during new core cleanup/);
  assert.equal(fs.existsSync(destination), false);
  assert.equal(promotionTreeDigest(candidate), accepted);
  assert.deepEqual(fs.readdirSync(candidates), ['fixture']);
  assert.deepEqual(fs.readdirSync(live), []);

  applyPromotionMoves(root, [{
    target: 'fixture', target_package: 'core', action: 'move',
    candidate, destination, payload_tree_sha256: accepted
  }]);
  assert.equal(fs.existsSync(candidate), false);
  assert.equal(promotionTreeDigest(destination), accepted);
});

test('new core promotion crash recovery restores an absent destination', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-new-core-recovery-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const candidate = path.join(root, 'migration', 'candidates', 'fixture');
  const destination = path.join(
    root, 'plugin', 'sd0x-dev-flow-codex', 'skills', 'fixture'
  );
  fs.mkdirSync(candidate, { recursive: true });
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(path.join(candidate, 'SKILL.md'), '# accepted\n');
  const accepted = promotionTreeDigest(candidate);
  const modulePath = path.join(ROOT, 'scripts', 'promote-skill-wave.js');
  const result = spawnSync(process.execPath, ['-e', [
    "const { applyPromotionMoves, treeDigest } = require(process.argv[1]);",
    'const [root, candidate, destination] = process.argv.slice(2);',
    "applyPromotionMoves(root, [{target:'fixture',target_package:'core',action:'move',",
    'candidate,destination,payload_tree_sha256:treeDigest(candidate)}],',
    '{removeCoreCandidate(){process.exit(86);}});'
  ].join(''), modulePath, root, candidate, destination]);
  assert.equal(result.status, 86);
  const recovery = fs.readdirSync(path.join(root, '.sd0x'))
    .map((name) => path.join(root, '.sd0x', name))
    .find((entry) => fs.existsSync(path.join(entry, 'recovery.json')));
  assert.ok(recovery);
  recoverPromotion(root, recovery);
  assert.equal(fs.existsSync(destination), false);
  assert.equal(promotionTreeDigest(candidate), accepted);
});

test('new core promotion recovery resumes after retaining the installed payload', (t) => {
  const root = fs.mkdtempSync(path.join(
    os.tmpdir(), 'sd0x-new-core-recovery-retry-'
  ));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const candidate = path.join(root, 'migration', 'candidates', 'fixture');
  const destination = path.join(
    root, 'plugin', 'sd0x-dev-flow-codex', 'skills', 'fixture'
  );
  fs.mkdirSync(candidate, { recursive: true });
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(path.join(candidate, 'SKILL.md'), '# accepted\n');
  const accepted = promotionTreeDigest(candidate);
  const modulePath = path.join(ROOT, 'scripts', 'promote-skill-wave.js');
  const result = spawnSync(process.execPath, ['-e', [
    "const { applyPromotionMoves, treeDigest } = require(process.argv[1]);",
    'const [root, candidate, destination] = process.argv.slice(2);',
    "applyPromotionMoves(root, [{target:'fixture',target_package:'core',action:'move',",
    'candidate,destination,payload_tree_sha256:treeDigest(candidate)}],',
    '{removeCoreCandidate(){process.exit(86);}});'
  ].join(''), modulePath, root, candidate, destination]);
  assert.equal(result.status, 86);
  const recovery = fs.readdirSync(path.join(root, '.sd0x'))
    .map((name) => path.join(root, '.sd0x', name))
    .find((entry) => fs.existsSync(path.join(entry, 'recovery.json')));
  assert.ok(recovery);

  const retained = path.join(
    path.dirname(destination), 'fixture-recovery-installed'
  );
  fs.renameSync(destination, retained);
  assert.equal(promotionTreeDigest(retained), accepted);
  assert.equal(fs.existsSync(destination), false);

  recoverPromotion(root, recovery);
  assert.equal(fs.existsSync(destination), false);
  assert.equal(fs.existsSync(retained), false);
  assert.equal(promotionTreeDigest(candidate), accepted);
  assert.equal(fs.existsSync(recovery), false);
});

test('bound tree removal quarantines a same-name replacement', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-bound-remove-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const parent = path.join(root, 'parent');
  const payload = path.join(parent, 'payload');
  fs.mkdirSync(payload, { recursive: true });
  fs.writeFileSync(path.join(payload, 'FILE'), 'accepted\n');
  const bound = openBoundDirectory(parent);
  const captured = captureBoundTree(bound, 'payload', 'payload');
  const original = path.join(payload, 'FILE-original');
  let replaced = false;
  let failure;
  try {
    removeBoundTree(bound, 'payload', captured, {
      beforeEntryClaim(details) {
        if (details.name !== 'FILE' || replaced) return;
        replaced = true;
        fs.renameSync(details.path, original);
        fs.writeFileSync(details.path, 'concurrent replacement\n');
      }
    });
  } catch (error) {
    failure = error;
  } finally {
    bound.close();
  }
  assert.ok(failure);
  const retained = /replacement retained at (.+)$/.exec(failure.message)?.[1];
  assert.ok(retained, failure.message);
  assert.equal(fs.readFileSync(retained, 'utf8'), 'concurrent replacement\n');
  assert.equal(fs.readFileSync(original, 'utf8'), 'accepted\n');
});

test('bound tree removal supports maximum-length payload names', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-bound-name-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const parent = path.join(root, 'parent');
  const payload = path.join(parent, 'payload');
  const longFile = `f${'x'.repeat(239)}`;
  const longDirectory = `d${'y'.repeat(239)}`;
  fs.mkdirSync(path.join(payload, longDirectory), { recursive: true });
  fs.writeFileSync(path.join(payload, longFile), 'long file\n');
  fs.writeFileSync(path.join(payload, longDirectory, 'child'), 'long directory\n');
  const bound = openBoundDirectory(parent);
  try {
    const captured = captureBoundTree(bound, 'payload', 'payload');
    removeBoundTree(bound, 'payload', captured);
  } finally {
    bound.close();
  }
  assert.equal(fs.existsSync(payload), false);
});

test('bound tree creation closes descriptors when root reopening fails', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-bound-reopen-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const sourceParent = path.join(root, 'source-parent');
  const destinationParent = path.join(root, 'destination-parent');
  const source = path.join(sourceParent, 'source');
  fs.mkdirSync(path.join(source, 'nested'), { recursive: true });
  fs.mkdirSync(destinationParent);
  fs.writeFileSync(path.join(source, 'FILE'), 'source file\n');
  fs.writeFileSync(path.join(source, 'nested', 'CHILD'), 'nested file\n');
  const sourceBound = openBoundDirectory(sourceParent);
  const destinationBound = openBoundDirectory(destinationParent);
  t.after(() => {
    sourceBound.close();
    destinationBound.close();
  });
  const tree = captureBoundTree(sourceBound, 'source', 'source tree');

  const expectClosed = (targetName, operation) => {
    const realOpen = fs.openSync;
    const realClose = fs.closeSync;
    let descriptor;
    let closed = false;
    fs.openSync = function(name, ...args) {
      const opened = realOpen.call(this, name, ...args);
      if (name === targetName && descriptor === undefined) descriptor = opened;
      return opened;
    };
    fs.closeSync = function(opened) {
      if (opened === descriptor) closed = true;
      return realClose.call(this, opened);
    };
    try {
      assert.throws(operation,
        /bound directory changed before it could be opened/);
    } finally {
      fs.openSync = realOpen;
      fs.closeSync = realClose;
    }
    assert.notEqual(descriptor, undefined);
    assert.equal(closed, true);
  };

  const swapCreatedRoot = ({ destination }) => {
    fs.renameSync(destination, `${destination}-held`);
    fs.mkdirSync(destination);
  };
  expectClosed('written', () => writeBoundTree(
    destinationBound,
    'written',
    tree,
    { label: 'written tree', afterRootCreate: swapCreatedRoot }
  ));
  expectClosed('linked', () => linkBoundTree(
    sourceBound,
    'source',
    destinationBound,
    'linked',
    tree,
    { label: 'linked tree', afterRootCreate: swapCreatedRoot }
  ));
});

test('bound tree write and link support native Windows mode semantics', {
  skip: process.platform !== 'win32'
}, (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-bound-win32-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const sourceParent = path.join(root, 'source-parent');
  const destinationParent = path.join(root, 'destination-parent');
  const source = path.join(sourceParent, 'source');
  fs.mkdirSync(path.join(source, 'nested'), { recursive: true });
  fs.mkdirSync(destinationParent);
  fs.writeFileSync(path.join(source, 'WRITABLE'), 'writable\n');
  fs.writeFileSync(path.join(source, 'nested', 'READONLY'), 'read-only\n');
  fs.chmodSync(path.join(source, 'nested'), 0o444);
  fs.chmodSync(path.join(source, 'nested', 'READONLY'), 0o444);
  assert.equal(fs.statSync(path.join(source, 'nested')).mode & 0o200, 0);
  const sourceBound = openBoundDirectory(sourceParent);
  const destinationBound = openBoundDirectory(destinationParent);
  t.after(() => {
    sourceBound.close();
    destinationBound.close();
  });
  const tree = captureBoundTree(sourceBound, 'source', 'Windows source tree');
  writeBoundTree(destinationBound, 'written', tree, {
    label: 'Windows written tree'
  });
  linkBoundTree(sourceBound, 'source', destinationBound, 'linked', tree, {
    label: 'Windows linked tree'
  });
  for (const name of ['written', 'linked']) {
    const observed = captureBoundTree(
      destinationBound,
      name,
      `Windows ${name} tree`
    );
    assertTreeContent(observed, tree, `Windows ${name} tree`);
    assert.notEqual(observed.identity.dev, '');
    assert.notEqual(observed.identity.ino, '');
    assert.equal(fs.readFileSync(path.join(
      destinationParent, name, 'WRITABLE'
    ), 'utf8'), 'writable\n');
    assert.equal(fs.readFileSync(path.join(
      destinationParent, name, 'nested', 'READONLY'
    ), 'utf8'), 'read-only\n');
    assert.notEqual(fs.statSync(path.join(
      destinationParent, name, 'WRITABLE'
    )).mode & 0o200, 0);
    assert.equal(fs.statSync(path.join(
      destinationParent, name, 'nested', 'READONLY'
    )).mode & 0o200, 0);
  }
});

test('promotion ancestor swaps and the displaced-live crash window stay contained', (t) => {
  for (const swapped of ['destination', 'candidate']) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), `sd0x-${swapped}-ancestor-`));
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), `sd0x-${swapped}-outside-`));
    t.after(() => {
      fs.rmSync(root, { recursive: true, force: true });
      fs.rmSync(outside, { recursive: true, force: true });
    });
    const candidateParent = path.join(root, 'candidate-parent');
    const destinationParent = path.join(root, 'destination-parent');
    const candidate = path.join(candidateParent, 'candidate');
    const destination = path.join(destinationParent, 'live');
    fs.mkdirSync(candidate, { recursive: true });
    fs.mkdirSync(destination, { recursive: true });
    fs.writeFileSync(path.join(candidate, 'SKILL.md'), '# accepted\n');
    fs.writeFileSync(path.join(destination, 'SKILL.md'), '# prior\n');
    fs.writeFileSync(path.join(outside, 'KEEP'), 'outside unchanged\n');
    const accepted = promotionTreeDigest(candidate);
    const swapParent = swapped === 'destination'
      ? destinationParent
      : candidateParent;
    assert.throws(() => applyPromotionMoves(root, [{
      target: 'fixture',
      target_package: 'core',
      payload_tree_sha256: accepted,
      action: 'move',
      candidate,
      destination
    }], {
      beforeInstall() {
        fs.renameSync(swapParent, `${swapParent}-real`);
        fs.symlinkSync(outside, swapParent);
      }
    }), /rollback was incomplete|promotion directory identity changed|only real directories|bound directory changed/);
    assert.deepEqual(fs.readdirSync(outside), ['KEEP']);
    assert.equal(fs.readFileSync(path.join(outside, 'KEEP'), 'utf8'),
      'outside unchanged\n');
  }

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-displace-crash-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const candidate = path.join(root, 'candidate');
  const destination = path.join(root, 'live');
  fs.mkdirSync(candidate);
  fs.mkdirSync(destination);
  fs.writeFileSync(path.join(candidate, 'SKILL.md'), '# accepted\n');
  fs.writeFileSync(path.join(destination, 'SKILL.md'), '# prior\n');
  const accepted = promotionTreeDigest(candidate);
  const prior = promotionTreeDigest(destination);
  assert.throws(() => applyPromotionMoves(root, [{
    target: 'fixture',
    target_package: 'core',
    payload_tree_sha256: accepted,
    action: 'move',
    candidate,
    destination
  }], {
    afterDisplace() {
      throw new Error('injected crash after live displacement');
    }
  }), /injected crash after live displacement/);
  assert.equal(promotionTreeDigest(destination), prior);
  assert.equal(promotionTreeDigest(candidate), accepted);
});

test('captured-tree copy rejects a nested destination directory swap before writing', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-copy-bound-'));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-copy-outside-'));
  t.after(() => {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  });
  const source = path.join(root, 'source');
  const destination = path.join(root, 'destination');
  fs.mkdirSync(path.join(source, 'nested'), { recursive: true });
  fs.writeFileSync(path.join(source, 'nested', 'payload.txt'), 'accepted\n');

  assert.throws(() => copyCapturedTree(
    source,
    destination,
    captureRegularTree(source),
    {
      afterDestinationDirectoryCreate({ relative, destination: created }) {
        if (relative !== 'nested') return;
        fs.renameSync(created, `${created}-real`);
        fs.symlinkSync(outside, created);
      }
    }
  ), /bound directory changed before it could be opened/);
  assert.deepEqual(fs.readdirSync(outside), []);
});

test('promotion rejects recovery-directory restoration through a swapped pathname', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-recovery-restore-'));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-recovery-restore-outside-'));
  t.after(() => {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  });
  const candidate = path.join(root, 'candidate');
  const destination = path.join(root, 'live');
  fs.mkdirSync(candidate);
  fs.mkdirSync(destination);
  fs.writeFileSync(path.join(candidate, 'SKILL.md'), '# accepted\n');
  fs.writeFileSync(path.join(destination, 'SKILL.md'), '# prior\n');
  fs.writeFileSync(path.join(outside, 'KEEP'), 'outside unchanged\n');
  let recovery;
  let swapped = false;

  assert.throws(() => applyPromotionMoves(root, [{
    target: 'fixture', target_package: 'core', action: 'move',
    candidate, destination,
    payload_tree_sha256: promotionTreeDigest(candidate)
  }], {
    onTemporary(directory) {
      recovery = directory;
    },
    beforeRecoveryBackupWrite() {
      if (swapped) return;
      swapped = true;
      fs.renameSync(recovery, `${recovery}-real`);
      fs.symlinkSync(outside, recovery);
    }
  }), /bound previous directory changed before restore|Recovery directory changed/);
  assert.equal(fs.readFileSync(path.join(outside, 'KEEP'), 'utf8'),
    'outside unchanged\n');
  assert.deepEqual(fs.readdirSync(outside), ['KEEP']);
});

test('promotion preserves same-size edits and supports crash recovery', (t) => {
  const fixture = (prefix) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    const candidate = path.join(root, 'candidate');
    const destination = path.join(root, 'live');
    fs.mkdirSync(candidate);
    fs.mkdirSync(destination);
    fs.writeFileSync(path.join(candidate, 'SKILL.md'), '# accepted\n');
    fs.writeFileSync(path.join(destination, 'SKILL.md'), '# original\n');
    return { root, candidate, destination };
  };

  const before = fixture('sd0x-promotion-same-size-');
  t.after(() => fs.rmSync(before.root, { recursive: true, force: true }));
  assert.throws(() => applyPromotionMoves(before.root, [{
    target: 'fixture', target_package: 'core', action: 'move',
    candidate: before.candidate, destination: before.destination,
    payload_tree_sha256: promotionTreeDigest(before.candidate)
  }], {
    beforeInstall() {
      fs.writeFileSync(path.join(before.destination, 'SKILL.md'), '# CONCURNT\n');
    }
  }), /payload tree identity changed/);
  assert.equal(fs.readFileSync(path.join(before.destination, 'SKILL.md'), 'utf8'),
    '# CONCURNT\n');

  const displaced = fixture('sd0x-promotion-displaced-edit-');
  t.after(() => fs.rmSync(displaced.root, { recursive: true, force: true }));
  assert.throws(() => applyPromotionMoves(displaced.root, [{
    target: 'fixture', target_package: 'core', action: 'move',
    candidate: displaced.candidate, destination: displaced.destination,
    payload_tree_sha256: promotionTreeDigest(displaced.candidate)
  }], {
    afterDisplace(_move, details) {
      fs.writeFileSync(path.join(details.displaced, 'SKILL.md'), '# CONCURNT\n');
    }
  }), /payload tree identity changed/);
  assert.equal(fs.readFileSync(path.join(displaced.destination, 'SKILL.md'), 'utf8'),
    '# CONCURNT\n');

  const crashed = fixture('sd0x-promotion-crash-cut-');
  t.after(() => fs.rmSync(crashed.root, { recursive: true, force: true }));
  const modulePath = path.join(ROOT, 'scripts', 'promote-skill-wave.js');
  const result = spawnSync(process.execPath, ['-e', [
    "const { applyPromotionMoves, treeDigest } = require(process.argv[1]);",
    'const [root, candidate, destination] = process.argv.slice(2);',
    "applyPromotionMoves(root, [{target:'fixture',target_package:'core',action:'move',",
    'candidate,destination,payload_tree_sha256:treeDigest(candidate)}],',
    '{afterDisplace(){process.exit(86);}});'
  ].join('\n'), modulePath, crashed.root, crashed.candidate, crashed.destination], {
    encoding: 'utf8'
  });
  assert.equal(result.status, 86, result.stderr || result.stdout);
  const recoveryName = fs.readdirSync(path.join(crashed.root, '.sd0x'))
    .find((name) => name.startsWith('wave-promotion-'));
  assert.ok(recoveryName);
  const recovery = path.join(crashed.root, '.sd0x', recoveryName);
  assert.equal(fs.existsSync(path.join(recovery, 'recovery.json')), true);
  assert.equal(fs.existsSync(crashed.destination), false);
  const recovered = spawnSync(process.execPath, [modulePath, '--recover', recovery], {
    encoding: 'utf8'
  });
  assert.equal(recovered.status, 0, recovered.stderr || recovered.stdout);
  assert.deepEqual(JSON.parse(recovered.stdout), { recovered: true, moves: 1 });
  assert.equal(fs.readFileSync(path.join(crashed.destination, 'SKILL.md'), 'utf8'),
    '# original\n');

  const lost = fixture('sd0x-promotion-lost-displaced-');
  t.after(() => fs.rmSync(lost.root, { recursive: true, force: true }));
  const lostResult = spawnSync(process.execPath, ['-e', [
    "const { applyPromotionMoves, treeDigest } = require(process.argv[1]);",
    'const [root, candidate, destination] = process.argv.slice(2);',
    "applyPromotionMoves(root, [{target:'fixture',target_package:'core',action:'move',",
    'candidate,destination,payload_tree_sha256:treeDigest(candidate)}],',
    '{afterDisplace(){process.exit(86);}});'
  ].join('\n'), modulePath, lost.root, lost.candidate, lost.destination], {
    encoding: 'utf8'
  });
  assert.equal(lostResult.status, 86, lostResult.stderr || lostResult.stdout);
  const lostRecoveryName = fs.readdirSync(path.join(lost.root, '.sd0x'))
    .find((name) => name.startsWith('wave-promotion-'));
  const lostRecovery = path.join(lost.root, '.sd0x', lostRecoveryName);
  const manifest = JSON.parse(fs.readFileSync(
    path.join(lostRecovery, 'recovery.json'), 'utf8'
  ));
  fs.rmSync(path.join(path.dirname(lost.destination), manifest.moves[0].displaced), {
    recursive: true
  });
  const refused = spawnSync(process.execPath,
    [modulePath, '--recover', lostRecovery], { encoding: 'utf8' });
  assert.notEqual(refused.status, 0, refused.stdout);
  assert.match(refused.stderr, /lost both live and displaced payloads/);
  assert.equal(fs.existsSync(lostRecovery), true);
  assert.equal(fs.existsSync(lost.destination), false);
});

test('promotion recovery preflights candidate artifacts before mutating live state', (t) => {
  const modulePath = path.join(ROOT, 'scripts', 'promote-skill-wave.js');
  for (const corruption of ['missing', 'corrupt']) {
    const root = fs.mkdtempSync(path.join(
      os.tmpdir(), `sd0x-recovery-preflight-${corruption}-`
    ));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const candidate = path.join(root, 'candidate');
    const destination = path.join(root, 'live');
    fs.mkdirSync(candidate);
    fs.mkdirSync(destination);
    fs.writeFileSync(path.join(candidate, 'SKILL.md'), '# accepted\n');
    fs.writeFileSync(path.join(destination, 'SKILL.md'), '# original\n');
    const result = spawnSync(process.execPath, ['-e', [
      "const fs = require('node:fs');",
      "const { applyPromotionMoves, treeDigest } = require(process.argv[1]);",
      'const [root, candidate, destination] = process.argv.slice(2);',
      "applyPromotionMoves(root, [{target:'fixture',target_package:'core',action:'move',",
      'candidate,destination,payload_tree_sha256:treeDigest(candidate)}],',
      '{removeCoreCandidate(value){',
      "fs.renameSync(value, `${value}-survivor`); process.exit(86); }});"
    ].join('\n'), modulePath, root, candidate, destination], {
      encoding: 'utf8'
    });
    assert.equal(result.status, 86, result.stderr || result.stdout);
    const recoveryName = fs.readdirSync(path.join(root, '.sd0x'))
      .find((name) => name.startsWith('wave-promotion-'));
    const recovery = path.join(root, '.sd0x', recoveryName);
    const manifest = JSON.parse(fs.readFileSync(
      path.join(recovery, 'recovery.json'), 'utf8'
    ));
    const move = manifest.moves[0];
    const displaced = path.join(path.dirname(destination), move.displaced);
    const sibling = path.join(path.dirname(candidate), move.candidate_sibling_backup);
    const survivor = `${candidate}-survivor`;
    const before = {
      destination: promotionTreeDigest(destination),
      displaced: promotionTreeDigest(displaced),
      sibling: promotionTreeDigest(sibling),
      survivor: promotionTreeDigest(survivor)
    };
    const candidateBackup = path.join(recovery, move.candidate_backup);
    if (corruption === 'missing') {
      fs.rmSync(candidateBackup, { recursive: true });
    } else {
      fs.writeFileSync(path.join(candidateBackup, 'SKILL.md'), '# TAMPERED\n');
    }
    const refused = spawnSync(process.execPath,
      [modulePath, '--recover', recovery], { encoding: 'utf8' });
    assert.notEqual(refused.status, 0, refused.stdout);
    assert.match(refused.stderr,
      /core recovery candidate backup is (?:unavailable|invalid)/);
    assert.equal(promotionTreeDigest(destination), before.destination);
    assert.equal(promotionTreeDigest(displaced), before.displaced);
    assert.equal(promotionTreeDigest(sibling), before.sibling);
    assert.equal(promotionTreeDigest(survivor), before.survivor);
    assert.equal(fs.existsSync(candidate), false);
    assert.equal(fs.existsSync(recovery), true);
  }
});

test('non-core rollback rejects swapped ancestors without external writes', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-pack-rollback-'));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-pack-outside-'));
  t.after(() => {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  });
  const candidateParent = path.join(root, 'candidates');
  const destinationParent = path.join(root, 'packs');
  fs.mkdirSync(candidateParent);
  fs.mkdirSync(destinationParent);
  fs.writeFileSync(path.join(outside, 'KEEP'), 'outside unchanged\n');
  const moves = ['alpha', 'beta'].map((target) => {
    const candidate = path.join(candidateParent, target);
    fs.mkdirSync(candidate);
    fs.writeFileSync(path.join(candidate, 'SKILL.md'), `# ${target}\n`);
    return {
      target,
      target_package: 'quality-pack',
      action: 'move',
      candidate,
      destination: path.join(destinationParent, target),
      payload_tree_sha256: promotionTreeDigest(candidate)
    };
  });
  let calls = 0;
  assert.throws(() => applyPromotionMoves(root, moves, {
    beforeInstall() {
      calls += 1;
      if (calls === 2) {
        fs.renameSync(destinationParent, `${destinationParent}-real`);
        fs.symlinkSync(outside, destinationParent);
      }
    }
  }), /rollback was incomplete|promotion directory identity changed/);
  assert.deepEqual(fs.readdirSync(outside), ['KEEP']);
  assert.equal(fs.readFileSync(path.join(outside, 'KEEP'), 'utf8'),
    'outside unchanged\n');
});

test('core promotion retains complete backups when rollback itself fails', (t) => {
  const initialCwd = process.cwd();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-core-recovery-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const candidate = path.join(root, 'candidate');
  const destination = path.join(root, 'live');
  fs.mkdirSync(candidate, { recursive: true });
  fs.mkdirSync(destination, { recursive: true });
  fs.writeFileSync(path.join(candidate, 'SKILL.md'), '# accepted\n');
  fs.writeFileSync(path.join(candidate, 'contract.json'), '{"accepted":true}\n');
  fs.writeFileSync(path.join(destination, 'SKILL.md'), '# prior\n');
  const accepted = promotionTreeDigest(candidate);
  const prior = promotionTreeDigest(destination);
  const moves = [{
    target: 'fixture',
    target_package: 'core',
    payload_tree_sha256: accepted,
    action: 'move',
    candidate,
    destination
  }];

  let failure;
  try {
    applyPromotionMoves(root, moves, {
      removeCoreCandidate(directory) {
        fs.rmSync(path.join(directory, 'SKILL.md'));
        throw new Error('injected cleanup failure');
      },
      restoreTree(source, target, kind) {
        if (kind === 'live') throw new Error('injected live restore failure');
        fs.cpSync(source, target, { recursive: true });
      }
    });
  } catch (error) {
    failure = error;
  }
  assert.ok(failure);
  assert.match(failure.message, /rollback was incomplete; recovery retained at/);
  const recovery = /recovery retained at ([^;]+)/.exec(failure.message)?.[1];
  assert.ok(recovery);
  assert.equal(path.relative(root, recovery).split(path.sep)[0], '.sd0x');
  assert.equal(fs.existsSync(path.join(recovery, 'recovery.json')), true);
  assert.equal(promotionTreeDigest(path.join(recovery, 'fixture-live')), prior);
  assert.equal(promotionTreeDigest(path.join(
    recovery, 'fixture-candidate'
  )), accepted);
  assert.equal(promotionTreeDigest(candidate), accepted);
  const observed = spawnSync(process.execPath, ['-e', [
    "const fs = require('node:fs');",
    "const path = require('node:path');",
    'const recovery = process.argv[1];',
    "for (const name of ['fixture-live', 'fixture-candidate', 'recovery.json']) {",
    '  if (!fs.existsSync(path.join(recovery, name))) process.exit(2);',
    '}'
  ].join('\n'), recovery], { encoding: 'utf8' });
  assert.equal(observed.status, 0, observed.stderr || observed.stdout);
  assert.equal(process.cwd(), initialCwd);
});

test('promotion and restaging reject symlinked recovery paths before mutation', (t) => {
  const initialCwd = process.cwd();
  const promotionRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-promotion-root-'));
  const restage = restageFixtureRoot();
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-recovery-outside-'));
  t.after(() => {
    fs.rmSync(promotionRoot, { recursive: true, force: true });
    fs.rmSync(restage.workspace, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  });

  const candidate = path.join(promotionRoot, 'candidate');
  const destination = path.join(promotionRoot, 'live');
  fs.mkdirSync(candidate);
  fs.mkdirSync(destination);
  fs.writeFileSync(path.join(candidate, 'SKILL.md'), '# accepted\n');
  fs.writeFileSync(path.join(destination, 'SKILL.md'), '# prior\n');
  const accepted = promotionTreeDigest(candidate);
  const prior = promotionTreeDigest(destination);
  fs.symlinkSync(outside, path.join(promotionRoot, '.sd0x'));
  assert.throws(() => applyPromotionMoves(promotionRoot, [{
    target: 'fixture',
    target_package: 'core',
    payload_tree_sha256: accepted,
    action: 'move',
    candidate,
    destination
  }]), /Recovery root \.sd0x must be a real directory/);
  assert.equal(process.cwd(), initialCwd);
  assert.equal(promotionTreeDigest(candidate), accepted);
  assert.equal(promotionTreeDigest(destination), prior);
  assert.deepEqual(fs.readdirSync(outside), []);

  const relative = 'plugin/sd0x-dev-flow-codex/skills/review/SKILL.md';
  const live = fs.readFileSync(path.join(restage.root, relative));
  fs.symlinkSync(outside, path.join(restage.root, '.sd0x'));
  assert.throws(() => restageCoreCandidate(restage.root, 'review'),
    /Recovery root \.sd0x must be a real directory/);
  assert.equal(process.cwd(), initialCwd);
  assert.deepEqual(fs.readFileSync(path.join(restage.root, relative)), live);
  assert.equal(fs.existsSync(path.join(
    restage.root, 'migration/candidates/review'
  )), false);
  assert.deepEqual(fs.readdirSync(outside), []);

  fs.rmSync(path.join(restage.root, '.sd0x'));
  fs.symlinkSync(path.join(outside, 'missing'), path.join(restage.root, '.sd0x'));
  assert.throws(() => restageCoreCandidate(restage.root, 'review'),
    /Recovery root \.sd0x must be a real directory/);
  assert.equal(process.cwd(), initialCwd);
  assert.deepEqual(fs.readFileSync(path.join(restage.root, relative)), live);
  assert.equal(fs.existsSync(path.join(
    restage.root, 'migration/candidates/review'
  )), false);
  assert.deepEqual(fs.readdirSync(outside), []);
  assert.equal(process.cwd(), initialCwd);
});

test('recovery child replacement fails closed without external writes', (t) => {
  const initialCwd = process.cwd();
  const restage = restageFixtureRoot();
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-recovery-child-'));
  t.after(() => {
    fs.rmSync(restage.workspace, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  });
  assert.throws(() => restageCoreCandidate(restage.root, 'review', {
    onTemporary(directory) {
      fs.rmSync(directory, { recursive: true });
      fs.symlinkSync(outside, directory);
    }
  }), /Recovery directory changed before it could be bound/);
  assert.equal(fs.existsSync(path.join(
    restage.root, 'migration/candidates/review'
  )), false);
  assert.deepEqual(fs.readdirSync(outside), []);
  assert.equal(process.cwd(), initialCwd);
});

test('bound recovery creation and removal ignore swapped ancestors', (t) => {
  const initialCwd = process.cwd();
  const createSwap = restageFixtureRoot();
  const removeSwap = restageFixtureRoot();
  const createOutside =
    fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-create-swap-'));
  const removeOutside =
    fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-remove-swap-'));
  t.after(() => {
    fs.rmSync(createSwap.workspace, { recursive: true, force: true });
    fs.rmSync(removeSwap.workspace, { recursive: true, force: true });
    fs.rmSync(createOutside, { recursive: true, force: true });
    fs.rmSync(removeOutside, { recursive: true, force: true });
  });

  const createLive = fs.readFileSync(path.join(
    createSwap.root, 'plugin/sd0x-dev-flow-codex/skills/review/SKILL.md'
  ));
  assert.throws(() => restageCoreCandidate(createSwap.root, 'review', {
    beforeRecoveryCreate(recoveryRoot) {
      fs.renameSync(recoveryRoot, `${recoveryRoot}-held`);
      fs.symlinkSync(createOutside, recoveryRoot);
    }
  }), /Recovery root \.sd0x must be a real directory/);
  assert.equal(process.cwd(), initialCwd);
  assert.deepEqual(fs.readdirSync(createOutside), []);
  assert.deepEqual(fs.readFileSync(path.join(
    createSwap.root, 'plugin/sd0x-dev-flow-codex/skills/review/SKILL.md'
  )), createLive);
  assert.equal(fs.existsSync(path.join(
    createSwap.root, 'migration/candidates/review'
  )), false);

  let externalMarker;
  const result = restageCoreCandidate(removeSwap.root, 'review', {
    beforeRecoveryRemove(recoveryRoot, name) {
      externalMarker = path.join(removeOutside, name, 'keep.txt');
      fs.mkdirSync(path.dirname(externalMarker));
      fs.writeFileSync(externalMarker, 'external\n');
      fs.renameSync(recoveryRoot, `${recoveryRoot}-held`);
      fs.symlinkSync(removeOutside, recoveryRoot);
    }
  });
  assert.equal(process.cwd(), initialCwd);
  assert.equal(result.ok, true);
  assert.equal(fs.readFileSync(externalMarker, 'utf8'), 'external\n');
  assert.equal(process.cwd(), initialCwd);
});

test('cross-device recovery fails before candidate mutation', (t) => {
  const initialCwd = process.cwd();
  const values = restageFixtureRoot();
  t.after(() => fs.rmSync(values.workspace, { recursive: true, force: true }));
  const livePath = path.join(
    values.root, 'plugin/sd0x-dev-flow-codex/skills/review/SKILL.md'
  );
  const live = fs.readFileSync(livePath);
  assert.throws(() => restageCoreCandidate(values.root, 'review', {
    recoveryDeviceOf(target) {
      return target === values.root ? 1 : 2;
    }
  }), /must share the repository filesystem/);
  assert.deepEqual(fs.readFileSync(livePath), live);
  assert.equal(fs.existsSync(path.join(
    values.root, 'migration/candidates/review'
  )), false);
  assert.equal(process.cwd(), initialCwd);
});
