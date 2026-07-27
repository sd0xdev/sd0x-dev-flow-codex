#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

function fail(message) {
  throw new Error(message);
}

function isContained(rootReal, resolved) {
  const relative = path.relative(rootReal, resolved);
  return relative === '' ||
    (!path.isAbsolute(relative) &&
      relative !== '..' &&
      !relative.startsWith(`..${path.sep}`));
}

function captureDirectory(rootReal, directory, label) {
  const stat = fs.lstatSync(directory, { throwIfNoEntry: false });
  if (!stat || stat.isSymbolicLink() || !stat.isDirectory()) {
    fail(`${label} must be a real directory`);
  }
  const resolved = fs.realpathSync(directory);
  if (!isContained(rootReal, resolved)) {
    fail(`${label} escapes the repository`);
  }
  return {
    path: directory,
    real: resolved,
    dev: stat.dev,
    ino: stat.ino
  };
}

function assertDirectoryIdentity(rootReal, identity, label) {
  const current = captureDirectory(rootReal, identity.path, label);
  if (current.real !== identity.real ||
      current.dev !== identity.dev ||
      current.ino !== identity.ino) {
    fail(`${label} changed during the operation`);
  }
}

function sameDirectory(left, right) {
  return left.isDirectory() && right.isDirectory() &&
    left.dev === right.dev && left.ino === right.ino;
}

function withBoundDirectory(identity, label, callback, hooks = {}) {
  const previous = process.cwd();
  const previousIdentity = fs.statSync('.');
  let entered = false;
  try {
    process.chdir(identity.path);
    entered = true;
    const current = fs.statSync('.');
    if (!current.isDirectory() ||
        current.dev !== identity.dev ||
        current.ino !== identity.ino) {
      fail(`${label} changed before it could be bound`);
    }
    return callback();
  } finally {
    if (entered) {
      if (typeof hooks.beforeRestore === 'function') hooks.beforeRestore(previous);
      const restoreTarget = fs.lstatSync(previous, { throwIfNoEntry: false });
      if (!restoreTarget || restoreTarget.isSymbolicLink() ||
          !sameDirectory(previousIdentity, restoreTarget)) {
        fail(`Previous directory changed before ${label} restore`);
      }
      process.chdir(previous);
      if (!sameDirectory(previousIdentity, fs.statSync('.'))) {
        fail(`Previous directory identity changed after ${label} restore`);
      }
    }
  }
}

function ensureRecoveryRoot(root, options = {}) {
  const rootReal = fs.realpathSync(root);
  const directory = path.join(root, '.sd0x');
  const existing = fs.lstatSync(directory, { throwIfNoEntry: false });
  if (!existing) {
    try {
      fs.mkdirSync(directory, { mode: 0o700 });
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
  }
  const identity = captureDirectory(rootReal, directory, 'Recovery root .sd0x');
  if (path.dirname(identity.real) !== rootReal) {
    fail('Recovery root .sd0x must be directly contained by the repository');
  }
  const deviceOf = options.deviceOf ||
    ((target) => fs.statSync(target).dev);
  if (deviceOf(root) !== deviceOf(directory)) {
    fail('Recovery root .sd0x must share the repository filesystem');
  }
  return { rootReal, identity };
}

function createRecoveryDirectory(root, prefix, options = {}) {
  if (!/^[a-z0-9][a-z0-9-]*-$/.test(prefix || '')) {
    fail('Recovery directory prefix must be canonical');
  }
  const recoveryRoot = ensureRecoveryRoot(root, options);
  assertDirectoryIdentity(
    recoveryRoot.rootReal,
    recoveryRoot.identity,
    'Recovery root .sd0x'
  );
  let name;
  let identity;
  withBoundDirectory(recoveryRoot.identity, 'Recovery root .sd0x', () => {
    if (typeof options.beforeCreate === 'function') {
      options.beforeCreate(recoveryRoot.identity.path);
    }
    name = fs.mkdtempSync(prefix);
    try {
      assertDirectoryIdentity(
        recoveryRoot.rootReal,
        recoveryRoot.identity,
        'Recovery root .sd0x'
      );
    } catch (error) {
      fs.rmSync(name, { recursive: true });
      throw error;
    }
    identity = captureDirectory(
      recoveryRoot.rootReal,
      name,
      'Recovery directory'
    );
    if (path.dirname(identity.real) !== recoveryRoot.identity.real) {
      fail('Recovery directory must be directly contained by .sd0x');
    }
  });
  const directory = path.join(recoveryRoot.identity.path, name);
  identity.path = directory;

  const assertSafe = () => {
    withBoundDirectory(
      recoveryRoot.identity,
      'Recovery root .sd0x',
      () => {
        const childIdentity = { ...identity, path: name };
        assertDirectoryIdentity(
          recoveryRoot.rootReal,
          childIdentity,
          'Recovery directory'
        );
      },
      { beforeRestore: options.beforeAssertRestore }
    );
  };
  const run = (callback) => {
    return withBoundDirectory(
      recoveryRoot.identity,
      'Recovery root .sd0x',
      () => {
        const current = fs.lstatSync(name, { throwIfNoEntry: false });
        if (!current || current.isSymbolicLink() || !current.isDirectory() ||
            current.dev !== identity.dev || current.ino !== identity.ino) {
          fail('Recovery directory changed before it could be bound');
        }
        const childIdentity = { ...identity, path: name };
        return withBoundDirectory(
          childIdentity,
          'Recovery directory',
          callback
        );
      }
    );
  };
  const remove = () => {
    withBoundDirectory(recoveryRoot.identity, 'Recovery root .sd0x', () => {
      const current = fs.lstatSync(name, { throwIfNoEntry: false });
      if (!current) return;
      if (current.isSymbolicLink()) {
        fs.unlinkSync(name);
        return;
      }
      const childIdentity = { ...identity, path: name };
      assertDirectoryIdentity(
        recoveryRoot.rootReal,
        childIdentity,
        'Recovery directory'
      );
      if (typeof options.beforeRemove === 'function') {
        options.beforeRemove(recoveryRoot.identity.path, name);
      }
      fs.rmSync(name, { recursive: true });
    });
  };
  return {
    directory,
    assertSafe,
    run,
    remove
  };
}

module.exports = {
  createRecoveryDirectory,
  ensureRecoveryRoot
};
