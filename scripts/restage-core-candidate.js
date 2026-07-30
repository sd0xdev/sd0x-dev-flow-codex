#!/usr/bin/env node
'use strict';

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const {
  cleanGitEnvironment
} = require('../plugin/sd0x-dev-flow-codex/scripts/runtime/worktree');
const {
  createRecoveryDirectory
} = require('./recovery-directory');
const { openBoundDirectory } = require('./bound-directory');
const { acquireCandidateTransaction } = require('./candidate-transaction');
const {
  assertBoundTree,
  assertTreeGeneration,
  captureBoundTree,
  linkBoundTree,
  removeBoundTree,
  writeBoundTree
} = require('./bound-tree');

const ROOT = path.resolve(__dirname, '..');

function fail(message) {
  throw new Error(message);
}

function sameDirectory(left, right) {
  return left && right && left.isDirectory() && right.isDirectory() &&
    left.dev === right.dev && left.ino === right.ino;
}

function assertDirectoryIdentity(directory, identity, label) {
  const current = fs.lstatSync(directory, { throwIfNoEntry: false });
  if (current?.isSymbolicLink() || !sameDirectory(identity, current)) {
    fail(`${label} changed during the transaction`);
  }
}

function assertChildDirectory(name, identity, label) {
  const current = fs.lstatSync(name, { throwIfNoEntry: false });
  if (current?.isSymbolicLink() || !sameDirectory(identity, current)) {
    fail(`${label} changed during the transaction`);
  }
}

function git(root, args, encoding = 'utf8') {
  return execFileSync('git', ['--no-replace-objects', ...args], {
    cwd: root,
    encoding,
    env: {
      ...cleanGitEnvironment(),
      GIT_OPTIONAL_LOCKS: '0',
      GIT_TERMINAL_PROMPT: '0'
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 32 * 1024 * 1024
  });
}

function assertContainedDirectory(root, relative, options = {}) {
  const rootReal = fs.realpathSync(root);
  const parts = relative.split('/');
  let current = root;
  for (let index = 0; index < parts.length; index += 1) {
    current = path.join(current, parts[index]);
    const stat = fs.lstatSync(current, { throwIfNoEntry: false });
    if (!stat) {
      if (options.allowMissingLeaf && index === parts.length - 1) return current;
      fail(`${relative}: managed directory is missing`);
    }
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      fail(`${relative}: managed path must contain only real directories`);
    }
    const resolved = fs.realpathSync(current);
    const containment = path.relative(rootReal, resolved);
    if (containment === '..' || containment.startsWith(`..${path.sep}`) ||
        path.isAbsolute(containment)) {
      fail(`${relative}: managed directory escapes the repository`);
    }
  }
  if (options.mustBeMissing) fail(`${relative}: managed directory must be absent`);
  return current;
}

function ensureCandidatesDirectory(root, options = {}) {
  const migration = assertContainedDirectory(root, 'migration');
  const boundMigration = openBoundDirectory(migration);
  let identity;
  try {
    boundMigration.run((child) => {
      const name = child('candidates');
      let current = fs.lstatSync(name, { throwIfNoEntry: false });
      if (!current) {
        if (typeof options.beforeCandidatesCreate === 'function') {
          options.beforeCandidatesCreate(migration);
        }
        try {
          fs.mkdirSync(name);
        } catch (error) {
          if (error.code !== 'EEXIST') throw error;
        }
        current = fs.lstatSync(name, { throwIfNoEntry: false });
      }
      if (!current || current.isSymbolicLink() || !current.isDirectory()) {
        fail('migration/candidates: managed path must contain only real directories');
      }
      identity = current;
    });
  } finally {
    boundMigration.close();
  }
  const candidates = assertContainedDirectory(root, 'migration/candidates');
  return {
    bound: openBoundDirectory(candidates, { identity }),
    identity,
    path: candidates
  };
}

function writeRecoveryManifest(details) {
  const manifest = 'recovery.json';
  try {
    fs.writeFileSync(manifest, `${JSON.stringify(details, null, 2)}\n`, {
      flag: 'wx'
    });
    return manifest;
  } catch {
    return null;
  }
}

function restoredTree(root, tracked, liveRelative, mode) {
  const tree = {
    kind: 'directory',
    name: 'restored-live',
    mode,
    children: []
  };
  const directories = new Map([['', tree]]);
  for (const relative of tracked) {
    const file = relative.slice(`${liveRelative}/`.length);
    const parts = file.split('/');
    let prefix = '';
    let parent = tree;
    for (const part of parts.slice(0, -1)) {
      prefix = prefix ? `${prefix}/${part}` : part;
      let directory = directories.get(prefix);
      if (!directory) {
        directory = {
          kind: 'directory',
          name: part,
          mode: 0o755,
          children: []
        };
        parent.children.push(directory);
        directories.set(prefix, directory);
      }
      parent = directory;
    }
    const bytes = git(root, ['show', `HEAD:${relative}`], null);
    parent.children.push({
      kind: 'file',
      name: parts.at(-1),
      mode: 0o644,
      bytes,
      sha256: require('node:crypto').createHash('sha256').update(bytes).digest('hex')
    });
  }
  const sort = (node) => {
    if (node.kind !== 'directory') return;
    node.children.sort((left, right) =>
      Buffer.from(left.name).compare(Buffer.from(right.name)));
    for (const child of node.children) sort(child);
  };
  sort(tree);
  return tree;
}

function restageCoreCandidate(root, target, options = {}) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(target || '')) {
    fail('target must be a canonical skill name');
  }
  const liveParentRelative = 'plugin/sd0x-dev-flow-codex/skills';
  const liveRelative = `plugin/sd0x-dev-flow-codex/skills/${target}`;
  const candidateRelative = `migration/candidates/${target}`;
  const liveParent = assertContainedDirectory(root, liveParentRelative);
  const liveParentIdentity = fs.lstatSync(liveParent);
  const liveDirectory = openBoundDirectory(liveParent, {
    identity: liveParentIdentity
  });
  const live = assertContainedDirectory(root, liveRelative);
  const liveIdentity = fs.lstatSync(live);
  const candidateSpace = ensureCandidatesDirectory(root, options);
  const candidatesDirectory = candidateSpace.bound;
  const transaction = acquireCandidateTransaction(root, target);
  let recovery;
  let acceptedRecoveryPath;
  let retainRecovery = false;
  let result;
  let failure;
  try {
    assertContainedDirectory(root, candidateRelative, {
      allowMissingLeaf: true,
      mustBeMissing: true
    });
    const tracked = git(root, [
      'ls-tree', '-r', '--name-only', 'HEAD', '--', liveRelative
    ]).trim().split('\n').filter(Boolean);
    if (typeof options.beforeAcceptedCapture === 'function') {
      options.beforeAcceptedCapture(live);
    }
    const acceptedTree = captureBoundTree(
      liveDirectory,
      target,
      'accepted live tree'
    );
    const headTree = tracked.length > 0
      ? restoredTree(root, tracked, liveRelative, acceptedTree.mode)
      : null;

    recovery = createRecoveryDirectory(root, 'restage-core-', {
      deviceOf: options.recoveryDeviceOf,
      beforeCreate: options.beforeRecoveryCreate,
      beforeRemove: options.beforeRecoveryRemove
    });
    const temporary = recovery.directory;
    const temporaryIdentity = fs.lstatSync(temporary);
    const acceptedRecovery = path.join(temporary, 'accepted-live');
    acceptedRecoveryPath = acceptedRecovery;
    if (typeof options.onTemporary === 'function') options.onTemporary(temporary);
    recovery.run(() => {
      const recoveryDirectory = openBoundDirectory('.');
      if (typeof options.beforeAcceptedBackup === 'function') {
        options.beforeAcceptedBackup(temporary);
      }
      const acceptedRecoveryTree = linkBoundTree(
        liveDirectory,
        target,
        recoveryDirectory,
        'accepted-live',
        acceptedTree,
        { label: 'accepted recovery tree' }
      );
      if (typeof options.afterAcceptedBackup === 'function') {
        options.afterAcceptedBackup(acceptedRecovery);
      }
      try {
        assertDirectoryIdentity(
          temporary,
          temporaryIdentity,
          'recovery directory'
        );
        assertBoundTree(
          recoveryDirectory,
          'accepted-live',
          acceptedRecoveryTree,
          { label: 'accepted recovery tree' }
        );
      } catch (backupError) {
        retainRecovery = true;
        throw backupError;
      }
      transaction.assert();
      assertDirectoryIdentity(
        liveParent, liveParentIdentity, 'accepted live parent'
      );
      liveDirectory.run((child) => {
        assertChildDirectory(child(target), liveIdentity, 'accepted live directory');
      });
      assertDirectoryIdentity(
        candidateSpace.path,
        candidateSpace.identity,
        'candidate parent'
      );
      assertContainedDirectory(root, candidateRelative, {
        allowMissingLeaf: true,
        mustBeMissing: true
      });

      let candidateCreated = false;
      let candidatePublished = false;
      let candidateTree;
      let liveMutationStarted = false;
      let restoredCreated = false;
      let restoredInstalled = false;
      let restoredWrittenTree;
      let preserveAcceptedRecovery = false;
      try {
        if (typeof options.beforeCandidatePublish === 'function') {
          options.beforeCandidatePublish();
        }
        transaction.assert();
        candidatesDirectory.run((child) => {
          if (fs.lstatSync(child(target), { throwIfNoEntry: false })) {
            fail(`${target}: candidate appeared before publication`);
          }
        });
        candidateTree = linkBoundTree(
          liveDirectory,
          target,
          candidatesDirectory,
          target,
          acceptedTree,
          {
            label: 'accepted candidate',
            afterRootCreate(details) {
              candidateCreated = true;
              if (typeof options.afterCandidateRootCreate === 'function') {
                options.afterCandidateRootCreate(details);
              }
            }
          }
        );
        candidatePublished = true;
        try {
          assertDirectoryIdentity(
            candidateSpace.path,
            candidateSpace.identity,
            'candidate parent'
          );
        } catch (namespaceError) {
          preserveAcceptedRecovery = true;
          throw namespaceError;
        }
        assertTreeGeneration(
          captureBoundTree(candidatesDirectory, target, 'accepted candidate'),
          candidateTree,
          'accepted candidate'
        );

        if (typeof options.beforeLiveRemoval === 'function') {
          options.beforeLiveRemoval(live);
        }
        liveMutationStarted = true;
        removeBoundTree(
          liveDirectory,
          target,
          acceptedTree,
          { label: 'accepted live tree', allowContentDrift: true }
        );
        if (typeof options.afterLiveRemoval === 'function') {
          options.afterLiveRemoval(live);
        }
        if (headTree) {
          restoredWrittenTree = writeBoundTree(
            liveDirectory,
            target,
            headTree,
            {
              label: 'restored live tree',
              afterRootCreate(details) {
                restoredCreated = true;
                if (typeof options.afterRestoredRootCreate === 'function') {
                  options.afterRestoredRootCreate(details);
                }
              }
            }
          );
          restoredInstalled = true;
          if (typeof options.afterRestoredInstall === 'function') {
            options.afterRestoredInstall(live);
          }
          assertBoundTree(
            liveDirectory,
            target,
            restoredWrittenTree,
            { label: 'restored live tree' }
          );
        } else {
          liveDirectory.run((child) => {
            if (fs.lstatSync(child(target), { throwIfNoEntry: false })) {
              fail(`${target}: untracked HEAD payload was not removed`);
            }
          });
        }
        try {
          assertDirectoryIdentity(
            liveParent,
            liveParentIdentity,
            'accepted live parent'
          );
        } catch (namespaceError) {
          preserveAcceptedRecovery = true;
          throw namespaceError;
        }
      } catch (operationError) {
        let rollbackError;
        try {
          if (restoredInstalled) {
            removeBoundTree(
              liveDirectory,
              target,
              restoredWrittenTree,
              { label: 'failed restored live tree' }
            );
            restoredInstalled = false;
            restoredCreated = false;
          }
          if (restoredCreated) {
            fail(`${target}: partial restored live tree requires retained recovery`);
          }
          if (liveMutationStarted) {
            let occupied;
            liveDirectory.run((child) => {
              occupied = Boolean(fs.lstatSync(child(target), {
                throwIfNoEntry: false
              }));
            });
            if (occupied) {
              fail(`${target}: accepted live rollback destination is occupied`);
            }
            if (candidatePublished) {
              linkBoundTree(
                candidatesDirectory,
                target,
                liveDirectory,
                target,
                candidateTree,
                {
                  label: 'rolled back accepted live tree',
                  sourceLabel: 'accepted candidate',
                  allowContentDrift: true
                }
              );
            } else {
              linkBoundTree(
                recoveryDirectory,
                'accepted-live',
                liveDirectory,
                target,
                acceptedRecoveryTree,
                {
                  label: 'rolled back accepted live tree',
                  sourceLabel: 'accepted recovery tree',
                  allowContentDrift: true
                }
              );
            }
            liveMutationStarted = false;
          }
          if (candidatePublished) {
            removeBoundTree(
              candidatesDirectory,
              target,
              candidateTree,
              {
                label: 'rolled back accepted candidate',
                allowContentDrift: true
              }
            );
            candidatePublished = false;
            candidateCreated = false;
          } else if (candidateCreated) {
            fail(`${target}: partial accepted candidate requires retained recovery`);
          }
        } catch (error) {
          rollbackError = error;
        }
        if (rollbackError || preserveAcceptedRecovery) {
          retainRecovery = true;
          const manifest = writeRecoveryManifest({
            schema_version: 2,
            operation: 'restage-core-candidate',
            target,
            accepted_recovery: acceptedRecovery,
            candidate: candidatePublished
              ? path.join(candidateSpace.path, target)
              : null,
            live,
            restored_recovery: restoredCreated ? live : null,
            operation_error: operationError.message,
            rollback_error: rollbackError?.message || null,
            recovery_reason: preserveAcceptedRecovery
              ? 'managed parent namespace changed'
              : 'rollback failed'
          });
          throw new Error(
            `${target}: restaging did not commit; accepted payload recovery ` +
            `retained at ${acceptedRecovery}; ` +
            `${rollbackError?.message || 'managed parent namespace changed'}` +
            `${manifest
              ? ` (${path.join(temporary, manifest)})`
              : ''}`
          );
        }
        throw operationError;
      }
      recoveryDirectory.close();
    });
    result = {
      ok: true,
      target,
      candidate: candidateRelative,
      restored_live: headTree ? liveRelative : null,
      restored_live_absent: !headTree
    };
  } catch (error) {
    failure = retainRecovery && recovery &&
      !/accepted payload recovery retained at/.test(error.message)
      ? new Error(
          `${error.message}; accepted payload recovery retained at ` +
          `${acceptedRecoveryPath || recovery.directory}`
        )
      : error;
  }
  try {
    transaction.release();
  } catch (error) {
    retainRecovery = Boolean(recovery);
    failure = new Error(
      `${failure ? `${failure.message}; ` : ''}` +
      `candidate transaction release failed: ${error.message}` +
      `${recovery ? `; recovery retained at ${recovery.directory}` : ''}`
    );
  }
  if (recovery && !retainRecovery) {
    try {
      recovery.remove();
    } catch (error) {
      failure = new Error(
        `${failure ? `${failure.message}; ` : ''}` +
        `recovery cleanup failed: ${error.message}`
      );
    }
  }
  candidatesDirectory.close();
  liveDirectory.close();
  if (failure) throw failure;
  return result;
}

function main(argv = process.argv.slice(2)) {
  const [target] = argv;
  if (argv.length !== 1) {
    fail('usage: restage-core-candidate.js <target>');
  }
  process.stdout.write(`${JSON.stringify(
    restageCoreCandidate(ROOT, target),
    null,
    2
  )}\n`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`restage-core-candidate: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = { assertContainedDirectory, main, restageCoreCandidate };
