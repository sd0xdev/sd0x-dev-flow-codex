'use strict';

const { execFileSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const {
  cleanGitEnvironment
} = require('../plugin/sd0x-dev-flow-codex/scripts/runtime/worktree');

const ZERO_OID = '0'.repeat(40);

function fail(message) {
  throw new Error(message);
}

function git(root, args, options = {}) {
  return execFileSync('git', ['--no-replace-objects', ...args], {
    cwd: root,
    encoding: options.encoding === undefined ? 'utf8' : options.encoding,
    env: {
      ...cleanGitEnvironment(),
      GIT_OPTIONAL_LOCKS: '0',
      GIT_TERMINAL_PROMPT: '0'
    },
    input: options.input,
    stdio: ['pipe', 'pipe', 'pipe'],
    maxBuffer: 1024 * 1024
  });
}

function processLiveness(pid) {
  try {
    process.kill(pid, 0);
    return 'alive';
  } catch (error) {
    if (error?.code === 'ESRCH') return 'dead';
    if (error?.code === 'EPERM') return 'alive';
    return 'unknown';
  }
}

function processGeneration(pid) {
  if (!Number.isSafeInteger(pid) || pid <= 0) return { status: 'unknown' };
  const liveness = processLiveness(pid);
  if (liveness !== 'alive') return { status: liveness };
  if (process.platform === 'linux') {
    try {
      const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8');
      const tail = stat.slice(stat.lastIndexOf(')') + 2).trim().split(/\s+/);
      const startTicks = tail[19];
      const bootId = fs.readFileSync(
        '/proc/sys/kernel/random/boot_id',
        'utf8'
      ).trim();
      if (!/^\d+$/.test(startTicks) || !/^[0-9a-f-]+$/.test(bootId)) {
        return { status: 'unknown' };
      }
      return {
        status: 'alive',
        generation: `linux:${bootId}:${startTicks}`
      };
    } catch {
      return { status: 'unknown' };
    }
  }
  if (process.platform === 'darwin' || process.platform === 'freebsd' ||
      process.platform === 'openbsd' || process.platform === 'aix') {
    try {
      const output = execFileSync('/bin/ps', [
        '-o', 'lstart=', '-p', String(pid)
      ], {
        encoding: 'utf8',
        env: {
          ...cleanGitEnvironment(),
          LANG: 'C',
          LANGUAGE: 'C',
          LC_ALL: 'C',
          TZ: 'UTC0'
        },
        stdio: ['ignore', 'pipe', 'pipe']
      }).trim().replace(/\s+/g, ' ');
      return output
        ? { status: 'alive', generation: `${process.platform}:${output}` }
        : { status: 'unknown' };
    } catch {
      return { status: 'unknown' };
    }
  }
  if (process.platform === 'win32') {
    try {
      const output = execFileSync('powershell.exe', [
        '-NoLogo', '-NoProfile', '-NonInteractive', '-Command',
        `(Get-Process -Id ${pid} -ErrorAction Stop).StartTime.ToUniversalTime().Ticks`
      ], {
        encoding: 'utf8',
        env: cleanGitEnvironment(),
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe']
      }).trim();
      return /^\d+$/.test(output)
        ? { status: 'alive', generation: `win32:${output}` }
        : { status: 'unknown' };
    } catch {
      return { status: 'unknown' };
    }
  }
  return { status: 'unknown' };
}

function readOwner(root, ref, target) {
  let oid;
  try {
    oid = git(root, ['rev-parse', '--verify', ref]).trim();
  } catch {
    return null;
  }
  if (!/^[0-9a-f]{40}$/.test(oid)) {
    fail(`${target}: candidate transaction ref is invalid`);
  }
  let bytes;
  try {
    bytes = git(root, ['cat-file', 'blob', oid], { encoding: null });
  } catch {
    fail(`${target}: candidate transaction owner object is unavailable`);
  }
  let owner;
  try {
    owner = JSON.parse(bytes.toString('utf8'));
  } catch {
    fail(`${target}: candidate transaction owner is invalid`);
  }
  if (owner?.schema_version !== 3 ||
      !Number.isSafeInteger(owner.pid) || owner.pid <= 0 ||
      typeof owner.nonce !== 'string' ||
      !/^[0-9a-f-]{36}$/.test(owner.nonce) ||
      !Number.isFinite(owner.process_started_at_ms) ||
      typeof owner.process_generation !== 'string' ||
      owner.process_generation.length === 0 ||
      owner.process_generation.length > 512) {
    fail(`${target}: candidate transaction owner is invalid`);
  }
  return { bytes, oid, owner };
}

function updateRef(root, ref, next, expected) {
  try {
    git(root, ['update-ref', ref, next, expected]);
    return true;
  } catch {
    return false;
  }
}

function deleteRef(root, ref, expected) {
  try {
    git(root, ['update-ref', '-d', ref, expected]);
    return true;
  } catch {
    return false;
  }
}

function acquireCandidateTransaction(root, target, options = {}) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(target || '')) {
    fail('candidate transaction target must be canonical');
  }
  const repositoryIdentity = crypto.createHash('sha256')
    .update(git(root, ['rev-parse', '--git-dir']).trim())
    .digest('hex')
    .slice(0, 16);
  const ref = `refs/sd0x-dev-flow-codex/runtime/` +
    `candidate-transactions/${repositoryIdentity}/${target}`;
  const currentProcess = processGeneration(process.pid);
  if (currentProcess.status !== 'alive' || !currentProcess.generation) {
    fail('candidate transaction process generation is unavailable');
  }
  const owner = {
    schema_version: 3,
    pid: process.pid,
    process_started_at_ms: Date.now() - Math.round(process.uptime() * 1000),
    process_generation: currentProcess.generation,
    nonce: crypto.randomUUID()
  };
  const ownerBytes = Buffer.from(`${JSON.stringify(owner)}\n`);
  const oid = git(root, ['hash-object', '-w', '--stdin'], {
    input: ownerBytes
  }).trim();
  if (typeof options.afterOwnerWrite === 'function') {
    options.afterOwnerWrite({ oid, ref });
  }

  let acquired = false;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const current = readOwner(root, ref, target);
    if (!current) {
      if (updateRef(root, ref, oid, ZERO_OID)) {
        acquired = true;
        break;
      }
      continue;
    }
    const observedOwner = processGeneration(current.owner.pid);
    if (observedOwner.status === 'unknown') {
      fail(`${target}: candidate transaction owner generation is unavailable`);
    }
    if (observedOwner.status === 'alive' &&
        observedOwner.generation === current.owner.process_generation) {
      fail(`${target}: candidate transaction is already active`);
    }
    if (typeof options.beforeStaleClaim === 'function') {
      options.beforeStaleClaim({ current, oid, ref });
    }
    if (updateRef(root, ref, oid, current.oid)) {
      acquired = true;
      break;
    }
  }
  if (!acquired) {
    fail(`${target}: candidate transaction changed during acquisition`);
  }

  let released = false;
  const assertLease = () => {
    if (released) fail(`${target}: candidate transaction is already released`);
    const current = readOwner(root, ref, target);
    if (!current || current.oid !== oid || !current.bytes.equals(ownerBytes)) {
      fail(`${target}: candidate transaction lease changed`);
    }
  };
  return {
    assert: assertLease,
    ref,
    release() {
      if (released) return;
      assertLease();
      if (!deleteRef(root, ref, oid)) {
        fail(`${target}: candidate transaction changed during release`);
      }
      released = true;
    }
  };
}

module.exports = { acquireCandidateTransaction };
