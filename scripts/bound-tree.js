'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { openBoundDirectory } = require('./bound-directory');

const BYTEWISE = (left, right) => Buffer.from(left).compare(Buffer.from(right));

function fail(message) {
  throw new Error(message);
}

function identity(stat) {
  return {
    dev: String(stat.dev),
    ino: String(stat.ino),
    mode: String(stat.mode),
    size: String(stat.size)
  };
}

function sameIdentity(left, right) {
  return left && right &&
    left.dev === right.dev && left.ino === right.ino &&
    left.mode === right.mode && left.size === right.size;
}

function sameDirectoryIdentity(left, right) {
  return left && right && left.dev === right.dev && left.ino === right.ino &&
    left.mode === right.mode;
}

function sameFileGeneration(left, right) {
  return left && right && left.dev === right.dev && left.ino === right.ino &&
    left.mode === right.mode;
}

function sameObject(left, right) {
  return left && right && String(left.dev) === String(right.dev) &&
    String(left.ino) === String(right.ino);
}

function permissionMode(stat) {
  return Number(stat.mode & 0o777n);
}

function writableMode(mode) {
  return (mode & 0o222) !== 0;
}

function appliedMode(mode) {
  if (process.platform !== 'win32') return mode;
  return writableMode(mode) ? 0o666 : 0o444;
}

function modeMatches(stat, mode, kind = 'file') {
  const observed = permissionMode(stat);
  if (process.platform !== 'win32') return observed === mode;
  if (kind === 'directory') return true;
  return Boolean(observed & 0o200) === writableMode(mode);
}

function projectedMode(mode, kind = 'file') {
  if (process.platform !== 'win32') return mode;
  if (kind === 'directory') return 'directory';
  return writableMode(mode) ? 'writable' : 'read-only';
}

function createBoundDirectory(bound, name, mode, label, onCreate) {
  let descriptor;
  let directoryPath;
  let opened;
  let pathIdentity;
  try {
    bound.run((child) => {
      const target = child(name);
      fs.mkdirSync(target, {
        mode: 0o700
      });
      descriptor = fs.openSync(target,
        fs.constants.O_RDONLY |
        (fs.constants.O_DIRECTORY || 0) |
        (fs.constants.O_NOFOLLOW || 0));
      const observed = fs.lstatSync(target, { bigint: true });
      opened = fs.fstatSync(descriptor, { bigint: true });
      if (observed.isSymbolicLink() || !observed.isDirectory() ||
          !opened.isDirectory() || !sameObject(observed, opened)) {
        fail(`${label} directory identity changed during creation`);
      }
      if (process.platform !== 'win32') fs.fchmodSync(descriptor, 0o700);
      opened = fs.fstatSync(descriptor, { bigint: true });
      const creationMode = process.platform === 'win32' ? mode : 0o700;
      if (!opened.isDirectory() ||
          !modeMatches(opened, creationMode, 'directory')) {
        fail(`${label} temporary directory mode could not be applied`);
      }
      pathIdentity = fs.lstatSync(target);
      if (pathIdentity.isSymbolicLink() || !pathIdentity.isDirectory() ||
          !sameObject(pathIdentity, opened)) {
        fail(`${label} directory changed after creation`);
      }
      directoryPath = path.resolve(target);
      if (typeof onCreate === 'function') {
        onCreate({ destination: directoryPath, identity: pathIdentity });
      }
    });
    return {
      descriptor,
      identity: pathIdentity,
      path: directoryPath
    };
  } catch (error) {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    throw error;
  }
}

function finishBoundDirectory(bound, name, created, mode, label) {
  if (process.platform !== 'win32') {
    fs.fchmodSync(created.descriptor, mode);
  }
  const opened = fs.fstatSync(created.descriptor, { bigint: true });
  if (!opened.isDirectory() || !sameObject(opened, created.identity) ||
      !modeMatches(opened, mode, 'directory')) {
    fail(`${label} directory mode or identity changed after creation`);
  }
  bound.run((child) => {
    const observed = fs.lstatSync(child(name), {
      bigint: true,
      throwIfNoEntry: false
    });
    if (!observed || observed.isSymbolicLink() || !observed.isDirectory() ||
        !sameObject(observed, opened) ||
        !modeMatches(observed, mode, 'directory')) {
      fail(`${label} directory changed while applying its mode`);
    }
  });
}

function writeBoundFile(bound, node, label) {
  bound.run((child) => {
    const target = child(node.name);
    const descriptor = fs.openSync(target,
      fs.constants.O_WRONLY |
      fs.constants.O_CREAT |
      fs.constants.O_EXCL |
      (fs.constants.O_NOFOLLOW || 0),
      process.platform === 'win32' ? appliedMode(node.mode) : 0o600);
    try {
      const created = fs.fstatSync(descriptor, { bigint: true });
      if (!created.isFile()) {
        fail(`${label}/${node.name} was not created as a regular file`);
      }
      fs.writeFileSync(descriptor, node.bytes);
      if (process.platform !== 'win32') {
        fs.fchmodSync(descriptor, node.mode);
      }
      const completed = fs.fstatSync(descriptor, { bigint: true });
      if (!completed.isFile() || !sameObject(created, completed) ||
          !modeMatches(completed, node.mode) ||
          completed.size !== BigInt(node.bytes.length)) {
        fail(`${label}/${node.name} file mode or identity changed during creation`);
      }
      const observed = fs.lstatSync(target, {
        bigint: true,
        throwIfNoEntry: false
      });
      if (!observed || observed.isSymbolicLink() || !observed.isFile() ||
          !sameObject(observed, completed) ||
          !modeMatches(observed, node.mode)) {
        fail(`${label}/${node.name} file changed while applying its mode`);
      }
    } finally {
      fs.closeSync(descriptor);
    }
  });
}

function projection(node, includeName = true) {
  if (node.kind === 'file') {
    const result = {
      kind: node.kind,
      mode: projectedMode(node.mode, node.kind),
      sha256: node.sha256
    };
    if (includeName) result.name = node.name;
    return result;
  }
  const result = {
    kind: node.kind,
    mode: projectedMode(node.mode, node.kind),
    children: node.children.map((child) => projection(child, true))
  };
  if (includeName) result.name = node.name;
  return result;
}

function captureDirectory(bound, name, label) {
  let root;
  let directoryPath;
  bound.run((child) => {
    const entry = child(name);
    const stat = fs.lstatSync(entry, { bigint: true, throwIfNoEntry: false });
    if (!stat || stat.isSymbolicLink() || !stat.isDirectory()) {
      fail(`${label} must be a real directory`);
    }
    root = {
      kind: 'directory',
      name,
      mode: Number(stat.mode & 0o777n),
      identity: identity(stat),
      children: []
    };
    directoryPath = path.resolve(entry);
  });
  const directory = openBoundDirectory(directoryPath);
  try {
    directory.run((nestedChild) => {
        for (const directoryEntry of fs.readdirSync('.', { withFileTypes: true })
          .sort((left, right) => BYTEWISE(left.name, right.name))) {
          const nestedName = nestedChild(directoryEntry.name);
          const nestedStat = fs.lstatSync(nestedName, {
            bigint: true,
            throwIfNoEntry: false
          });
          if (!nestedStat || nestedStat.isSymbolicLink()) {
            fail(`${label} contains an unstable or symbolic entry: ${directoryEntry.name}`);
          }
          if (nestedStat.isDirectory()) {
            root.children.push(captureDirectory(
              directory,
              directoryEntry.name,
              `${label}/${directoryEntry.name}`
            ));
            continue;
          }
          if (!nestedStat.isFile()) {
            fail(`${label} contains a non-regular entry: ${directoryEntry.name}`);
          }
          const descriptor = fs.openSync(nestedName,
            fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
          try {
            const opened = fs.fstatSync(descriptor, { bigint: true });
            const bytes = fs.readFileSync(descriptor);
            if (!opened.isFile() || !sameIdentity(identity(nestedStat), identity(opened))) {
              fail(`${label} file identity changed while capturing: ${directoryEntry.name}`);
            }
            root.children.push({
              kind: 'file',
              name: directoryEntry.name,
              mode: Number(nestedStat.mode & 0o777n),
              identity: identity(nestedStat),
              bytes,
              sha256: crypto.createHash('sha256').update(bytes).digest('hex')
            });
          } finally {
            fs.closeSync(descriptor);
          }
        }
    });
  } finally {
    directory.close();
  }
  return root;
}

function assertTreeContent(actual, expected, label) {
  if (JSON.stringify(projection(actual, false)) !==
      JSON.stringify(projection(expected, false))) {
    fail(`${label} content changed`);
  }
}

function assertTreeGeneration(actual, expected, label) {
  if (actual.kind !== expected.kind || actual.name !== expected.name ||
      (actual.kind === 'directory'
        ? !sameDirectoryIdentity(actual.identity, expected.identity)
        : !sameFileGeneration(actual.identity, expected.identity))) {
    fail(`${label} generation changed`);
  }
  if (actual.kind === 'directory') {
    if (actual.children.length !== expected.children.length) {
      fail(`${label} structure changed`);
    }
    for (let index = 0; index < actual.children.length; index += 1) {
      assertTreeGeneration(
        actual.children[index],
        expected.children[index],
        `${label}/${expected.children[index].name}`
      );
    }
  }
}

function assertBoundTree(bound, name, expected, options = {}) {
  const label = options.label || name;
  const observed = captureDirectory(bound, name, label);
  if (!sameIdentity(observed.identity, expected.identity)) {
    fail(`${label} root identity changed`);
  }
  assertTreeContent(observed, expected, label);
  return observed;
}

function writeChildren(bound, children, label, options = {}, relative = '') {
  for (const node of children) {
    const nodeRelative = relative ? `${relative}/${node.name}` : node.name;
    if (node.kind === 'file') {
      writeBoundFile(bound, node, label);
      if (typeof options.afterChildWrite === 'function') {
        options.afterChildWrite({ kind: node.kind, relative: nodeRelative });
      }
      continue;
    }
    const created = createBoundDirectory(
      bound,
      node.name,
      node.mode,
      `${label}/${node.name}`
    );
    let nested;
    try {
      nested = openBoundDirectory(created.path, {
        identity: created.identity
      });
      writeChildren(
        nested,
        node.children,
        `${label}/${node.name}`,
        options,
        nodeRelative
      );
      finishBoundDirectory(
        bound,
        node.name,
        created,
        node.mode,
        `${label}/${node.name}`
      );
      if (typeof options.afterChildWrite === 'function') {
        options.afterChildWrite({ kind: node.kind, relative: nodeRelative });
      }
    } finally {
      if (nested) nested.close();
      fs.closeSync(created.descriptor);
    }
  }
}

function writeBoundTree(bound, name, tree, options = {}) {
  const created = createBoundDirectory(
    bound,
    name,
    tree.mode,
    options.label || name,
    options.afterRootCreate
  );
  let destination;
  try {
    destination = openBoundDirectory(created.path, {
      identity: created.identity
    });
    writeChildren(destination, tree.children, options.label || name, options);
    finishBoundDirectory(
      bound,
      name,
      created,
      tree.mode,
      options.label || name
    );
  } finally {
    if (destination) destination.close();
    fs.closeSync(created.descriptor);
  }
  const captured = captureDirectory(bound, name, options.label || name);
  assertTreeContent(captured, tree, options.label || name);
  return captured;
}

function linkChildren(sourcePath, destination, children, label) {
  for (const node of children) {
    const source = path.join(sourcePath, node.name);
    if (node.kind === 'file') {
      destination.run((child) => {
        const target = child(node.name);
        fs.linkSync(source, target);
        const linked = fs.lstatSync(target, {
          bigint: true,
          throwIfNoEntry: false
        });
        if (!linked || !linked.isFile() || linked.isSymbolicLink() ||
            !sameFileGeneration(identity(linked), node.identity)) {
          fail(`${label}/${node.name} linked the wrong file generation`);
        }
      });
      continue;
    }
    const created = createBoundDirectory(
      destination,
      node.name,
      node.mode,
      `${label}/${node.name}`
    );
    let nested;
    try {
      nested = openBoundDirectory(created.path, {
        identity: created.identity
      });
      linkChildren(source, nested, node.children, `${label}/${node.name}`);
      finishBoundDirectory(
        destination,
        node.name,
        created,
        node.mode,
        `${label}/${node.name}`
      );
    } finally {
      if (nested) nested.close();
      fs.closeSync(created.descriptor);
    }
  }
}

function linkBoundTree(sourceBound, sourceName, destinationBound,
  destinationName, sourceTree, options = {}) {
  const label = options.label || destinationName;
  if (options.allowContentDrift) {
    const current = captureDirectory(
      sourceBound,
      sourceName,
      options.sourceLabel || sourceName
    );
    assertTreeGeneration(current, sourceTree, options.sourceLabel || sourceName);
  } else {
    assertBoundTree(sourceBound, sourceName, sourceTree, {
      label: options.sourceLabel || sourceName
    });
  }
  const created = createBoundDirectory(
    destinationBound,
    destinationName,
    sourceTree.mode,
    label,
    options.afterRootCreate
  );
  let destination;
  try {
    destination = openBoundDirectory(created.path, {
      identity: created.identity
    });
    linkChildren(
      path.resolve(sourceBound.directory, sourceName),
      destination,
      sourceTree.children,
      label
    );
    finishBoundDirectory(
      destinationBound,
      destinationName,
      created,
      sourceTree.mode,
      label
    );
  } finally {
    if (destination) destination.close();
    fs.closeSync(created.descriptor);
  }
  return captureDirectory(destinationBound, destinationName, label);
}

function verifyNode(bound, node, label) {
  bound.run((child) => {
    const name = child(node.name);
    const stat = fs.lstatSync(name, { bigint: true, throwIfNoEntry: false });
    if (!stat || stat.isSymbolicLink() ||
        !sameIdentity(identity(stat), node.identity)) {
      fail(`${label} identity changed before removal`);
    }
    if (node.kind === 'file') {
      const descriptor = fs.openSync(name,
        fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
      try {
        const opened = fs.fstatSync(descriptor, { bigint: true });
        const bytes = fs.readFileSync(descriptor);
        if (!sameIdentity(identity(opened), node.identity) ||
            crypto.createHash('sha256').update(bytes).digest('hex') !== node.sha256) {
          fail(`${label} changed before removal`);
        }
      } finally {
        fs.closeSync(descriptor);
      }
    }
  });
}

function claimAndRemove(bound, node, label, options = {}) {
  const quarantine = `.remove-${crypto.randomUUID()}`;
  bound.run((child) => {
    const name = child(node.name);
    if (typeof options.beforeEntryClaim === 'function') {
      options.beforeEntryClaim({
        path: path.resolve(name),
        label,
        name: node.name
      });
    }
    const quarantineName = child(quarantine);
    fs.renameSync(name, quarantineName);
    const moved = fs.lstatSync(quarantineName, {
      bigint: true,
      throwIfNoEntry: false
    });
    const matches = node.kind === 'directory'
      ? moved?.isDirectory() &&
        sameDirectoryIdentity(identity(moved), node.identity)
      : moved?.isFile() && sameFileGeneration(identity(moved), node.identity);
    if (!matches || moved?.isSymbolicLink()) {
      fail(`${label} replacement retained at ${path.resolve(quarantineName)}`);
    }
    if (node.kind === 'directory') fs.rmdirSync(quarantineName);
    else fs.unlinkSync(quarantineName);
  });
}

function removeChildren(bound, children, label, options) {
  for (const node of children.slice().reverse()) {
    verifyNode(bound, node, `${label}/${node.name}`);
    if (node.kind === 'file') {
      claimAndRemove(bound, node, `${label}/${node.name}`, options);
      continue;
    }
    let stat;
    let childPath;
    bound.run((child) => {
      const name = child(node.name);
      stat = fs.lstatSync(name);
      childPath = path.resolve(name);
    });
    const nested = openBoundDirectory(childPath, { identity: stat });
    try {
      removeChildren(nested, node.children, `${label}/${node.name}`, options);
    } finally {
      nested.close();
    }
    claimAndRemove(bound, node, `${label}/${node.name}`, options);
  }
}

function removeBoundTree(bound, name, expected, options = {}) {
  const label = options.label || name;
  const observed = captureDirectory(bound, name, label);
  if (options.allowContentDrift) {
    assertTreeGeneration(observed, expected, label);
  } else {
    if (!sameIdentity(observed.identity, expected.identity)) {
      fail(`${label} root identity changed before removal`);
    }
    assertTreeContent(observed, expected, label);
  }
  let rootStat;
  let rootPath;
  bound.run((child) => {
    const entry = child(name);
    rootStat = fs.lstatSync(entry);
    rootPath = path.resolve(entry);
  });
  const root = openBoundDirectory(rootPath, { identity: rootStat });
  try {
    removeChildren(root, observed.children, label, options);
  } finally {
    root.close();
  }
  claimAndRemove(bound, observed, label, options);
}

module.exports = {
  assertBoundTree,
  assertTreeContent,
  assertTreeGeneration,
  captureBoundTree: captureDirectory,
  linkBoundTree,
  removeBoundTree,
  writeBoundTree
};
