'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { environment } = require('./deployment');

// Host state and installed dependencies are outside the worker's admitted write scope.
// Their exclusion is a stated observation limit, never permission to modify them.
const EXCLUDED_DIRECTORIES = new Set(['node_modules', '.codex-dev-home']);
const LIMIT = 512 * 1024 * 1024;

function proof(cwd) {
  const root = fs.realpathSync(cwd);
  const hash = crypto.createHash('sha256');
  let bytes = 0;
  function frame(value) {
    const data = Buffer.isBuffer(value) ? value : Buffer.from(String(value));
    hash.update(String(data.length) + ':'); hash.update(data);
  }
  function walk(absolute, relative, metadata = false) {
    const stat = fs.lstatSync(absolute);
    if (stat.isDirectory()) {
      if ((!metadata && (EXCLUDED_DIRECTORIES.has(path.basename(absolute)) || relative === '.git')) ||
          (metadata && (relative === 'objects' || relative === 'sd0x-dev-flow-codex'))) return;
      frame(relative); frame(stat.mode);
      for (const name of fs.readdirSync(absolute).sort()) {
        walk(path.join(absolute, name), relative ? `${relative}/${name}` : name, metadata);
      }
      return;
    }
    frame(relative); frame(stat.mode);
    if (stat.isSymbolicLink()) { frame(fs.readlinkSync(absolute)); return; }
    if (!stat.isFile()) throw new Error('Cannot certify non-regular repository entry');
    bytes += stat.size;
    if (bytes > LIMIT || !(stat.mode & 0o444)) throw new Error('Read-only proof incomplete: byte budget or unreadable entry');
    const fd = fs.openSync(absolute, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
    try {
      const before = fs.fstatSync(fd);
      if (before.ino !== stat.ino || before.dev !== stat.dev) throw new Error('Read-only proof raced');
      frame(fs.readFileSync(fd));
      const after = fs.fstatSync(fd);
      const current = fs.lstatSync(absolute);
      if (before.size !== after.size || before.mtimeMs !== after.mtimeMs || before.ctimeMs !== after.ctimeMs ||
          current.ino !== before.ino || current.dev !== before.dev) throw new Error('Read-only proof raced');
    } finally { fs.closeSync(fd); }
  }
  const git = args => execFileSync('git', ['--no-optional-locks', '-c', 'core.fsmonitor=false', ...args],
    { cwd: root, encoding: 'utf8', env: environment(), timeout: 30000, maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  frame('sd0x-readonly-proof-v1'); frame(root);
  walk(root, '');
  const dirs = [...new Set(['--git-dir', '--git-common-dir'].map(flag =>
    fs.realpathSync(path.resolve(root, git(['rev-parse', flag]).trim()))))].sort();
  for (const directory of dirs) { frame(directory); walk(directory, '', true); }
  frame(git(['worktree', 'list', '--porcelain', '-z']));
  return hash.digest('hex');
}

module.exports = { proof, EXCLUDED_DIRECTORIES, LIMIT };
