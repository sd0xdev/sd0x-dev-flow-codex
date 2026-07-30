'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { openBoundDirectory } = require('./bound-directory');

function fail(message) {
  throw new Error(message);
}

function identity(stat) {
  return {
    dev: stat.dev.toString(),
    ino: stat.ino.toString(),
    mode: stat.mode.toString(),
    size: stat.size.toString()
  };
}

function sameIdentity(left, right) {
  return left && right && left.dev === right.dev && left.ino === right.ino &&
    left.mode === right.mode && left.size === right.size;
}

function sameAncestorIdentity(left, right) {
  return left && right && left.dev === right.dev && left.ino === right.ino &&
    left.mode === right.mode;
}

function sameObjectIdentity(left, right) {
  return left && right && left.dev === right.dev && left.ino === right.ino &&
    left.mode === right.mode;
}

function containedRelative(root, target) {
  const relative = path.relative(root, target);
  if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relative)) {
    fail(`path must be a repository child: ${target}`);
  }
  return relative;
}

function captureAncestors(root, target, create = false) {
  const rootReal = fs.realpathSync(root);
  const relative = containedRelative(root, target);
  const parts = relative.split(path.sep);
  const ancestors = [];
  let current = root;
  for (const part of parts.slice(0, -1)) {
    current = path.join(current, part);
    if (create) fs.mkdirSync(current, { recursive: false });
    const stat = fs.lstatSync(current, { bigint: true, throwIfNoEntry: false });
    if (!stat || !stat.isDirectory() || stat.isSymbolicLink()) {
      fail(`path ancestor must be a real directory: ${path.relative(root, current)}`);
    }
    const resolved = fs.realpathSync(current);
    const containment = path.relative(rootReal, resolved);
    if (containment === '..' || containment.startsWith(`..${path.sep}`) ||
        path.isAbsolute(containment)) {
      fail(`path ancestor escapes repository: ${path.relative(root, current)}`);
    }
    ancestors.push({ path: current, identity: identity(stat) });
  }
  return ancestors;
}

function ensureAncestors(root, target) {
  const relative = containedRelative(root, target);
  const rootReal = fs.realpathSync(root);
  let current = root;
  for (const part of relative.split(path.sep).slice(0, -1)) {
    current = path.join(current, part);
    let stat = fs.lstatSync(current, { throwIfNoEntry: false });
    if (stat && (!stat.isDirectory() || stat.isSymbolicLink())) {
      fail(`path ancestor must be a real directory: ${path.relative(root, current)}`);
    }
    if (!stat) {
      try {
        fs.mkdirSync(current);
      } catch (error) {
        if (error.code !== 'EEXIST') throw error;
      }
      stat = fs.lstatSync(current, { throwIfNoEntry: false });
      if (!stat || !stat.isDirectory() || stat.isSymbolicLink()) {
        fail(`path ancestor must be a real directory: ${path.relative(root, current)}`);
      }
    }
    const resolved = fs.realpathSync(current);
    const containment = path.relative(rootReal, resolved);
    if (containment === '..' || containment.startsWith(`..${path.sep}`) ||
        path.isAbsolute(containment)) {
      fail(`path ancestor escapes repository: ${path.relative(root, current)}`);
    }
  }
  return captureAncestors(root, target);
}

function captureTarget(root, target, allowMissing = false) {
  const ancestors = captureAncestors(root, target);
  const stat = fs.lstatSync(target, { bigint: true, throwIfNoEntry: false });
  if (!stat) {
    if (!allowMissing) fail(`contained file is missing: ${path.relative(root, target)}`);
    return { ancestors, target: null };
  }
  if (!stat.isFile() || stat.isSymbolicLink()) {
    fail(`contained path must be a regular file: ${path.relative(root, target)}`);
  }
  return { ancestors, target: identity(stat) };
}

function assertCaptured(root, target, captured) {
  for (const ancestor of captured.ancestors) {
    const stat = fs.lstatSync(ancestor.path, {
      bigint: true,
      throwIfNoEntry: false
    });
    if (!stat || !stat.isDirectory() || stat.isSymbolicLink() ||
        !sameAncestorIdentity(identity(stat), ancestor.identity)) {
      fail(`path ancestor identity changed: ${path.relative(root, ancestor.path)}`);
    }
  }
  const stat = fs.lstatSync(target, { bigint: true, throwIfNoEntry: false });
  if (captured.target === null) {
    if (stat) fail(`contained file appeared during update: ${path.relative(root, target)}`);
    return;
  }
  if (!stat || !stat.isFile() || stat.isSymbolicLink() ||
      !sameIdentity(identity(stat), captured.target)) {
    fail(`contained file identity changed: ${path.relative(root, target)}`);
  }
  if (captured.sha256) {
    const descriptor = fs.openSync(target,
      fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
    try {
      const opened = fs.fstatSync(descriptor, { bigint: true });
      const bytes = fs.readFileSync(descriptor);
      if (!sameIdentity(identity(opened), captured.target) ||
          crypto.createHash('sha256').update(bytes).digest('hex') !== captured.sha256) {
        fail(`contained file content changed: ${path.relative(root, target)}`);
      }
    } finally {
      fs.closeSync(descriptor);
    }
  }
}

function readContainedFile(root, target, encoding = null) {
  const captured = captureTarget(root, target);
  const descriptor = fs.openSync(target,
    fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
  try {
    const opened = fs.fstatSync(descriptor, { bigint: true });
    if (!opened.isFile() || !sameIdentity(identity(opened), captured.target)) {
      fail(`contained file changed before open: ${path.relative(root, target)}`);
    }
    const bytes = fs.readFileSync(descriptor);
    captured.sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
    assertCaptured(root, target, captured);
    return { captured, bytes: encoding ? bytes.toString(encoding) : bytes };
  } finally {
    fs.closeSync(descriptor);
  }
}

function assertFileIdentity(filePath, captured, label) {
  const stat = fs.lstatSync(filePath, { bigint: true, throwIfNoEntry: false });
  if (!stat || stat.isSymbolicLink() || !stat.isFile() ||
      !sameIdentity(identity(stat), captured.target)) {
    fail(`${label} identity changed`);
  }
  const descriptor = fs.openSync(filePath,
    fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
  try {
    const opened = fs.fstatSync(descriptor, { bigint: true });
    const bytes = fs.readFileSync(descriptor);
    if (!sameIdentity(identity(opened), captured.target) ||
        crypto.createHash('sha256').update(bytes).digest('hex') !== captured.sha256) {
      fail(`${label} content changed`);
    }
    return bytes;
  } finally {
    fs.closeSync(descriptor);
  }
}

function readDescriptorBytes(descriptor, stat, label) {
  const size = Number(stat.size);
  if (!Number.isSafeInteger(size) || size < 0) {
    fail(`${label} size cannot be represented safely`);
  }
  const bytes = Buffer.alloc(size);
  let offset = 0;
  while (offset < size) {
    const count = fs.readSync(descriptor, bytes, offset, size - offset, offset);
    if (count === 0) fail(`${label} ended before its captured size`);
    offset += count;
  }
  return bytes;
}

function atomicWriteContainedFile(root, target, bytes, options = {}) {
  ensureAncestors(root, target);
  const captured = options.captured || captureTarget(root, target, true);
  assertCaptured(root, target, captured);
  const parent = path.dirname(target);
  const targetName = path.basename(target);
  const temporaryName = `.${targetName}.sd0x-${crypto.randomUUID()}.tmp`;
  const displacedName = `.${targetName}.sd0x-${crypto.randomUUID()}.previous`;
  const temporary = path.join(parent, temporaryName);
  const displaced = path.join(parent, displacedName);
  const boundParent = openBoundDirectory(parent);
  const boundTarget = boundParent.child(targetName);
  const boundTemporary = boundParent.child(temporaryName);
  const boundDisplaced = boundParent.child(displacedName);
  let descriptor;
  let priorDescriptor;
  let temporaryCapture;
  let displacedTarget = false;
  let installedTarget = false;
  let completed = false;
  const parentIsCaptured = () => {
    for (const ancestor of captured.ancestors) {
      const stat = fs.lstatSync(ancestor.path, {
        bigint: true,
        throwIfNoEntry: false
      });
      if (!stat || stat.isSymbolicLink() || !stat.isDirectory() ||
          !sameAncestorIdentity(identity(stat), ancestor.identity)) return false;
    }
    return true;
  };
  return boundParent.run(() => {
  try {
    if (captured.target) {
      priorDescriptor = fs.openSync(boundTarget,
        fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
      const opened = fs.fstatSync(priorDescriptor, { bigint: true });
      const priorBytes = readDescriptorBytes(priorDescriptor, opened, 'prior file');
      const priorSha256 = crypto.createHash('sha256').update(priorBytes).digest('hex');
      if (!captured.sha256) captured.sha256 = priorSha256;
      if (!sameIdentity(identity(opened), captured.target) ||
          priorSha256 !== captured.sha256) {
        fail(`contained file changed before displacement: ${path.relative(root, target)}`);
      }
    }
    descriptor = fs.openSync(boundTemporary,
      fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY |
      (fs.constants.O_NOFOLLOW || 0),
    captured.target ? Number(BigInt(captured.target.mode) & 0o777n) : 0o644);
    fs.writeFileSync(descriptor, bytes);
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    temporaryCapture = readContainedFile(root, temporary).captured;
    if (typeof options.beforeCommit === 'function') {
      options.beforeCommit({ root, target, temporary });
    }
    assertCaptured(root, target, captured);
    boundParent.assert();
    assertFileIdentity(boundTemporary, temporaryCapture, 'temporary file');
    if (captured.target) {
      fs.renameSync(boundTarget, boundDisplaced);
      displacedTarget = true;
      assertFileIdentity(boundDisplaced, captured, 'displaced file');
    }
    if (typeof options.beforeInstall === 'function') {
      options.beforeInstall({ root, target, temporary, displaced });
    }
    if (!parentIsCaptured()) {
      fail(`path ancestor identity changed: ${path.relative(root, parent)}`);
    }
    boundParent.assert();
    assertFileIdentity(boundTemporary, temporaryCapture, 'temporary file');
    if (fs.lstatSync(boundTarget, { throwIfNoEntry: false })) {
      fail(`contained file appeared during atomic installation: ${path.relative(root, target)}`);
    }
    if (displacedTarget) {
      assertFileIdentity(boundDisplaced, captured, 'displaced file');
    }
    fs.linkSync(boundTemporary, boundTarget);
    installedTarget = true;
    const installedStat = fs.lstatSync(boundTarget, { bigint: true });
    const installedBytes = assertFileIdentity(
      boundTarget, temporaryCapture, 'installed file'
    );
    if (!sameIdentity(identity(installedStat), temporaryCapture.target) ||
        !Buffer.from(installedBytes).equals(Buffer.from(bytes))) {
      fail(`atomic contained write verification failed: ${path.relative(root, target)}`);
    }
    if (displacedTarget) {
      assertFileIdentity(boundDisplaced, captured, 'displaced file');
      const opened = fs.fstatSync(priorDescriptor, { bigint: true });
      const priorBytes = readDescriptorBytes(priorDescriptor, opened, 'prior file');
      if (!sameIdentity(identity(opened), captured.target) ||
          crypto.createHash('sha256').update(priorBytes).digest('hex') !==
            captured.sha256) {
        fail(`displaced file changed during atomic installation: ${path.relative(root, target)}`);
      }
    }
    fs.unlinkSync(boundTemporary);
    if (displacedTarget) fs.unlinkSync(boundDisplaced);
    completed = true;
    return captureTarget(root, target);
  } catch (error) {
    if (parentIsCaptured() || boundParent) {
      try {
        if (installedTarget) {
          const installed = fs.lstatSync(boundTarget, {
            bigint: true,
            throwIfNoEntry: false
          });
          if (installed && temporaryCapture &&
              sameIdentity(identity(installed), temporaryCapture.target)) {
            fs.unlinkSync(boundTarget);
          }
        }
        if (displacedTarget && !fs.lstatSync(boundTarget, { throwIfNoEntry: false })) {
          const displacedStat = fs.lstatSync(boundDisplaced, {
            bigint: true,
            throwIfNoEntry: false
          });
          if (!displacedStat || displacedStat.isSymbolicLink() ||
              !displacedStat.isFile() ||
              !sameObjectIdentity(identity(displacedStat), captured.target)) {
            fail('displaced file identity changed before restoration');
          }
          fs.renameSync(boundDisplaced, boundTarget);
          displacedTarget = false;
        }
      } catch {
        // Preserve every remaining artifact for manual recovery.
      }
    }
    throw error;
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    if (priorDescriptor !== undefined) fs.closeSync(priorDescriptor);
    try {
      boundParent.assert();
      {
        const temporaryStat = fs.lstatSync(boundTemporary, { throwIfNoEntry: false });
        if (temporaryStat && temporaryStat.isFile() &&
            !temporaryStat.isSymbolicLink() && temporaryCapture &&
            sameIdentity(identity(temporaryStat), temporaryCapture.target)) {
          fs.rmSync(boundTemporary);
        }
        if (completed) fs.rmSync(boundDisplaced, { force: true });
      }
    } catch {
      // A changed parent is untrusted. Leave the original temporary file in its
      // captured directory instead of following the replacement pathname.
    }
    boundParent.close();
  }
  });
}

function atomicUpdateContainedFile(root, target, transform, options = {}) {
  const current = readContainedFile(root, target, 'utf8');
  const next = transform(current.bytes);
  if (typeof next !== 'string' && !Buffer.isBuffer(next)) {
    fail('contained file update must return text or bytes');
  }
  atomicWriteContainedFile(root, target, next, {
    captured: current.captured,
    beforeCommit: options.beforeCommit,
    beforeInstall: options.beforeInstall
  });
  return next;
}

module.exports = {
  atomicUpdateContainedFile,
  atomicWriteContainedFile,
  captureTarget,
  readContainedFile
};
