'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  runPrecommitMode
} = require('../plugin/sd0x-dev-flow-codex/scripts/runtime/verify');

function fixture(t, scripts) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-verify-mode-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ scripts }));
  return root;
}

test('verify fast requires approval, continues after failure, and reports mutation', (t) => {
  const root = fixture(t, { 'lint:fix': 'fix', 'test:fast': 'test' });
  const calls = [];
  const runCommand = (command, args) => {
    calls.push([command, ...args]);
    if (args.join(' ') === 'run lint:fix') {
      fs.writeFileSync(path.join(root, 'fixed.js'), 'fixed\n');
      return { status: 1, stdout: '', stderr: 'lint failed' };
    }
    if (command === 'git' || command === 'git.exe') {
      return { status: 0, stdout: 'fixed.js\n', stderr: '' };
    }
    return { status: 0, stdout: 'ok\n', stderr: '' };
  };
  assert.throws(
    () => runPrecommitMode(root, 'fast', { runCommand }),
    /separate explicit approval/
  );
  assert.deepEqual(calls, []);
  const result = runPrecommitMode(root, 'fast', {
    allowFixes: true,
    runCommand,
    platform: 'linux'
  });
  assert.deepEqual(calls.map((argv) => argv.slice(1).join(' ')), [
    'run lint:fix', 'run test:fast', 'diff --name-only'
  ]);
  assert.deepEqual(result.results.map((entry) => entry.status), [
    'failed', 'passed'
  ]);
  assert.deepEqual(result.changed_files, ['fixed.js']);
  assert.equal(result.failure_behavior, 'continue-all');
  assert.equal(result.runtime_gate_written, false);
  assert.equal(result.outcome, 'fail');
});

test('verify precommit preserves order and never writes gate state', (t) => {
  const root = fixture(t, {
    'lint:fix': 'fix',
    build: 'build',
    'test:ci': 'test'
  });
  const calls = [];
  const runCommand = (command, args) => {
    calls.push([command, ...args]);
    if (args.join(' ') === 'run build') {
      return { status: 2, stdout: '', stderr: 'build failed' };
    }
    if (command === 'git' || command === 'git.exe') {
      return { status: 0, stdout: '', stderr: '' };
    }
    return { status: 0, stdout: 'ok\n', stderr: '' };
  };
  const result = runPrecommitMode(root, 'precommit', {
    allowFixes: true,
    runCommand,
    platform: 'linux'
  });
  assert.deepEqual(calls.map((argv) => argv.slice(1).join(' ')), [
    'run lint:fix', 'run build', 'run test:ci', 'diff --name-only'
  ]);
  assert.deepEqual(result.results.map((entry) => entry.status), [
    'passed', 'failed', 'passed'
  ]);
  assert.equal(result.gating, false);
  assert.equal(result.runtime_gate_written, false);
  assert.equal(result.outcome, 'fail');
});

test('verify modes bound timed-out commands and continue later steps', (t) => {
  const root = fixture(t, {
    'lint:fix': 'fix',
    build: 'build',
    test: 'test'
  });
  const calls = [];
  const result = runPrecommitMode(root, 'precommit', {
    allowFixes: true,
    timeoutMs: 321,
    platform: 'linux',
    runCommand(command, args, options) {
      calls.push({ argv: [command, ...args], timeout: options.timeout });
      if (args.join(' ') === 'run lint:fix') {
        return { status: null, error: { code: 'ETIMEDOUT', message: 'timed out' } };
      }
      return { status: 0, stdout: '', stderr: '' };
    }
  });
  assert.deepEqual(calls.map((call) => call.argv.slice(1).join(' ')), [
    'run lint:fix', 'run build', 'run test', 'diff --name-only'
  ]);
  assert.equal(calls.every((call) => call.timeout === 321), true);
  assert.equal(result.results[0].exit_code, 124);
  assert.equal(result.results[0].timed_out, true);
  assert.deepEqual(result.results.slice(1).map((entry) => entry.status), [
    'passed', 'passed'
  ]);
  assert.equal(result.outcome, 'fail');
});

test('verify modes fail when changed-file inspection cannot be collected', (t) => {
  const root = fixture(t, { 'lint:fix': 'fix', 'test:fast': 'test' });
  const result = runPrecommitMode(root, 'fast', {
    allowFixes: true,
    platform: 'linux',
    runCommand(command) {
      if (command === 'git' || command === 'git.exe') {
        return {
          status: null,
          error: { code: 'ETIMEDOUT', message: 'diff timed out' }
        };
      }
      return { status: 0, stdout: 'ok\n', stderr: '' };
    }
  });
  assert.deepEqual(result.results.map((entry) => entry.status), [
    'passed', 'passed'
  ]);
  assert.equal(result.changed_files_check.exit_code, 124);
  assert.equal(result.changed_files_check.timed_out, true);
  assert.deepEqual(result.changed_files, []);
  assert.equal(result.outcome, 'fail');
});
