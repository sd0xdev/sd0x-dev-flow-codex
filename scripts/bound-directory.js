'use strict';

const fs = require('node:fs');
const path = require('node:path');

function fail(message) {
  throw new Error(message);
}

function sameDirectory(left, right) {
  return left.isDirectory() && right.isDirectory() &&
    left.dev === right.dev && left.ino === right.ino;
}

function childName(name) {
  if (typeof name !== 'string' || name.length === 0 ||
      name === '.' || name === '..' || path.basename(name) !== name ||
      name.includes('/') || name.includes('\\')) {
    fail(`bound child name is invalid: ${name}`);
  }
  return name;
}

function openBoundDirectory(directory, options = {}) {
  const observed = fs.lstatSync(directory, { throwIfNoEntry: false });
  const identity = options.identity || observed;
  if (options.identity && (!observed || !sameDirectory(options.identity, observed))) {
    fail(`bound directory changed before it could be opened: ${directory}`);
  }
  if (!observed || observed.isSymbolicLink() || !observed.isDirectory()) {
    fail(`bound directory must be a real directory: ${directory}`);
  }
  return {
    directory,
    child: childName,
    assert() {
      const current = fs.statSync('.');
      if (!sameDirectory(identity, current)) {
        fail(`bound directory identity changed: ${directory}`);
      }
    },
    run(callback) {
      const previous = process.cwd();
      const previousIdentity = fs.statSync('.');
      let entered = false;
      try {
        process.chdir(directory);
        entered = true;
        const current = fs.statSync('.');
        if (!sameDirectory(identity, current)) {
          fail(`bound directory changed before it could be entered: ${directory}`);
        }
        return callback(childName);
      } finally {
        if (entered) {
          const restoreTarget = fs.lstatSync(previous, { throwIfNoEntry: false });
          if (!restoreTarget || restoreTarget.isSymbolicLink() ||
              !sameDirectory(previousIdentity, restoreTarget)) {
            fail(`bound previous directory changed before restore: ${previous}`);
          }
          process.chdir(previous);
          if (!sameDirectory(previousIdentity, fs.statSync('.'))) {
            fail(`bound previous directory identity changed after restore: ${previous}`);
          }
        }
      }
    },
    close() {}
  };
}

module.exports = { openBoundDirectory };
