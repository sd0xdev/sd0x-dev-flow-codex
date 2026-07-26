#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { auditActiveCandidates } = require('./skill-migration-audit');
const { openBoundDirectory } = require('./bound-directory');
const { createRecoveryDirectory } = require('./recovery-directory');

const ROOT = path.resolve(__dirname, '..');
const PLAN_PATH = path.join(ROOT, 'scripts', 'skill-wave-plans.json');
const DISPOSITION_PATH = path.join(ROOT, 'migration', 'source-disposition.json');
const BYTEWISE = (left, right) => Buffer.from(left).compare(Buffer.from(right));

function fail(message) {
  throw new Error(message);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function statIdentity(stat) {
  return [stat.dev, stat.ino, stat.mode, stat.size].map(String).join(':');
}

function directoryIdentity(stat) {
  return [stat.dev, stat.ino, stat.mode].map(String).join(':');
}

function captureContainedDirectory(root, directory) {
  const relative = path.relative(root, directory);
  if (relative === '') {
    const stat = fs.lstatSync(root, { throwIfNoEntry: false });
    if (!stat || !stat.isDirectory() || stat.isSymbolicLink()) {
      fail(`promotion root must be a real directory: ${root}`);
    }
    return [{ path: root, identity: directoryIdentity(stat) }];
  }
  if (relative === '..' || relative.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relative)) {
    fail(`promotion directory escapes repository: ${directory}`);
  }
  let current = root;
  const identities = [];
  for (const part of relative.split(path.sep)) {
    current = path.join(current, part);
    const stat = fs.lstatSync(current, { throwIfNoEntry: false });
    if (!stat || !stat.isDirectory() || stat.isSymbolicLink()) {
      fail(`promotion path must contain only real directories: ${current}`);
    }
    identities.push({ path: current, identity: directoryIdentity(stat) });
  }
  return identities;
}

function assertContainedDirectory(root, directory, expected = null) {
  const observed = captureContainedDirectory(root, directory);
  if (expected && JSON.stringify(observed) !== JSON.stringify(expected)) {
    fail(`promotion directory identity changed before mutation: ${directory}`);
  }
  return observed;
}

function captureRegularTree(directory) {
  const rootStat = fs.lstatSync(directory, { bigint: true, throwIfNoEntry: false });
  if (!rootStat || !rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    fail(`payload root must be a real directory: ${directory}`);
  }
  const entries = [];
  const visit = (current, prefix) => {
    const children = fs.readdirSync(current, { withFileTypes: true })
      .sort((left, right) => BYTEWISE(left.name, right.name));
    for (const child of children) {
      const relative = prefix ? `${prefix}/${child.name}` : child.name;
      const absolute = path.join(current, child.name);
      const stat = fs.lstatSync(absolute, { bigint: true });
      if (stat.isSymbolicLink()) fail(`payload contains symlink: ${relative}`);
      if (stat.isDirectory()) {
        entries.push({ relative, kind: 'directory', identity: statIdentity(stat) });
        visit(absolute, relative);
      } else if (stat.isFile()) {
        const descriptor = fs.openSync(absolute,
          fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
        try {
          const opened = fs.fstatSync(descriptor, { bigint: true });
          const bytes = fs.readFileSync(descriptor);
          if (!opened.isFile() || statIdentity(opened) !== statIdentity(stat)) {
            fail(`payload file identity changed while capturing: ${relative}`);
          }
          entries.push({
            relative,
            kind: 'file',
            identity: statIdentity(stat),
            sha256: crypto.createHash('sha256').update(bytes).digest('hex')
          });
        } finally {
          fs.closeSync(descriptor);
        }
      } else {
        fail(`payload contains non-regular entry: ${relative}`);
      }
    }
  };
  visit(directory, '');
  return { root: statIdentity(rootStat), entries };
}

function assertTreeSnapshot(directory, expected) {
  const observed = captureRegularTree(directory);
  if (JSON.stringify(observed) !== JSON.stringify(expected)) {
    fail(`payload tree identity changed before mutation: ${directory}`);
  }
}

function assertTreeContent(directory, expected) {
  const observed = captureRegularTree(directory);
  const projection = (tree) => tree.entries.map((entry) => ({
    relative: entry.relative,
    kind: entry.kind,
    sha256: entry.sha256 || null
  }));
  if (JSON.stringify(projection(observed)) !== JSON.stringify(projection(expected))) {
    fail(`payload tree content changed before cleanup: ${directory}`);
  }
}

function copyCapturedTree(source, destination, captured, hooks = {}) {
  assertTreeSnapshot(source, captured);
  const openedDirectories = [];
  const destinationParent = openBoundDirectory(path.dirname(destination));
  openedDirectories.push(destinationParent);
  try {
    let destinationIdentity;
    destinationParent.run((child) => {
      const name = child(path.basename(destination));
      fs.mkdirSync(name);
      destinationIdentity = fs.lstatSync(name);
    });
    if (typeof hooks.afterDestinationDirectoryCreate === 'function') {
      hooks.afterDestinationDirectoryCreate({ relative: '', destination });
    }
    const destinationRoot = openBoundDirectory(destination, {
      identity: destinationIdentity
    });
    openedDirectories.push(destinationRoot);
    const directories = new Map([['', destinationRoot]]);
    for (const entry of captured.entries) {
      const parentRelative = path.posix.dirname(entry.relative) === '.'
        ? ''
        : path.posix.dirname(entry.relative);
      const parent = directories.get(parentRelative);
      if (!parent) fail(`payload destination parent is unavailable: ${entry.relative}`);
      const name = path.posix.basename(entry.relative);
      const target = path.join(destination, ...entry.relative.split('/'));
      if (entry.kind === 'directory') {
        let identity;
        parent.run((child) => {
          const childName = child(name);
          fs.mkdirSync(childName);
          identity = fs.lstatSync(childName);
        });
        if (typeof hooks.afterDestinationDirectoryCreate === 'function') {
          hooks.afterDestinationDirectoryCreate({
            relative: entry.relative,
            destination: target
          });
        }
        const bound = openBoundDirectory(target, { identity });
        openedDirectories.push(bound);
        directories.set(entry.relative, bound);
        continue;
      }
      const input = path.join(source, ...entry.relative.split('/'));
      const descriptor = fs.openSync(input,
        fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
      try {
        const opened = fs.fstatSync(descriptor, { bigint: true });
        if (!opened.isFile() || statIdentity(opened) !== entry.identity) {
          fail(`payload file identity changed before copy: ${entry.relative}`);
        }
        const bytes = fs.readFileSync(descriptor);
        if (crypto.createHash('sha256').update(bytes).digest('hex') !== entry.sha256) {
          fail(`payload file content changed before copy: ${entry.relative}`);
        }
        parent.run((child) => {
          if (typeof hooks.beforeDestinationWrite === 'function') {
            hooks.beforeDestinationWrite({ relative: entry.relative, destination: target });
          }
          fs.writeFileSync(child(name), bytes, { flag: 'wx' });
        });
      } finally {
        fs.closeSync(descriptor);
      }
    }
  } finally {
    for (const bound of openedDirectories.reverse()) bound.close();
  }
  assertTreeSnapshot(source, captured);
}

function regularTree(directory) {
  const files = [];
  const visit = (current, prefix) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      const absolute = path.join(current, entry.name);
      if (entry.isSymbolicLink()) fail(`payload contains symlink: ${relative}`);
      if (entry.isDirectory()) visit(absolute, relative);
      else if (entry.isFile()) files.push(relative);
      else fail(`payload contains non-regular entry: ${relative}`);
    }
  };
  visit(directory, '');
  files.sort(BYTEWISE);
  return files;
}

function treeDigest(directory) {
  const captured = captureRegularTree(directory);
  const hash = crypto.createHash('sha256');
  for (const entry of captured.entries.filter((candidate) =>
    candidate.kind === 'file')) {
    hash.update(entry.relative);
    hash.update('\0');
    const filePath = path.join(directory, ...entry.relative.split('/'));
    const descriptor = fs.openSync(filePath,
      fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
    try {
      const opened = fs.fstatSync(descriptor, { bigint: true });
      if (!opened.isFile() || statIdentity(opened) !== entry.identity) {
        fail(`payload file identity changed while hashing: ${entry.relative}`);
      }
      hash.update(fs.readFileSync(descriptor));
    } finally {
      fs.closeSync(descriptor);
    }
    hash.update('\0');
  }
  assertTreeSnapshot(directory, captured);
  return hash.digest('hex');
}

function requestIsCandidateComplete(root, requestPath) {
  return /^> \*\*Status\*\*: Candidate Complete$/m.test(
    fs.readFileSync(path.join(root, ...requestPath.split('/')), 'utf8')
  );
}

function requestPayload(root, requestPath) {
  const markdown = fs.readFileSync(
    path.join(root, ...requestPath.split('/')), 'utf8'
  );
  const matches = [...markdown.matchAll(/\bpayload `([0-9a-f]{64})`/g)];
  if (matches.length !== 1) fail(`${requestPath}: exact candidate payload is missing`);
  return matches[0][1];
}

function promotePack(target, candidate, destination) {
  if (fs.existsSync(destination)) fail(`${target}: pack destination already exists`);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.renameSync(candidate, destination);
}

function recoveryIntent(moves) {
  return {
    schema_version: 1,
    operation: 'promote-skill-wave',
    status: 'prepared',
    moves: moves.map((move) => ({
      target: move.target,
      target_package: move.target_package,
      candidate: move.candidate,
      destination: move.destination,
      payload_tree_sha256: move.payload_tree_sha256,
      backup: move.backup || null,
      candidate_backup: move.candidateBackup || null,
      candidate_sibling_backup: move.candidateSiblingBackup || null,
      displaced: move.displaced || null,
      replacement: move.replacement || null,
      candidate_removed: move.candidateRemoved || null,
      destination_parent: move.destinationParent || null,
      candidate_parent: move.candidateParent || null
    }))
  };
}

function writeRecoveryIntent(moves, boundRecovery) {
  const temporary = `.recovery-${crypto.randomUUID()}.json`;
  const descriptor = fs.openSync(boundRecovery.child(temporary),
    fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY |
    (fs.constants.O_NOFOLLOW || 0), 0o600);
  try {
    fs.writeFileSync(descriptor, `${JSON.stringify(recoveryIntent(moves), null, 2)}\n`);
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
  fs.renameSync(boundRecovery.child(temporary), boundRecovery.child('recovery.json'));
}

function recoverPromotion(root, recoveryDirectory) {
  const recoveryRoot = path.join(root, '.sd0x');
  const relative = path.relative(recoveryRoot, recoveryDirectory);
  if (!relative || relative.includes(path.sep) || path.isAbsolute(relative)) {
    fail('promotion recovery must be a direct .sd0x child');
  }
  assertContainedDirectory(root, recoveryRoot);
  const boundRecoveryRoot = openBoundDirectory(recoveryRoot);
  const recoveryStat = boundRecoveryRoot.run(() =>
    fs.lstatSync(relative, { throwIfNoEntry: false }));
  if (!recoveryStat || recoveryStat.isSymbolicLink() || !recoveryStat.isDirectory()) {
    fail('promotion recovery directory must be real');
  }
  const boundRecovery = openBoundDirectory(recoveryDirectory);
  const manifestStat = boundRecovery.run(() =>
    fs.lstatSync('recovery.json', { throwIfNoEntry: false }));
  if (!manifestStat || manifestStat.isSymbolicLink() || !manifestStat.isFile()) {
    fail('promotion recovery manifest is unavailable');
  }
  const manifest = boundRecovery.run(() => readJson('recovery.json'));
  if (manifest.schema_version !== 1 || manifest.operation !== 'promote-skill-wave' ||
      !Array.isArray(manifest.moves)) {
    fail('promotion recovery manifest is invalid');
  }
  const opened = [];
  try {
    for (const move of [...manifest.moves].reverse()) {
      if (!/^[a-z0-9][a-z0-9-]*$/.test(move.target || '') ||
          !['core', 'quality-pack'].includes(move.target_package) ||
          typeof move.candidate !== 'string' || typeof move.destination !== 'string' ||
          !/^[0-9a-f]{64}$/.test(move.payload_tree_sha256 || '')) {
        fail('promotion recovery move is invalid');
      }
      for (const candidatePath of [move.candidate, move.destination]) {
        const containment = path.relative(root, candidatePath);
        if (!containment || containment === '..' ||
            containment.startsWith(`..${path.sep}`) || path.isAbsolute(containment)) {
          fail('promotion recovery path escapes repository');
        }
      }
      const artifactNames = [
        move.backup, move.candidate_backup, move.candidate_sibling_backup,
        move.displaced, move.replacement, move.candidate_removed
      ].filter(Boolean);
      if (artifactNames.some((name) => path.basename(name) !== name ||
          name.includes('/') || name.includes('\\'))) {
        fail('promotion recovery artifact name is invalid');
      }
      const candidateParent = openBoundDirectory(path.dirname(move.candidate));
      const destinationParent = openBoundDirectory(path.dirname(move.destination));
      opened.push(candidateParent, destinationParent);
      assertContainedDirectory(
        root, path.dirname(move.candidate), move.candidate_parent
      );
      assertContainedDirectory(
        root, path.dirname(move.destination), move.destination_parent
      );
      if (move.target_package === 'core') {
        if (!move.backup || !move.displaced || !move.candidate_sibling_backup) {
          fail(`${move.target}: core recovery artifacts are incomplete`);
        }
        const priorPayload = boundRecovery.run(() => {
          const backup = fs.lstatSync(move.backup, { throwIfNoEntry: false });
          if (!backup || backup.isSymbolicLink() || !backup.isDirectory()) {
            fail(`${move.target}: core recovery live backup is unavailable`);
          }
          return treeDigest(move.backup);
        });
        destinationParent.run(() => {
          const destinationName = path.basename(move.destination);
          const installedName = `${move.target}-recovery-installed`;
          const destinationExists = fs.existsSync(destinationName);
          const displacedExists = fs.existsSync(move.displaced);
          const installedExists = fs.existsSync(installedName);
          if (!destinationExists && !displacedExists) {
            fail(`${move.target}: recovery lost both live and displaced payloads`);
          }
          if (displacedExists) {
            if (treeDigest(move.displaced) !== priorPayload) {
              fail(`${move.target}: displaced live payload differs from its backup`);
            }
            if (destinationExists) {
              if (treeDigest(destinationName) !== move.payload_tree_sha256 ||
                  installedExists) {
                fail(`${move.target}: installed recovery payload is incoherent`);
              }
              fs.renameSync(destinationName, installedName);
            } else if (installedExists &&
                treeDigest(installedName) !== move.payload_tree_sha256) {
              fail(`${move.target}: retained installed payload is invalid`);
            }
            fs.renameSync(move.displaced, destinationName);
          } else if (treeDigest(destinationName) !== priorPayload) {
            fail(`${move.target}: recovered live payload differs from its backup`);
          }
          if (fs.existsSync(installedName)) {
            if (treeDigest(installedName) !== move.payload_tree_sha256) {
              fail(`${move.target}: retained installed payload is invalid`);
            }
            fs.rmSync(installedName, { recursive: true });
          }
          if (!fs.existsSync(destinationName) ||
              treeDigest(destinationName) !== priorPayload) {
            fail(`${move.target}: live recovery postcondition failed`);
          }
        });
        candidateParent.run(() => {
          const candidateName = path.basename(move.candidate);
          const candidateValid = fs.existsSync(candidateName) &&
            treeDigest(candidateName) === move.payload_tree_sha256;
          if (!candidateValid) {
            if (!fs.existsSync(move.candidate_sibling_backup) ||
                treeDigest(move.candidate_sibling_backup) !==
                  move.payload_tree_sha256) {
              fail(`${move.target}: candidate recovery backup is unavailable`);
            }
            if (fs.existsSync(candidateName)) {
              fs.renameSync(candidateName,
                `${move.target}-recovery-partial-candidate`);
            }
            fs.renameSync(move.candidate_sibling_backup, candidateName);
          }
          if (!fs.existsSync(candidateName) ||
              treeDigest(candidateName) !== move.payload_tree_sha256) {
            fail(`${move.target}: candidate recovery postcondition failed`);
          }
        });
      } else {
        destinationParent.run(() => {
          const destinationName = path.basename(move.destination);
          const installedName = `${move.target}-recovery-installed-pack`;
          if (fs.existsSync(destinationName)) {
            if (treeDigest(destinationName) !== move.payload_tree_sha256 ||
                fs.existsSync(installedName)) {
              fail(`${move.target}: installed pack recovery payload is incoherent`);
            }
            fs.renameSync(destinationName, installedName);
          }
          if (fs.existsSync(installedName)) {
            if (treeDigest(installedName) !== move.payload_tree_sha256) {
              fail(`${move.target}: retained installed pack is invalid`);
            }
            fs.rmSync(installedName, { recursive: true });
          }
        });
        candidateParent.run(() => {
          const candidateName = path.basename(move.candidate);
          if (!fs.existsSync(candidateName)) {
            if (!move.candidate_removed || !fs.existsSync(move.candidate_removed) ||
                treeDigest(move.candidate_removed) !== move.payload_tree_sha256) {
              fail(`${move.target}: pack candidate recovery artifact is unavailable`);
            }
            fs.renameSync(move.candidate_removed, candidateName);
          }
          if (treeDigest(candidateName) !== move.payload_tree_sha256) {
            fail(`${move.target}: pack candidate recovery postcondition failed`);
          }
        });
      }
    }
  } finally {
    for (const bound of opened.reverse()) bound.close();
  }
  boundRecoveryRoot.run(() => fs.rmSync(relative, { recursive: true }));
  return { recovered: true, moves: manifest.moves.length };
}

function buildPromotionPlan(root, plan, disposition) {
  const moves = [];
  for (const target of plan.targets) {
    const rows = disposition.skills.filter((row) =>
      row.target_skill === target.target &&
      target.units.some((unit) => unit.promotion_unit_id === row.promotion_unit_id)
    );
    const requests = [...new Set(rows.map((row) => row.promotion_request))];
    if (rows.length === 0 ||
        rows.some((row) => row.delivery_state !== 'candidate') ||
        requests.some((request) =>
          !request || !requestIsCandidateComplete(root, request))) {
      fail(`${target.target}: all units must have Candidate Complete evidence`);
    }
    const payloads = [...new Set(requests.map((request) =>
      requestPayload(root, request)
    ))];
    if (payloads.length !== 1) fail(`${target.target}: requests disagree on payload`);
    const candidate = path.join(root, 'migration', 'candidates', target.target);
    const destination = target.target_package === 'core'
      ? path.join(root, 'plugin', 'sd0x-dev-flow-codex', 'skills', target.target)
      : path.join(root, 'migration', 'packs', target.target_package, target.target);
    const candidatePopulated = fs.existsSync(candidate) &&
      regularTree(candidate).length > 0;
    if (!candidatePopulated) {
      if (!fs.existsSync(destination) || treeDigest(destination) !== payloads[0]) {
        fail(`${target.target}: moved payload differs from Candidate Complete evidence`);
      }
      moves.push({
        target: target.target,
        target_package: target.target_package,
        payload_tree_sha256: payloads[0],
        action: 'already-moved',
        candidate,
        destination
      });
      continue;
    }
    if (treeDigest(candidate) !== payloads[0]) {
      fail(`${target.target}: candidate drifted after Candidate Complete preflight`);
    }
    if (target.target_package === 'core') {
      if (!fs.existsSync(destination)) fail(`${target.target}: core destination is missing`);
      const candidateFiles = regularTree(candidate);
      const missing = regularTree(destination).filter((file) =>
        !candidateFiles.includes(file)
      );
      if (missing.length > 0) {
        fail(`${target.target}: candidate omits existing core resources: ${missing.join(', ')}`);
      }
    } else if (fs.existsSync(destination)) {
      fail(`${target.target}: pack destination already exists before promotion`);
    }
    moves.push({
      target: target.target,
      target_package: target.target_package,
      payload_tree_sha256: payloads[0],
      action: 'move',
      candidate,
      destination
    });
  }
  return moves;
}

function applyPromotionMoves(root, moves, options = {}) {
  const pending = moves.filter((move) => move.action === 'move');
  const rollback = [];
  const boundDirectories = [];
  const removeCoreCandidate = options.removeCoreCandidate ||
    ((candidate) => fs.rmSync(candidate, { recursive: true }));
  const restoreTree = options.restoreTree ||
    ((source, destination) =>
      copyCapturedTree(source, destination, captureRegularTree(source)));
  const recovery = createRecoveryDirectory(root, 'wave-promotion-', {
    deviceOf: options.recoveryDeviceOf,
    beforeCreate: options.beforeRecoveryCreate,
    beforeRemove(recoveryRoot, name) {
      if (typeof options.beforeRecoveryRemove === 'function') {
        options.beforeRecoveryRemove(recoveryRoot, name);
      }
      for (const move of rollback.filter((entry) =>
        entry.target_package === 'core')) {
        move.boundDestinationParent.run(() => {
          if (fs.existsSync(move.displaced)) {
            assertTreeSnapshot(move.displaced, move.liveSnapshot);
            fs.rmSync(move.displaced, { recursive: true });
          }
        });
        move.boundCandidateParent.run(() => {
          const removed = `${move.target}-removed-candidate`;
          if (fs.existsSync(removed)) {
            assertTreeSnapshot(removed, move.candidateSnapshot);
            fs.rmSync(removed, { recursive: true });
          }
          if (fs.existsSync(move.candidateSiblingBackup)) {
            assertTreeContent(move.candidateSiblingBackup, move.candidateSnapshot);
            fs.rmSync(move.candidateSiblingBackup, { recursive: true });
          }
        });
      }
      for (const move of rollback.filter((entry) =>
        entry.target_package !== 'core' && entry.moved)) {
        move.boundCandidateParent.run(() => {
          assertTreeSnapshot(move.candidateRemoved, move.candidateSnapshot);
          fs.rmSync(move.candidateRemoved, { recursive: true });
        });
      }
    }
  });
  const temporary = recovery.directory;
  const boundRecovery = openBoundDirectory(temporary);
  boundDirectories.push(boundRecovery);
  let retainRecovery = false;
  try {
    if (typeof options.onTemporary === 'function') options.onTemporary(temporary);
    return recovery.run(() => {
      for (const move of pending) {
        if (move.target_package === 'core') {
          const backup = `${move.target}-live`;
          const candidateBackup = `${move.target}-candidate`;
          const replacement = `.${move.target}-sd0x-${crypto.randomUUID()}-replacement`;
          const destinationPath = assertContainedDirectory(root, move.destination);
          const candidatePath = assertContainedDirectory(root, move.candidate);
          const destinationParent = captureContainedDirectory(
            root, path.dirname(move.destination)
          );
          const candidateParent = captureContainedDirectory(
            root, path.dirname(move.candidate)
          );
          const boundDestinationParent = openBoundDirectory(
            path.dirname(move.destination)
          );
          const boundCandidateParent = openBoundDirectory(path.dirname(move.candidate));
          boundDirectories.push(boundDestinationParent, boundCandidateParent);
          const liveSnapshot = captureRegularTree(move.destination);
          const candidateSnapshot = captureRegularTree(move.candidate);
          const candidateSiblingBackup =
            `.${move.target}-sd0x-${crypto.randomUUID()}-candidate-backup`;
          if (treeDigest(move.candidate) !== move.payload_tree_sha256) {
            fail(`${move.target}: candidate identity changed before promotion`);
          }
          copyCapturedTree(move.destination, backup, liveSnapshot, {
            beforeDestinationWrite: options.beforeRecoveryBackupWrite
          });
          copyCapturedTree(move.candidate, candidateBackup, candidateSnapshot);
          boundDestinationParent.run(() => {
            copyCapturedTree(move.candidate, replacement, candidateSnapshot);
          });
          boundCandidateParent.run(() => {
            copyCapturedTree(move.candidate, candidateSiblingBackup, candidateSnapshot);
          });
          const rollbackMove = {
            ...move,
            backup,
            candidateBackup,
            displaced: `.${move.target}-sd0x-${crypto.randomUUID()}-displaced-live`,
            destinationParent,
            candidateParent,
            boundDestinationParent,
            boundCandidateParent,
            destinationPath,
            candidatePath,
            liveSnapshot,
            candidateSnapshot,
            candidateSiblingBackup,
            installed: false,
            displacedLive: false,
            candidateCleanupStarted: false
          };
          rollback.push(rollbackMove);
          writeRecoveryIntent(rollback, boundRecovery);
          if (typeof options.beforeInstall === 'function') options.beforeInstall(move);
          assertContainedDirectory(root, path.dirname(move.destination), destinationParent);
          assertContainedDirectory(root, path.dirname(move.candidate), candidateParent);
          assertContainedDirectory(root, move.destination, destinationPath);
          assertContainedDirectory(root, move.candidate, candidatePath);
          assertTreeSnapshot(move.destination, liveSnapshot);
          assertTreeSnapshot(move.candidate, candidateSnapshot);
          boundDestinationParent.run(() => {
            fs.renameSync(path.basename(move.destination), rollbackMove.displaced);
            rollbackMove.displacedLive = true;
            if (typeof options.afterDisplace === 'function') {
              options.afterDisplace(move, {
                displaced: path.join(path.dirname(move.destination), rollbackMove.displaced)
              });
            }
            assertTreeSnapshot(rollbackMove.displaced, liveSnapshot);
            assertTreeSnapshot(move.candidate, candidateSnapshot);
            fs.renameSync(replacement, path.basename(move.destination));
          });
          rollbackMove.installed = true;
        } else {
          const candidatePath = assertContainedDirectory(root, move.candidate);
          const candidateParent = captureContainedDirectory(
            root, path.dirname(move.candidate)
          );
          const destinationParent = assertContainedDirectory(
            root, path.dirname(move.destination)
          );
          const boundCandidateParent = openBoundDirectory(path.dirname(move.candidate));
          const boundDestinationParent = openBoundDirectory(
            path.dirname(move.destination)
          );
          boundDirectories.push(boundCandidateParent, boundDestinationParent);
          const candidateSnapshot = captureRegularTree(move.candidate);
          if (treeDigest(move.candidate) !== move.payload_tree_sha256) {
            fail(`${move.target}: candidate identity changed before promotion`);
          }
          const replacement = `.${move.target}-sd0x-${crypto.randomUUID()}-replacement`;
          const candidateRemoved = `.${move.target}-sd0x-${crypto.randomUUID()}-removed`;
          boundDestinationParent.run(() =>
            copyCapturedTree(move.candidate, replacement, candidateSnapshot));
          if (typeof options.beforeInstall === 'function') {
            options.beforeInstall(move);
          }
          assertContainedDirectory(root, move.candidate, candidatePath);
          assertContainedDirectory(
            root, path.dirname(move.candidate), candidateParent
          );
          assertContainedDirectory(
            root, path.dirname(move.destination), destinationParent
          );
          assertTreeSnapshot(move.candidate, candidateSnapshot);
          const rollbackMove = {
            ...move,
            candidateParent,
            destinationParent,
            boundCandidateParent,
            boundDestinationParent,
            candidateSnapshot,
            replacement,
            candidateRemoved,
            installed: false,
            moved: false
          };
          rollback.push(rollbackMove);
          writeRecoveryIntent(rollback, boundRecovery);
          boundDestinationParent.run(() => {
            if (fs.existsSync(path.basename(move.destination))) {
              fail(`${move.target}: pack destination already exists`);
            }
            fs.renameSync(replacement, path.basename(move.destination));
          });
          rollbackMove.installed = true;
          boundCandidateParent.run(() =>
            fs.renameSync(path.basename(move.candidate), candidateRemoved));
          rollbackMove.moved = true;
        }
        if (treeDigest(move.destination) !== move.payload_tree_sha256) {
          fail(`${move.target}: promoted payload differs from accepted candidate`);
        }
      }
      for (const move of rollback.filter((entry) => entry.target_package === 'core')) {
        if (move.displacedLive) move.boundDestinationParent.run(() =>
          assertTreeSnapshot(move.displaced, move.liveSnapshot));
        assertTreeSnapshot(move.candidate, move.candidateSnapshot);
        assertContainedDirectory(root, path.dirname(move.candidate), move.candidateParent);
        move.candidateCleanupStarted = true;
        if (options.removeCoreCandidate) {
          removeCoreCandidate(move.candidate);
        } else {
          move.boundCandidateParent.run(() => fs.renameSync(
            path.basename(move.candidate), `${move.target}-removed-candidate`
          ));
        }
      }
      return moves;
    });
  } catch (error) {
    return recovery.run(() => {
      const rollbackErrors = [];
      for (const move of rollback.reverse()) {
        if (move.target_package === 'core') {
          if (move.displacedLive) try {
            assertContainedDirectory(
              root, path.dirname(move.destination), move.destinationParent
            );
            if (options.restoreTree) {
              fs.rmSync(move.destination, { recursive: true, force: true });
              restoreTree(move.backup, move.destination, 'live', move);
            } else {
              move.boundDestinationParent.run(() => {
                const destinationName = path.basename(move.destination);
                if (fs.existsSync(destinationName)) {
                  fs.renameSync(destinationName, `${move.target}-failed-live`);
                }
                captureRegularTree(move.displaced);
                fs.renameSync(move.displaced, destinationName);
              });
            }
          } catch (rollbackError) {
            rollbackErrors.push({
              target: move.target,
              tree: 'live',
              message: rollbackError.message
            });
          }
          if (move.candidateCleanupStarted) try {
            assertContainedDirectory(
              root, path.dirname(move.candidate), move.candidateParent
            );
            if (options.restoreTree) {
              fs.rmSync(move.candidate, { recursive: true, force: true });
              restoreTree(move.candidateBackup, move.candidate, 'candidate', move);
            } else {
              move.boundCandidateParent.run(() => {
                const candidateName = path.basename(move.candidate);
                if (fs.existsSync(candidateName)) {
                  fs.renameSync(candidateName, `${move.target}-failed-candidate`);
                }
                const removed = `${move.target}-removed-candidate`;
                if (fs.existsSync(removed)) fs.renameSync(removed, candidateName);
                else fs.renameSync(move.candidateSiblingBackup, candidateName);
              });
            }
          } catch (rollbackError) {
            rollbackErrors.push({
              target: move.target,
              tree: 'candidate',
              message: rollbackError.message
            });
          }
        } else if (move.installed) {
          try {
            assertContainedDirectory(
              root, path.dirname(move.destination), move.destinationParent
            );
            assertContainedDirectory(
              root, path.dirname(move.candidate), move.candidateParent
            );
            move.boundDestinationParent.run(() => {
              const destinationName = path.basename(move.destination);
              if (!fs.existsSync(destinationName)) {
                fail(`${move.target}: pack rollback destination changed`);
              }
              assertTreeSnapshot(destinationName, move.candidateSnapshot);
              fs.renameSync(destinationName, `${move.target}-failed-pack`);
              assertTreeSnapshot(`${move.target}-failed-pack`, move.candidateSnapshot);
              fs.rmSync(`${move.target}-failed-pack`, { recursive: true });
            });
            if (move.moved) move.boundCandidateParent.run(() => {
              const candidateName = path.basename(move.candidate);
              if (fs.existsSync(candidateName)) {
                fail(`${move.target}: pack rollback candidate appeared`);
              }
              fs.renameSync(move.candidateRemoved, candidateName);
            });
          } catch (rollbackError) {
            rollbackErrors.push({
              target: move.target,
              tree: 'pack-candidate',
              message: rollbackError.message
            });
          }
        }
      }
      if (rollbackErrors.length > 0) {
        retainRecovery = true;
        const recoveryDetails = {
          ...recoveryIntent(rollback),
          status: 'rollback-incomplete',
          original_error: error.message,
          rollback_errors: rollbackErrors
        };
        try {
          fs.writeFileSync('recovery.json',
            `${JSON.stringify(recoveryDetails, null, 2)}\n`, { flag: 'wx' });
        } catch {
          // The explicit recovery directory and backup paths remain in the error.
        }
        throw new Error(
          `promotion failed and rollback was incomplete; recovery retained at ` +
          `${temporary}; original error: ${error.message}; rollback errors: ` +
          `${rollbackErrors.map((entry) =>
            `${entry.target}:${entry.tree}:${entry.message}`
          ).join('; ')}`
        );
      }
      throw error;
    });
  } finally {
    try {
      if (!retainRecovery) recovery.remove();
    } finally {
      for (const bound of boundDirectories.reverse()) bound.close();
    }
  }
}

function main(argv = process.argv.slice(2)) {
  if (argv[0] === '--recover' && argv.length === 2) {
    const recoveryDirectory = path.resolve(argv[1]);
    const recoveryRoot = path.dirname(recoveryDirectory);
    if (path.basename(recoveryRoot) !== '.sd0x') {
      fail('promotion recovery directory must be directly below .sd0x');
    }
    const result = recoverPromotion(path.dirname(recoveryRoot), recoveryDirectory);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  const [wave] = argv;
  if (!/^[1-7]$/.test(wave || '') || argv.length !== 1) {
    fail('usage: promote-skill-wave.js <wave>|--recover RECOVERY_DIRECTORY');
  }
  const plan = readJson(PLAN_PATH).waves?.[wave];
  if (!plan) fail(`wave ${wave} plan is unavailable`);
  const disposition = readJson(DISPOSITION_PATH);
  const moves = buildPromotionPlan(ROOT, plan, disposition);
  auditActiveCandidates({ root: ROOT });
  applyPromotionMoves(ROOT, moves);
  process.stdout.write(`${JSON.stringify({
    ok: true,
    wave: Number(wave),
    moves: moves.map(({ candidate, destination, ...move }) => move)
  }, null, 2)}\n`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`promote-skill-wave: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  applyPromotionMoves,
  buildPromotionPlan,
  captureRegularTree,
  copyCapturedTree,
  main,
  recoverPromotion,
  regularTree,
  treeDigest
};
