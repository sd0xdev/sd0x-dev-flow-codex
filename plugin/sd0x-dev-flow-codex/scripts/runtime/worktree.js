'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const DOC_EXTENSIONS = new Set([
  '.adoc', '.md', '.mdx', '.rst', '.txt'
]);

const IGNORED_PREFIXES = [
  '.git/', '.sd0x/'
];

const PROTECTED_PATTERNS = [
  /(^|\/)\.env(?:\..+)?$/i,
  /(^|\/)\.git(?:\/|$)/i,
  /(^|\/)(?:id_rsa|id_ed25519)(?:\.pub)?$/i,
  /(^|\/)(?:credentials|secrets?)\.(?:json|ya?ml|toml)$/i,
  /\.(?:key|p12|pfx|pem)$/i
];

function runGit(cwd, args, options = {}) {
  const result = spawnSync('git', args, {
    cwd,
    encoding: options.encoding === undefined ? 'utf8' : options.encoding,
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true
  });

  if (result.status !== 0) {
    const stderr = Buffer.isBuffer(result.stderr)
      ? result.stderr.toString('utf8')
      : result.stderr;
    throw new Error(stderr.trim() || `git ${args.join(' ')} failed`);
  }

  return result.stdout;
}

function findRepoRoot(cwd = process.cwd()) {
  try {
    return path.resolve(runGit(cwd, ['rev-parse', '--show-toplevel']).trim());
  } catch {
    return path.resolve(cwd);
  }
}

function splitNull(value) {
  return value.split('\0').filter(Boolean);
}

function normalizeRelative(root, filePath) {
  const absolute = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(root, filePath);
  return path.relative(root, absolute).split(path.sep).join('/');
}

function shouldIgnore(filePath) {
  return IGNORED_PREFIXES.some((prefix) => filePath.startsWith(prefix));
}

function classifyFiles(files) {
  const docs = [];
  const code = [];
  const other = [];

  for (const file of files) {
    const extension = path.extname(file).toLowerCase();
    if (DOC_EXTENSIONS.has(extension)) {
      docs.push(file);
    } else if (extension || path.basename(file).includes('.')) {
      code.push(file);
    } else {
      other.push(file);
    }
  }

  return { docs, code, other };
}

function nestedRepositoryFingerprint(directory) {
  const rootResult = spawnSync('git', ['-C', directory, 'rev-parse', '--show-toplevel'], {
    encoding: 'utf8',
    windowsHide: true
  });
  if (rootResult.status !== 0 || !rootResult.stdout.trim()) return null;

  try {
    if (fs.realpathSync(rootResult.stdout.trim()) !== fs.realpathSync(directory)) {
      return null;
    }
  } catch {
    return null;
  }

  const headResult = spawnSync('git', ['-C', directory, 'rev-parse', 'HEAD'], {
    encoding: 'utf8',
    windowsHide: true
  });
  const head = headResult.status === 0 ? headResult.stdout.trim() : 'unborn';
  return `${head}:${snapshot(directory).fingerprint}`;
}

function updateHashForPath(hash, root, relativePath) {
  const absolute = path.resolve(root, relativePath);
  const containment = path.relative(path.resolve(root), absolute);
  if (containment === '..' || containment.startsWith(`..${path.sep}`) ||
      path.isAbsolute(containment)) {
    hash.update('outside-root');
    return;
  }

  try {
    const stats = fs.lstatSync(absolute);
    hash.update(`mode:${stats.mode}:size:${stats.size}\0`);
    if (stats.isSymbolicLink()) {
      hash.update(`symlink:${fs.readlinkSync(absolute)}`);
      return;
    }
    if (stats.isDirectory()) {
      const nestedFingerprint = nestedRepositoryFingerprint(absolute);
      hash.update(nestedFingerprint
        ? `nested-repository:${nestedFingerprint}`
        : `non-file:${stats.mode}`);
      return;
    }
    if (!stats.isFile()) {
      hash.update(`non-file:${stats.mode}`);
      return;
    }
    const descriptor = fs.openSync(absolute, 'r');
    try {
      const buffer = Buffer.allocUnsafe(64 * 1024);
      let bytesRead;
      do {
        bytesRead = fs.readSync(descriptor, buffer, 0, buffer.length, null);
        if (bytesRead > 0) hash.update(buffer.subarray(0, bytesRead));
      } while (bytesRead > 0);
    } finally {
      fs.closeSync(descriptor);
    }
  } catch (error) {
    hash.update(`unreadable:${error.code || error.message}`);
  }
}

function snapshot(cwd = process.cwd()) {
  const root = findRepoRoot(cwd);
  let tracked = [];
  let untracked = [];
  let indexDiff = Buffer.alloc(0);
  let worktreeDiff = Buffer.alloc(0);

  try {
    untracked = splitNull(runGit(root, [
      'ls-files', '--others', '--exclude-standard', '-z'
    ]));
    const staged = splitNull(runGit(root, [
      'diff', '--cached', '--ignore-submodules=none', '--no-renames',
      '--name-only', '-z', '--'
    ]));
    const unstaged = splitNull(runGit(root, [
      'diff', '--ignore-submodules=none', '--no-renames', '--name-only', '-z', '--'
    ]));
    tracked = [...new Set([...staged, ...unstaged])];
    indexDiff = runGit(root, [
      'diff', '--cached', '--ignore-submodules=none', '--raw', '-z',
      '--no-ext-diff', '--no-renames', '--'
    ], { encoding: null });
    worktreeDiff = runGit(root, [
      'diff', '--ignore-submodules=none', '--raw', '-z', '--no-ext-diff',
      '--no-renames', '--'
    ], { encoding: null });
  } catch {
    untracked = walkFiles(root);
  }

  const files = [...new Set([...tracked, ...untracked])]
    .map((file) => normalizeRelative(root, file))
    .filter((file) => file && !file.startsWith('../') && !shouldIgnore(file))
    .sort();

  if (files.length === 0) {
    return {
      root,
      fingerprint: 'clean',
      files: [],
      code_files: [],
      doc_files: [],
      other_files: [],
      requires_review: false,
      requires_verify: false
    };
  }

  const hash = crypto.createHash('sha256');
  hash.update('sd0x-dev-flow-codex:v2\0index\0');
  hash.update(indexDiff);
  hash.update('\0worktree\0');
  hash.update(worktreeDiff);
  const untrackedSet = new Set(
    untracked.map((item) => normalizeRelative(root, item))
  );
  for (const file of files) {
    hash.update(`\0${untrackedSet.has(file) ? 'untracked' : 'tracked'}:${file}\0`);
    updateHashForPath(hash, root, file);
  }

  const classified = classifyFiles(files);
  return {
    root,
    fingerprint: hash.digest('hex'),
    files,
    code_files: classified.code,
    doc_files: classified.docs,
    other_files: classified.other,
    requires_review: true,
    requires_verify: classified.code.length > 0 || classified.other.length > 0
  };
}

function walkFiles(root, directory = root) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    const relative = normalizeRelative(root, absolute);
    if (shouldIgnore(relative) || relative === '.git') continue;
    if (entry.isDirectory()) {
      files.push(...walkFiles(root, absolute));
    } else if (entry.isFile() || entry.isSymbolicLink()) {
      files.push(relative);
    }
  }
  return files;
}

function extractPatchPaths(command = '') {
  const paths = [];
  const pattern = /^\*\*\* (?:Add|Update|Delete) File: (.+)$/gm;
  for (const match of command.matchAll(pattern)) {
    paths.push(match[1].trim());
  }
  const movePattern = /^\*\*\* Move to: (.+)$/gm;
  for (const match of command.matchAll(movePattern)) {
    paths.push(match[1].trim());
  }
  return [...new Set(paths)];
}

function extractToolPaths(input = {}) {
  const toolInput = input.tool_input || {};
  const paths = [];

  for (const key of ['file_path', 'path', 'notebook_path']) {
    if (typeof toolInput[key] === 'string') paths.push(toolInput[key]);
  }
  if (Array.isArray(toolInput.paths)) paths.push(...toolInput.paths);
  if (typeof toolInput.command === 'string') {
    paths.push(...extractPatchPaths(toolInput.command));
  }

  return [...new Set(paths.filter((item) => typeof item === 'string' && item))];
}

function isProtectedPath(filePath, root = process.cwd()) {
  const relative = normalizeRelative(root, filePath);
  if (/(^|\/)\.env\.(?:example|sample|template)$/i.test(relative)) {
    return false;
  }
  return PROTECTED_PATTERNS.some((pattern) => pattern.test(relative));
}

module.exports = {
  classifyFiles,
  extractPatchPaths,
  extractToolPaths,
  findRepoRoot,
  isProtectedPath,
  normalizeRelative,
  snapshot
};
