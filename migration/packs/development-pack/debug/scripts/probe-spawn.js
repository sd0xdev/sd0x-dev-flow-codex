'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const CLOSED_GIT_ENV = Object.freeze({ GIT_CONFIG_GLOBAL: os.devNull, GIT_CONFIG_NOSYSTEM: '1', GIT_NO_REPLACE_OBJECTS: '1', GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0' });

function pathIdentity(target) {
  return fs.lstatSync(target);
}

function resolvedPath(target) {
  return fs.realpathSync(target);
}

function targetIdentity(target) {
  return fs.statSync(target);
}

function gitExecutableCandidates(platform = process.platform) {
  if (platform === 'win32') {
    return [
      'C:\\Program Files\\Git\\cmd\\git.exe',
      'C:\\Program Files\\Git\\bin\\git.exe'
    ];
  }
  if (platform === 'darwin') {
    return ['/usr/bin/git', '/opt/homebrew/bin/git', '/usr/local/bin/git'];
  }
  return ['/usr/bin/git', '/bin/git', '/usr/local/bin/git'];
}

function protectedPosixPath(target) {
  let current = target;
  while (true) {
    const stat = pathIdentity(current);
    if (stat.uid !== 0 || (stat.mode & 0o022) !== 0) return false;
    const parent = path.dirname(current);
    if (parent === current) return true;
    current = parent;
  }
}

function trustedGitExecutable(platform = process.platform) {
  for (const candidate of gitExecutableCandidates(platform)) {
    try {
      const resolved = resolvedPath(candidate);
      const stat = targetIdentity(resolved);
      if (!stat.isFile()) continue;
      if (platform === 'win32') {
        const normalized = resolved.replaceAll('/', '\\').toLowerCase();
        if (!normalized.startsWith('c:\\program files\\git\\')) continue;
      } else if (!protectedPosixPath(candidate) || !protectedPosixPath(resolved)) {
        continue;
      }
      return resolved;
    } catch {
      continue;
    }
  }
  throw new Error('trusted Git executable is unavailable for ' + platform);
}

const TRUSTED_GIT_EXECUTABLE = trustedGitExecutable();

function spawnAllowed(normalized, cwd) {
  let child = null;
  if (normalized === 'git rev-parse --verify refs/sd0x-debug-probe/missing') {
    child = spawn(TRUSTED_GIT_EXECUTABLE, ['--no-optional-locks', '-c', 'core.hooksPath=/dev/null', '-c', 'core.fsmonitor=false', '-c', 'submodule.recurse=false', '-c', 'pager.rev-parse=false', 'rev-parse', '--verify', 'refs/sd0x-debug-probe/missing'], { cwd: cwd, encoding: 'utf8', env: CLOSED_GIT_ENV, stdio: ['ignore', 'pipe', 'pipe'] });
  }
  if (!child) throw new Error('classified probe lacks a literal runner');
  return child;
}

module.exports = { gitExecutableCandidates, spawnAllowed, trustedGitExecutable };
