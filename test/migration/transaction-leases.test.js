'use strict';

const {
  assert,
  crypto,
  fs,
  os,
  path,
  execFileSync,
  spawnSync,
  test,
  cleanGitEnvironment,
  runManifestGit,
  acquireCandidateTransaction,
  git,
  initRepository,
  ROOT,
  activeCreateRequestToolPath
} = require('../helpers/migration-context');

test('candidate transaction recovers a crashed child lease through Git CAS', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-candidate-lock-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  initRepository(root);
  const candidate = path.join(root, 'migration', 'candidates', 'fixture');
  fs.mkdirSync(candidate, { recursive: true });
  fs.writeFileSync(path.join(candidate, 'KEEP'), 'candidate unchanged\n');
  const modulePath = path.join(ROOT, 'scripts', 'candidate-transaction.js');
  const child = spawnSync(process.execPath, ['-e', `
    const { acquireCandidateTransaction } = require(process.argv[1]);
    acquireCandidateTransaction(process.argv[2], 'fixture');
    process.exit(17);
  `, modulePath, root], { encoding: 'utf8' });
  assert.equal(child.status, 17, child.stderr);

  const transaction = acquireCandidateTransaction(root, 'fixture');
  const ref = transaction.ref;
  transaction.release();
  assert.equal(fs.readFileSync(path.join(candidate, 'KEEP'), 'utf8'),
    'candidate unchanged\n');
  assert.throws(() => git(root, ['rev-parse', '--verify', '--quiet', ref], {
    stdio: 'pipe'
  }));
});

test('candidate transaction crash before ref publication does not block acquisition', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-candidate-publish-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  initRepository(root);
  const modulePath = path.join(ROOT, 'scripts', 'candidate-transaction.js');
  const child = spawnSync(process.execPath, ['-e', `
    const { acquireCandidateTransaction } = require(process.argv[1]);
    acquireCandidateTransaction(process.argv[2], 'fixture', {
      afterOwnerWrite() { process.exit(17); }
    });
  `, modulePath, root], { encoding: 'utf8' });
  assert.equal(child.status, 17, child.stderr);

  const transaction = acquireCandidateTransaction(root, 'fixture');
  transaction.release();
  assert.throws(() => git(root, [
    'rev-parse', '--verify', '--quiet', transaction.ref
  ], { stdio: 'pipe' }));
});

test('delayed stale reclaimer cannot move a newer active lease', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-candidate-cas-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  initRepository(root);
  const modulePath = path.join(ROOT, 'scripts', 'candidate-transaction.js');
  const child = spawnSync(process.execPath, ['-e', `
    const { acquireCandidateTransaction } = require(process.argv[1]);
    acquireCandidateTransaction(process.argv[2], 'fixture');
    process.exit(17);
  `, modulePath, root], { encoding: 'utf8' });
  assert.equal(child.status, 17, child.stderr);

  let winner;
  assert.throws(() => acquireCandidateTransaction(root, 'fixture', {
    beforeStaleClaim() {
      if (!winner) winner = acquireCandidateTransaction(root, 'fixture');
    }
  }), /candidate transaction is already active/);
  winner.assert();
  assert.throws(() => acquireCandidateTransaction(root, 'fixture'),
    /candidate transaction is already active/);
  winner.release();
});

test('candidate transaction reclaims a reused PID generation', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-candidate-pid-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  initRepository(root);
  const probe = acquireCandidateTransaction(root, 'fixture');
  const ref = probe.ref;
  probe.release();

  const fakeOwner = path.join(root, 'fake-owner.json');
  fs.writeFileSync(fakeOwner, `${JSON.stringify({
    schema_version: 3,
    pid: process.pid,
    process_started_at_ms: Date.now(),
    process_generation: 'different-process-generation',
    nonce: crypto.randomUUID()
  })}\n`);
  const oid = git(root, ['hash-object', '-w', fakeOwner], {
    encoding: 'utf8'
  }).trim();
  fs.unlinkSync(fakeOwner);
  git(root, ['update-ref', ref, oid, '0'.repeat(40)]);

  const transaction = acquireCandidateTransaction(root, 'fixture');
  transaction.release();
  assert.throws(() => git(root, ['rev-parse', '--verify', '--quiet', ref], {
    stdio: 'pipe'
  }));
});

test('candidate transaction preserves an active lease when generation lookup fails',
  (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-candidate-unknown-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    initRepository(root);
    const owner = acquireCandidateTransaction(root, 'fixture');
    const modulePath = path.join(ROOT, 'scripts', 'candidate-transaction.js');
    const child = spawnSync(process.execPath, ['-e', `
      const fs = require('node:fs');
      const childProcess = require('node:child_process');
      const ownerPid = Number(process.argv[3]);
      const realRead = fs.readFileSync;
      fs.readFileSync = function(name, ...args) {
        if (String(name) === '/proc/' + ownerPid + '/stat') {
          const error = new Error('injected process generation lookup failure');
          error.code = 'EIO';
          throw error;
        }
        return realRead.call(this, name, ...args);
      };
      const realExec = childProcess.execFileSync;
      childProcess.execFileSync = function(file, args, options) {
        const generationProbe = file === '/bin/ps' || file === 'powershell.exe';
        const probesOwner = args.some((argument) =>
          String(argument).includes(String(ownerPid)));
        if (generationProbe && probesOwner) {
          const error = new Error('injected process generation lookup failure');
          error.code = 'EIO';
          throw error;
        }
        return realExec.call(this, file, args, options);
      };
      const { acquireCandidateTransaction } = require(process.argv[1]);
      try {
        acquireCandidateTransaction(process.argv[2], 'fixture');
        process.exit(0);
      } catch (error) {
        process.stderr.write(error.message + '\\n');
        process.exit(17);
      }
    `, modulePath, root, String(process.pid)], { encoding: 'utf8' });
    assert.equal(child.status, 17, child.stderr);
    assert.match(child.stderr, /owner generation is unavailable/);
    owner.assert();
    assert.throws(() => acquireCandidateTransaction(root, 'fixture'),
      /candidate transaction is already active/);
    owner.release();
  });

test('candidate transaction generation is stable across locale and timezone', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-candidate-locale-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  initRepository(root);
  const owner = acquireCandidateTransaction(root, 'fixture');
  const modulePath = path.join(ROOT, 'scripts', 'candidate-transaction.js');
  const child = spawnSync(process.execPath, ['-e', `
    const { acquireCandidateTransaction } = require(process.argv[1]);
    try {
      acquireCandidateTransaction(process.argv[2], 'fixture');
      process.exit(0);
    } catch (error) {
      process.stderr.write(error.message + '\\n');
      process.exit(17);
    }
  `, modulePath, root], {
    encoding: 'utf8',
    env: {
      ...process.env,
      LANG: 'fr_FR.UTF-8',
      LANGUAGE: 'fr_FR.UTF-8',
      LC_ALL: 'fr_FR.UTF-8',
      TZ: 'Asia/Tokyo'
    }
  });
  assert.equal(child.status, 17, child.stderr);
  assert.match(child.stderr, /candidate transaction is already active/);
  owner.assert();
  owner.release();
});

test('candidate transaction acquisition supports native Windows process identity', {
  skip: process.platform !== 'win32'
}, (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-candidate-win32-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  initRepository(root);
  const owner = acquireCandidateTransaction(root, 'fixture');
  owner.assert();
  assert.throws(() => acquireCandidateTransaction(root, 'fixture'),
    /candidate transaction is already active/);
  owner.release();
  const successor = acquireCandidateTransaction(root, 'fixture');
  successor.assert();
  successor.release();
});

test('create-request test probes follow the active candidate payload', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-active-request-tool-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const live = path.join(
    root,
    'plugin/sd0x-dev-flow-codex/skills/create-request/scripts/request-tool.js'
  );
  const candidate = path.join(
    root,
    'migration/candidates/create-request/scripts/request-tool.js'
  );
  fs.mkdirSync(path.dirname(live), { recursive: true });
  fs.writeFileSync(live, 'live');
  assert.equal(activeCreateRequestToolPath(root), live);
  fs.mkdirSync(path.dirname(candidate), { recursive: true });
  fs.writeFileSync(candidate, 'candidate');
  assert.equal(activeCreateRequestToolPath(root), candidate);
});

test('native Windows closed Git environments support request tool and audits', {
  skip: process.platform !== 'win32'
}, (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-git-null-win32-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  initRepository(root);
  fs.mkdirSync(path.join(root, 'docs', 'features'), { recursive: true });

  const requestTool = activeCreateRequestToolPath();
  const requestResult = spawnSync(process.execPath, [
    requestTool, 'scan', '--today', '2026-07-27'
  ], {
    cwd: root,
    encoding: 'utf8'
  });
  assert.equal(requestResult.status, 0,
    requestResult.stderr || requestResult.stdout);
  assert.equal(JSON.parse(requestResult.stdout).total, 0);

  const auditRoot = execFileSync('git', [
    '--no-replace-objects', 'rev-parse', '--show-toplevel'
  ], {
    cwd: root,
    encoding: 'utf8',
    env: cleanGitEnvironment()
  }).trim();
  const canonicalRoot = fs.realpathSync.native(root).toLowerCase();
  assert.equal(fs.realpathSync.native(auditRoot).toLowerCase(), canonicalRoot);

  const manifestRoot = String(runManifestGit(root, [
    'rev-parse', '--show-toplevel'
  ], { encoding: 'utf8' })).trim();
  assert.equal(fs.realpathSync.native(manifestRoot).toLowerCase(), canonicalRoot);
});
