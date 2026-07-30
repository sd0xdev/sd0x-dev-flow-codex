'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const CLOSED_GIT_ENV = Object.freeze({ GIT_CONFIG_GLOBAL: os.devNull, GIT_CONFIG_NOSYSTEM: '1', GIT_NO_LAZY_FETCH: '1', GIT_NO_REPLACE_OBJECTS: '1', GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0' });

function splitNull(value) {
  return value.toString('utf8').split('\0').filter(Boolean);
}

function realPath(candidate) {
  return fs.realpathSync(candidate);
}

function pathStat(candidate) {
  return fs.lstatSync(candidate);
}

function contained(repository, relative) {
  const absolute = path.resolve(repository, relative);
  const relation = path.relative(repository, absolute);
  if (relation === '..' || relation.startsWith('..' + path.sep) ||
      path.isAbsolute(relation)) {
    throw new Error('worktree path escapes the repository');
  }
  return absolute;
}

function hashPath(hash, repository, relative) {
  const absolute = contained(repository, relative);
  let stat;
  try {
    stat = pathStat(absolute);
  } catch (error) {
    hash.update('missing:' + (error.code || error.message));
    return;
  }
  hash.update('mode:' + stat.mode + ':size:' + stat.size + '\0');
  if (stat.isSymbolicLink()) {
    hash.update('symlink:' + fs.readlinkSync(absolute));
    return;
  }
  if (stat.isDirectory()) {
    let nestedTop = '';
    try {
      const nestedOutput = execFileSync('git', ['--no-replace-objects', '--no-optional-locks', '--no-pager', '-c', 'core.fsmonitor=false', '-c', 'submodule.recurse=false', 'rev-parse', '--show-toplevel'], { cwd: absolute, encoding: 'utf8', env: CLOSED_GIT_ENV, stdio: ['ignore', 'pipe', 'pipe'] });
      nestedTop = nestedOutput.trim();
    } catch {
      hash.update('directory');
      return;
    }
    if (realPath(nestedTop) !== realPath(absolute)) {
      hash.update('directory');
      return;
    }
    hash.update('nested-repository:' + fingerprint(absolute));
    return;
  }
  if (!stat.isFile()) {
    hash.update('non-file');
    return;
  }
  hash.update(fs.readFileSync(absolute));
}

function fingerprint(cwd = process.cwd()) {
  const requested = realPath(path.resolve(cwd));
  const top = execFileSync('git', ['--no-replace-objects', '--no-optional-locks', '--no-pager', '-c', 'core.fsmonitor=false', '-c', 'submodule.recurse=false', 'rev-parse', '--show-toplevel'], { cwd: requested, encoding: 'utf8', env: CLOSED_GIT_ENV, stdio: ['ignore', 'pipe', 'pipe'] });
  const repository = realPath(path.resolve(top.trim()));
  const relation = path.relative(repository, requested);
  if (relation === '..' || relation.startsWith('..' + path.sep) ||
      path.isAbsolute(relation)) {
    throw new Error('Git resolved outside the requested repository');
  }
  const head = execFileSync('git', ['--no-replace-objects', '--no-optional-locks', '--no-pager', '-c', 'core.fsmonitor=false', '-c', 'submodule.recurse=false', 'rev-parse', 'HEAD'], { cwd: repository, encoding: 'utf8', env: CLOSED_GIT_ENV, stdio: ['ignore', 'pipe', 'pipe'] });
  const status = execFileSync('git', ['--no-replace-objects', '--no-optional-locks', '--no-pager', '-c', 'core.fsmonitor=false', '-c', 'submodule.recurse=false', 'status', '--porcelain=v1', '-z', '--untracked-files=all', '--ignore-submodules=none'], { cwd: repository, encoding: 'buffer', env: CLOSED_GIT_ENV, stdio: ['ignore', 'pipe', 'pipe'] });
  const tracked = execFileSync('git', ['--no-replace-objects', '--no-optional-locks', '--no-pager', '-c', 'core.fsmonitor=false', '-c', 'submodule.recurse=false', 'diff', 'HEAD', '--binary', '--no-ext-diff', '--no-textconv', '--ignore-submodules=none'], { cwd: repository, encoding: 'buffer', env: CLOSED_GIT_ENV, stdio: ['ignore', 'pipe', 'pipe'] });
  const stagedNames = execFileSync('git', ['--no-replace-objects', '--no-optional-locks', '--no-pager', '-c', 'core.fsmonitor=false', '-c', 'submodule.recurse=false', 'diff', '--cached', '--name-only', '-z', '--no-renames', '--no-ext-diff', '--no-textconv', '--ignore-submodules=none'], { cwd: repository, encoding: 'buffer', env: CLOSED_GIT_ENV, stdio: ['ignore', 'pipe', 'pipe'] });
  const unstagedNames = execFileSync('git', ['--no-replace-objects', '--no-optional-locks', '--no-pager', '-c', 'core.fsmonitor=false', '-c', 'submodule.recurse=false', 'diff', '--name-only', '-z', '--no-renames', '--no-ext-diff', '--no-textconv', '--ignore-submodules=none'], { cwd: repository, encoding: 'buffer', env: CLOSED_GIT_ENV, stdio: ['ignore', 'pipe', 'pipe'] });
  const untrackedRaw = execFileSync('git', ['--no-replace-objects', '--no-optional-locks', '--no-pager', '-c', 'core.fsmonitor=false', '-c', 'submodule.recurse=false', 'ls-files', '--others', '--exclude-standard', '-z'], { cwd: repository, encoding: 'buffer', env: CLOSED_GIT_ENV, stdio: ['ignore', 'pipe', 'pipe'] });
  const changed = [...new Set([
    ...splitNull(stagedNames),
    ...splitNull(unstagedNames),
    ...splitNull(untrackedRaw)
  ])].sort();
  const hash = crypto.createHash('sha256');
  const parts = [Buffer.from(repository), Buffer.from(head), status, tracked];
  for (const part of parts) {
    hash.update(String(part.length));
    hash.update(Buffer.from([0]));
    hash.update(part);
  }
  for (const relative of changed) {
    hash.update('\0path:' + relative + '\0');
    hashPath(hash, repository, relative);
  }
  return hash.digest('hex');
}

function sha256Text(value) {
  if (typeof value !== 'string' || value.length !== 64) return false;
  for (const character of value) {
    const code = character.charCodeAt(0);
    const digit = code >= 48 && code <= 57;
    const lowercaseHex = code >= 97 && code <= 102;
    if (!digit && !lowercaseHex) return false;
  }
  return true;
}

function main(argv = process.argv.slice(2), cwd = process.cwd()) {
  if (argv.length === 1 && argv[0] === 'snapshot') {
    process.stdout.write(JSON.stringify({
      schema_version: 1,
      fingerprint: fingerprint(cwd)
    }) + '\n');
    return 0;
  }
  if (argv.length === 3 && argv[0] === 'compare' && argv[1] === '--expect' &&
      sha256Text(argv[2])) {
    const actual = fingerprint(cwd);
    const ok = actual === argv[2];
    process.stdout.write(JSON.stringify({
      schema_version: 1,
      ok,
      fingerprint: actual
    }) + '\n');
    return ok ? 0 : 2;
  }
  throw new Error('usage: run-verify.js snapshot | compare --expect SHA256');
}

if (require.main === module) {
  try {
    process.exitCode = main();
  } catch (error) {
    process.stderr.write('run-verify: ' + error.message + '\n');
    process.exitCode = 1;
  }
}

module.exports = { fingerprint, main };
