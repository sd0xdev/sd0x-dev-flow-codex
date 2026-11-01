'use strict';

const {
  assert,
  fs,
  os,
  path,
  test,
  withPreparedCandidateDirectory,
  promotionTreeDigest,
  restageCoreCandidate,
  commit,
  git,
  initRepository,
  restageFixtureRoot
} = require('../helpers/migration-context');

test('core restaging ignores hostile Git selectors and rejects symlinked managed paths', (t) => {
  const initialCwd = process.cwd();
  const values = restageFixtureRoot();
  const decoy = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-restage-decoy-'));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-restage-outside-'));
  t.after(() => {
    fs.rmSync(values.workspace, { recursive: true, force: true });
    fs.rmSync(decoy, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  });
  initRepository(decoy);
  const relative = 'plugin/sd0x-dev-flow-codex/skills/review';
  const decoyReview = path.join(decoy, relative);
  fs.mkdirSync(decoyReview, { recursive: true });
  fs.writeFileSync(path.join(decoyReview, 'SKILL.md'), '# decoy\n');
  git(decoy, ['add', '.']);
  commit(decoy, 'decoy');

  const liveSkill = path.join(values.root, relative, 'SKILL.md');
  const acceptedBytes = fs.readFileSync(liveSkill);
  const committedBytes = git(values.root, ['show', `HEAD:${relative}/SKILL.md`]);
  const selectors = {
    GIT_ALTERNATE_OBJECT_DIRECTORIES: path.join(decoy, '.git', 'objects'),
    GIT_COMMON_DIR: path.join(decoy, '.git'),
    GIT_DIR: path.join(decoy, '.git'),
    GIT_INDEX_FILE: path.join(decoy, '.git', 'index'),
    GIT_NAMESPACE: 'hostile',
    GIT_OBJECT_DIRECTORY: path.join(decoy, '.git', 'objects'),
    GIT_WORK_TREE: decoy
  };
  const prior = Object.fromEntries(Object.keys(selectors).map((key) => [
    key, process.env[key]
  ]));
  let temporary;
  try {
    Object.assign(process.env, selectors);
    restageCoreCandidate(values.root, 'review', {
      onTemporary(directory) {
        temporary = directory;
      }
    });
  } finally {
    for (const [key, value] of Object.entries(prior)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
  assert.deepEqual(
    fs.readFileSync(path.join(values.root, 'migration/candidates/review/SKILL.md')),
    acceptedBytes
  );
  assert.deepEqual(fs.readFileSync(liveSkill), committedBytes);
  assert.equal(path.relative(values.root, temporary).split(path.sep)[0], '.sd0x');
  assert.equal(fs.existsSync(temporary), false);

  fs.rmSync(path.join(values.root, 'migration/candidates/review'), {
    recursive: true,
    force: true
  });
  const outsideCandidate = path.join(outside, 'candidate');
  fs.mkdirSync(outsideCandidate);
  fs.symlinkSync(outsideCandidate, path.join(
    values.root, 'migration/candidates/review'
  ));
  assert.throws(() => restageCoreCandidate(values.root, 'review'),
    /managed path must contain only real directories/);
  assert.deepEqual(fs.readdirSync(outsideCandidate), []);

  fs.rmSync(path.join(values.root, 'migration/candidates/review'));
  const candidatesAncestor = path.join(values.root, 'migration/candidates');
  fs.rmSync(candidatesAncestor, { recursive: true, force: true });
  const outsideCandidatesAncestor = path.join(outside, 'candidates');
  fs.mkdirSync(outsideCandidatesAncestor);
  fs.symlinkSync(outsideCandidatesAncestor, candidatesAncestor);
  assert.throws(() => restageCoreCandidate(values.root, 'review'),
    /managed path must contain only real directories/);
  assert.deepEqual(fs.readdirSync(outsideCandidatesAncestor), []);
  fs.rmSync(candidatesAncestor);
  fs.writeFileSync(candidatesAncestor, 'not a directory\n');
  assert.throws(() => restageCoreCandidate(values.root, 'review'),
    /managed path must contain only real directories/);
  fs.rmSync(candidatesAncestor);
  fs.mkdirSync(candidatesAncestor);

  const outsideLive = path.join(outside, 'live');
  fs.mkdirSync(outsideLive);
  fs.writeFileSync(path.join(outsideLive, 'SKILL.md'), '# outside\n');
  fs.rmSync(path.join(values.root, relative), { recursive: true, force: true });
  fs.symlinkSync(outsideLive, path.join(values.root, relative));
  assert.throws(() => restageCoreCandidate(values.root, 'review'),
    /managed path must contain only real directories/);
  assert.equal(fs.readFileSync(path.join(outsideLive, 'SKILL.md'), 'utf8'), '# outside\n');
  assert.equal(process.cwd(), initialCwd);
});

test('core restaging restores accepted live bytes after a recoverable install failure', (t) => {
  const initialCwd = process.cwd();
  const values = restageFixtureRoot();
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-install-outside-'));
  t.after(() => {
    fs.rmSync(values.workspace, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  });
  const relative = 'plugin/sd0x-dev-flow-codex/skills/review';
  const live = path.join(values.root, relative);
  const accepted = fs.readFileSync(path.join(live, 'SKILL.md'));
  const marker = path.join(outside, 'keep.txt');
  fs.writeFileSync(marker, 'external\n');
  let temporary;

  assert.throws(() => restageCoreCandidate(values.root, 'review', {
    onTemporary(directory) {
      temporary = directory;
    },
    afterLiveRemoval() {
      throw new Error('injected install failure');
    }
  }), (error) => error.message === 'injected install failure');
  assert.deepEqual(fs.readFileSync(path.join(live, 'SKILL.md')), accepted);
  assert.equal(fs.existsSync(path.join(
    values.root, 'migration/candidates/review'
  )), false);
  assert.equal(fs.existsSync(temporary), false);
  assert.equal(fs.readFileSync(marker, 'utf8'), 'external\n');
  assert.equal(process.cwd(), initialCwd);
});

test('core restaging preserves an open-descriptor edit after live removal', (t) => {
  const initialCwd = process.cwd();
  const values = restageFixtureRoot();
  t.after(() => fs.rmSync(values.workspace, { recursive: true, force: true }));
  assert.equal(fs.existsSync(path.join(
    values.root, 'migration/candidates'
  )), false);
  const relative = 'plugin/sd0x-dev-flow-codex/skills/review';
  const candidateRelative = 'migration/candidates/review/SKILL.md';
  const liveSkill = path.join(values.root, relative, 'SKILL.md');
  const accepted = fs.readFileSync(liveSkill, 'utf8');
  const concurrent = '\nConcurrent user edit.\n';
  const descriptor = fs.openSync(liveSkill, 'a');
  t.after(() => fs.closeSync(descriptor));
  assert.equal(restageCoreCandidate(values.root, 'review', {
    beforeCandidatePublish() {
      assert.throws(() => withPreparedCandidateDirectory(
        values.root, 'review', () => {}
      ), /candidate transaction is already active/);
    },
    afterLiveRemoval() {
      fs.writeSync(descriptor, concurrent);
    }
  }).ok, true);
  assert.equal(
    fs.readFileSync(path.join(values.root, candidateRelative), 'utf8'),
    accepted + concurrent
  );
  assert.deepEqual(
    fs.readFileSync(liveSkill),
    git(values.root, ['show', `HEAD:${relative}/SKILL.md`])
  );
  assert.equal(process.cwd(), initialCwd);
});

test('core restaging supports maximum-length accepted payload names', (t) => {
  const values = restageFixtureRoot();
  t.after(() => fs.rmSync(values.workspace, { recursive: true, force: true }));
  const live = path.join(
    values.root,
    'plugin/sd0x-dev-flow-codex/skills/review'
  );
  const longFile = `f${'x'.repeat(239)}`;
  const longDirectory = `d${'y'.repeat(239)}`;
  fs.mkdirSync(path.join(live, longDirectory));
  fs.writeFileSync(path.join(live, longFile), 'long file\n');
  fs.writeFileSync(path.join(live, longDirectory, 'child'), 'long directory\n');

  assert.equal(restageCoreCandidate(values.root, 'review').ok, true);
  const candidate = path.join(values.root, 'migration', 'candidates', 'review');
  assert.equal(fs.readFileSync(path.join(candidate, longFile), 'utf8'), 'long file\n');
  assert.equal(fs.readFileSync(path.join(
    candidate, longDirectory, 'child'
  ), 'utf8'), 'long directory\n');
});

test('core restaging restores an untracked accepted target to absent HEAD state', (t) => {
  const values = restageFixtureRoot();
  t.after(() => fs.rmSync(values.workspace, { recursive: true, force: true }));
  const target = 'untracked-core';
  const live = path.join(
    values.root, 'plugin', 'sd0x-dev-flow-codex', 'skills', target
  );
  fs.mkdirSync(path.join(live, 'references'), { recursive: true });
  fs.writeFileSync(path.join(live, 'SKILL.md'), '# accepted untracked\n');
  fs.writeFileSync(path.join(live, 'references', 'guide.md'), '# guide\n');
  const accepted = promotionTreeDigest(live);

  const result = restageCoreCandidate(values.root, target);
  const candidate = path.join(values.root, 'migration', 'candidates', target);
  assert.equal(result.ok, true);
  assert.equal(result.restored_live, null);
  assert.equal(result.restored_live_absent, true);
  assert.equal(fs.existsSync(live), false);
  assert.equal(promotionTreeDigest(candidate), accepted);
});

test('untracked core restaging rolls accepted bytes back after a failed removal', (t) => {
  const values = restageFixtureRoot();
  t.after(() => fs.rmSync(values.workspace, { recursive: true, force: true }));
  const target = 'untracked-core';
  const live = path.join(
    values.root, 'plugin', 'sd0x-dev-flow-codex', 'skills', target
  );
  fs.mkdirSync(live, { recursive: true });
  fs.writeFileSync(path.join(live, 'SKILL.md'), '# accepted untracked\n');
  const accepted = fs.readFileSync(path.join(live, 'SKILL.md'));

  assert.throws(() => restageCoreCandidate(values.root, target, {
    afterLiveRemoval() {
      throw new Error('untracked removal cut');
    }
  }), /untracked removal cut/);
  assert.deepEqual(fs.readFileSync(path.join(live, 'SKILL.md')), accepted);
  assert.equal(fs.existsSync(path.join(
    values.root, 'migration', 'candidates', target
  )), false);
});

test('core restaging applies exact modes independently of the caller umask', (t) => {
  const values = restageFixtureRoot();
  t.after(() => fs.rmSync(values.workspace, { recursive: true, force: true }));
  const live = path.join(
    values.root,
    'plugin/sd0x-dev-flow-codex/skills/review'
  );
  const liveSkill = path.join(live, 'SKILL.md');
  const references = path.join(live, 'references');
  fs.chmodSync(live, 0o751);
  fs.chmodSync(liveSkill, 0o640);
  fs.chmodSync(references, 0o750);

  const previousUmask = process.umask(0o077);
  try {
    assert.equal(restageCoreCandidate(values.root, 'review').ok, true);
  } finally {
    process.umask(previousUmask);
  }

  const candidate = path.join(values.root, 'migration', 'candidates', 'review');
  const mode = (name) => fs.statSync(name).mode & 0o777;
  assert.equal(mode(candidate), 0o751);
  assert.equal(mode(path.join(candidate, 'SKILL.md')), 0o640);
  assert.equal(mode(path.join(candidate, 'references')), 0o750);
  assert.equal(mode(live), 0o751);
  assert.equal(mode(path.join(live, 'SKILL.md')), 0o644);
  assert.equal(mode(path.join(live, 'references')), 0o755);
});

test('core restaging binds a newly created candidates parent', (t) => {
  const initialCwd = process.cwd();
  const values = restageFixtureRoot();
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-candidates-swap-'));
  t.after(() => {
    fs.rmSync(values.workspace, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  });
  const migration = path.join(values.root, 'migration');
  assert.throws(() => restageCoreCandidate(values.root, 'review', {
    beforeCandidatesCreate() {
      fs.renameSync(migration, `${migration}-held`);
      fs.symlinkSync(outside, migration);
    }
  }), /managed path must contain only real directories|bound directory changed before it could be entered|candidate parent changed during the transaction/);
  assert.deepEqual(fs.readdirSync(outside), []);
  assert.equal(process.cwd(), initialCwd);
});

test('core restaging never removes candidates created by a pre-move race', (t) => {
  const initialCwd = process.cwd();
  const concurrent = restageFixtureRoot();
  const swapped = restageFixtureRoot();
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-candidate-race-'));
  t.after(() => {
    fs.rmSync(concurrent.workspace, { recursive: true, force: true });
    fs.rmSync(swapped.workspace, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  });

  const concurrentCandidate = path.join(
    concurrent.root, 'migration/candidates/review'
  );
  assert.throws(() => restageCoreCandidate(concurrent.root, 'review', {
    onTemporary() {
      fs.mkdirSync(concurrentCandidate);
      fs.writeFileSync(path.join(concurrentCandidate, 'KEEP'), 'concurrent\n');
    }
  }), /candidate appeared before publication|managed directory must be absent/);
  assert.equal(fs.readFileSync(path.join(
    concurrentCandidate, 'KEEP'
  ), 'utf8'), 'concurrent\n');

  const outsideCandidate = path.join(outside, 'review');
  fs.mkdirSync(outsideCandidate);
  fs.writeFileSync(path.join(outsideCandidate, 'KEEP'), 'external\n');
  const candidates = path.join(swapped.root, 'migration/candidates');
  assert.throws(() => restageCoreCandidate(swapped.root, 'review', {
    onTemporary() {
      fs.renameSync(candidates, `${candidates}-held`);
      fs.symlinkSync(outside, candidates);
    }
  }), /managed path must contain only real directories|bound directory changed before it could be entered|candidate parent changed during the transaction/);
  assert.equal(fs.readFileSync(path.join(
    outsideCandidate, 'KEEP'
  ), 'utf8'), 'external\n');
  assert.equal(process.cwd(), initialCwd);
});

test('core restaging retains accepted recovery after parent namespace swaps', (t) => {
  const initialCwd = process.cwd();
  const liveSwap = restageFixtureRoot();
  const candidateSwap = restageFixtureRoot();
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-parent-swap-'));
  t.after(() => {
    fs.rmSync(liveSwap.workspace, { recursive: true, force: true });
    fs.rmSync(candidateSwap.workspace, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  });

  const liveAccepted = fs.readFileSync(path.join(
    liveSwap.root, 'plugin/sd0x-dev-flow-codex/skills/review/SKILL.md'
  ));
  const skills = path.join(
    liveSwap.root, 'plugin/sd0x-dev-flow-codex/skills'
  );
  let liveFailure;
  try {
    restageCoreCandidate(liveSwap.root, 'review', {
      afterRestoredRootCreate() {
        fs.renameSync(skills, `${skills}-held`);
        fs.symlinkSync(outside, skills);
      }
    });
  } catch (error) {
    liveFailure = error;
  }
  assert.ok(liveFailure);
  const liveRecovery = /accepted payload recovery retained at ([^; ]+)/
    .exec(liveFailure.message)?.[1];
  assert.ok(liveRecovery, liveFailure.message);
  assert.deepEqual(fs.readFileSync(path.join(liveRecovery, 'SKILL.md')), liveAccepted);
  assert.deepEqual(fs.readdirSync(outside), []);

  const candidateAccepted = fs.readFileSync(path.join(
    candidateSwap.root, 'plugin/sd0x-dev-flow-codex/skills/review/SKILL.md'
  ));
  const candidates = path.join(candidateSwap.root, 'migration/candidates');
  const outsideCandidate = path.join(outside, 'review');
  fs.mkdirSync(outsideCandidate);
  fs.writeFileSync(path.join(outsideCandidate, 'KEEP'), 'external\n');
  let candidateFailure;
  try {
    restageCoreCandidate(candidateSwap.root, 'review', {
      afterCandidateRootCreate() {
        fs.renameSync(candidates, `${candidates}-held`);
        fs.symlinkSync(outside, candidates);
      }
    });
  } catch (error) {
    candidateFailure = error;
  }
  assert.ok(candidateFailure);
  const candidateRecovery = /accepted payload recovery retained at ([^; ]+)/
    .exec(candidateFailure.message)?.[1];
  assert.ok(candidateRecovery, candidateFailure.message);
  assert.deepEqual(
    fs.readFileSync(path.join(candidateRecovery, 'SKILL.md')),
    candidateAccepted
  );
  assert.equal(fs.readFileSync(path.join(
    outsideCandidate, 'KEEP'
  ), 'utf8'), 'external\n');
  assert.equal(process.cwd(), initialCwd);
});

test('core restaging binds recovery before using its accepted backup', (t) => {
  const initialCwd = process.cwd();
  const values = restageFixtureRoot();
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-recovery-swap-'));
  t.after(() => {
    fs.rmSync(values.workspace, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  });
  const live = path.join(
    values.root,
    'plugin/sd0x-dev-flow-codex/skills/review/SKILL.md'
  );
  const accepted = fs.readFileSync(live);
  const outsideMarker = path.join(outside, 'KEEP');
  fs.writeFileSync(outsideMarker, 'outside unchanged\n');
  let heldRecovery;

  assert.throws(() => restageCoreCandidate(values.root, 'review', {
    afterAcceptedBackup(acceptedRecovery) {
      const recovery = path.dirname(acceptedRecovery);
      heldRecovery = `${recovery}-held`;
      fs.renameSync(recovery, heldRecovery);
      fs.symlinkSync(outside, recovery);
    }
  }), /recovery directory changed during the transaction/);
  assert.deepEqual(fs.readFileSync(path.join(
    heldRecovery, 'accepted-live', 'SKILL.md'
  )), accepted);
  assert.deepEqual(fs.readFileSync(live), accepted);
  assert.equal(fs.readFileSync(outsideMarker, 'utf8'), 'outside unchanged\n');
  assert.deepEqual(fs.readdirSync(outside), ['KEEP']);
  assert.equal(process.cwd(), initialCwd);
});

test('core restaging retains a relocated accepted backup before mutation', (t) => {
  const initialCwd = process.cwd();
  const values = restageFixtureRoot();
  t.after(() => fs.rmSync(values.workspace, { recursive: true, force: true }));
  const live = path.join(
    values.root,
    'plugin/sd0x-dev-flow-codex/skills/review/SKILL.md'
  );
  const accepted = fs.readFileSync(live);
  let relocated;

  assert.throws(() => restageCoreCandidate(values.root, 'review', {
    afterAcceptedBackup(acceptedRecovery) {
      relocated = `${acceptedRecovery}-relocated`;
      fs.renameSync(acceptedRecovery, relocated);
      fs.mkdirSync(acceptedRecovery);
      fs.writeFileSync(path.join(acceptedRecovery, 'FOREIGN'), 'foreign\n');
    }
  }), /accepted recovery tree root identity changed/);
  assert.deepEqual(fs.readFileSync(path.join(relocated, 'SKILL.md')), accepted);
  assert.deepEqual(fs.readFileSync(live), accepted);
  assert.equal(process.cwd(), initialCwd);
});

test('core restaging preserves a final competing candidate', (t) => {
  const initialCwd = process.cwd();
  const values = restageFixtureRoot();
  t.after(() => fs.rmSync(values.workspace, { recursive: true, force: true }));
  const live = path.join(
    values.root, 'plugin/sd0x-dev-flow-codex/skills/review/SKILL.md'
  );
  const accepted = fs.readFileSync(live);
  const candidate = path.join(values.root, 'migration/candidates/review');
  let competingIdentity;
  assert.throws(() => restageCoreCandidate(values.root, 'review', {
    beforeCandidatePublish() {
      fs.mkdirSync(candidate);
      competingIdentity = fs.lstatSync(candidate);
    }
  }), /candidate appeared before publication/);
  const current = fs.lstatSync(candidate);
  assert.equal(current.dev, competingIdentity.dev);
  assert.equal(current.ino, competingIdentity.ino);
  assert.deepEqual(fs.readdirSync(candidate), []);
  assert.deepEqual(fs.readFileSync(live), accepted);
  assert.equal(process.cwd(), initialCwd);
});

test('core restaging retains recovery after restored-live replacement', (t) => {
  const initialCwd = process.cwd();
  const values = restageFixtureRoot();
  t.after(() => fs.rmSync(values.workspace, { recursive: true, force: true }));
  const relative = 'plugin/sd0x-dev-flow-codex/skills/review';
  const accepted = fs.readFileSync(path.join(values.root, relative, 'SKILL.md'));
  let rollbackFailure;
  try {
    restageCoreCandidate(values.root, 'review', {
      afterRestoredInstall(live) {
        fs.rmSync(live, { recursive: true });
        fs.mkdirSync(live);
        fs.writeFileSync(path.join(live, 'FOREIGN'), 'foreign live\n');
      }
    });
  } catch (error) {
    rollbackFailure = error;
  }
  assert.ok(rollbackFailure);
  assert.match(rollbackFailure.message,
    /restaging did not commit; accepted payload recovery retained at/);
  const acceptedRecovery =
    /accepted payload recovery retained at ([^; ]+)/
      .exec(rollbackFailure.message)?.[1];
  assert.ok(acceptedRecovery);
  assert.deepEqual(fs.readFileSync(path.join(
    acceptedRecovery, 'SKILL.md'
  )), accepted);
  assert.equal(fs.existsSync(path.join(
    path.dirname(acceptedRecovery), 'recovery.json'
  )), true);
  assert.equal(fs.readFileSync(path.join(
    values.root, relative, 'FOREIGN'
  ), 'utf8'), 'foreign live\n');
  assert.equal(process.cwd(), initialCwd);
});
