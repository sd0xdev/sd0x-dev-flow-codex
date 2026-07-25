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

const ROOT = path.resolve(__dirname, '..');

function fail(message) {
  throw new Error(message);
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

function restageCoreCandidate(root, target, options = {}) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(target || '')) {
    fail('target must be a canonical skill name');
  }
  const liveRelative = `plugin/sd0x-dev-flow-codex/skills/${target}`;
  const candidateRelative = `migration/candidates/${target}`;
  const live = assertContainedDirectory(root, liveRelative);
  const candidate = assertContainedDirectory(root, candidateRelative, {
    allowMissingLeaf: true,
    mustBeMissing: true
  });
  const tracked = git(root, [
    'ls-tree', '-r', '--name-only', 'HEAD', '--', liveRelative
  ]).trim().split('\n').filter(Boolean);
  if (tracked.length === 0) fail(`${target}: HEAD core payload is missing`);

  const recovery = createRecoveryDirectory(root, 'restage-core-', {
    deviceOf: options.recoveryDeviceOf,
    beforeCreate: options.beforeRecoveryCreate,
    beforeRemove: options.beforeRecoveryRemove
  });
  const temporary = recovery.directory;
  const restored = target;
  const prior = `${target}-prior`;
  const rename = options.rename || fs.renameSync;
  const removePrior = options.removePrior ||
    ((directory) => fs.rmSync(directory, { recursive: true }));
  let retainRecovery = false;
  try {
    if (typeof options.onTemporary === 'function') options.onTemporary(temporary);
    recovery.run(() => {
      fs.mkdirSync(path.dirname(candidate), { recursive: true });
      fs.cpSync(live, candidate, { recursive: true });
      for (const relative of tracked) {
        const file = relative.slice(`${liveRelative}/`.length);
        const destination = path.join(restored, ...file.split('/'));
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.writeFileSync(destination, git(root, ['show', `HEAD:${relative}`], null));
      }
      assertContainedDirectory(root, liveRelative);
      assertContainedDirectory(root, candidateRelative);
      rename(live, prior);
      try {
        rename(restored, live);
      } catch (installError) {
        try {
          rename(prior, live);
        } catch (rollbackError) {
          retainRecovery = true;
          const manifest = writeRecoveryManifest({
            schema_version: 1,
            operation: 'restage-core-candidate',
            target,
            candidate,
            live,
            prior: path.join(temporary, prior),
            restored: path.join(temporary, restored),
            install_error: installError.message,
            rollback_error: rollbackError.message
          });
          throw new Error(
            `${target}: restored payload installation and rollback failed; ` +
            `accepted candidate remains at ${candidate}; recovery retained at ` +
            `${temporary}${manifest ? ` (${path.join(temporary, manifest)})` : ''}`
          );
        }
        fs.rmSync(candidate, { recursive: true, force: true });
        throw installError;
      }
      try {
        removePrior(prior);
      } catch (cleanupError) {
        retainRecovery = true;
        const manifest = writeRecoveryManifest({
          schema_version: 1,
          operation: 'restage-core-candidate',
          target,
          candidate,
          live,
          prior: path.join(temporary, prior),
          restored: path.join(temporary, restored),
          cleanup_error: cleanupError.message,
          swap_completed: true
        });
        throw new Error(
          `${target}: payload swap completed but prior-tree cleanup failed; ` +
          `accepted candidate remains at ${candidate}; recovery retained at ` +
          `${temporary}${manifest ? ` (${path.join(temporary, manifest)})` : ''}`
        );
      }
    });
  } catch (error) {
    if (!retainRecovery && fs.existsSync(live)) {
      fs.rmSync(candidate, { recursive: true, force: true });
    }
    throw error;
  } finally {
    if (!retainRecovery) recovery.remove();
  }
  return {
    ok: true,
    target,
    candidate: candidateRelative,
    restored_live: liveRelative
  };
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
