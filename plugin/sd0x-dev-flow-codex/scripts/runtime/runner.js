#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { inspectSessionContext, sessionEnvironment } = require('./session-context');

const MAX_RUNTIME_OUTPUT_BYTES = 4 * 1024 * 1024;
const RUNTIME_ENTRYPOINTS = Object.freeze({
  'create-request/request-tool.js': 'skills/create-request/scripts/request-tool.js',
  'doctor/doctor.js': 'skills/doctor/scripts/doctor.js',
  'remind/status.js': 'skills/remind/scripts/status.js',
  'reset/reset.js': 'skills/reset/scripts/reset.js',
  'review/gate.js': 'skills/review/scripts/gate.js',
  'review/provider.js': 'skills/review/scripts/provider.js',
  'review/round.js': 'skills/review/scripts/round.js',
  'review/snapshot.js': 'skills/review/scripts/snapshot.js',
  'setup/setup.js': 'skills/setup/scripts/setup.js',
  'verify/verify.js': 'skills/verify/scripts/verify.js'
});

function runtimeChildEnvironment(environment = process.env) {
  const childEnvironment = { ...environment };
  const unsafe = new Set([
    'NODE_OPTIONS',
    'NODE_PATH',
    'LD_PRELOAD',
    'LD_LIBRARY_PATH',
    'DYLD_INSERT_LIBRARIES',
    'DYLD_LIBRARY_PATH',
    'DYLD_FRAMEWORK_PATH'
  ]);
  for (const name of Object.keys(childEnvironment)) {
    if (unsafe.has(name.toUpperCase())) delete childEnvironment[name];
  }
  return childEnvironment;
}

function validateRuntimeInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('runtime input must be an object');
  }
  const extra = Object.keys(input)
    .filter((name) => !['args', 'cwd', 'entrypoint', 'context'].includes(name));
  if (extra.length > 0) {
    throw new Error(`runtime input contains unsupported fields: ${extra.join(', ')}`);
  }
  if (!Object.hasOwn(RUNTIME_ENTRYPOINTS, input.entrypoint)) {
    throw new Error('entrypoint is not an allowlisted installed skill script');
  }
  if (typeof input.cwd !== 'string' || !path.isAbsolute(input.cwd) ||
      input.cwd.includes('\0')) {
    throw new Error('cwd must be an absolute path');
  }
  const args = input.args === undefined ? [] : input.args;
  if (!Array.isArray(args) || args.length > 64 ||
      args.some((value) =>
        typeof value !== 'string' || value.length > 16 * 1024 || value.includes('\0'))) {
    throw new Error('args must contain at most 64 bounded strings');
  }
  let cwd;
  try {
    cwd = fs.realpathSync(input.cwd);
  } catch {
    throw new Error('cwd must resolve to an existing directory');
  }
  if (!fs.statSync(cwd).isDirectory()) {
    throw new Error('cwd must resolve to an existing directory');
  }
  return { args, cwd, entrypoint: input.entrypoint, context: input.context };
}

function runSkillScript(input, options = {}) {
  const validated = validateRuntimeInput(input);
  const pluginRoot = fs.realpathSync(options.pluginRoot ||
    path.resolve(__dirname, '..', '..'));
  const script = fs.realpathSync(path.resolve(
    pluginRoot,
    RUNTIME_ENTRYPOINTS[validated.entrypoint]
  ));
  const relativeScript = path.relative(pluginRoot, script);
  if (!relativeScript || relativeScript.startsWith('..') || path.isAbsolute(relativeScript)) {
    throw new Error('runtime entrypoint escapes the installed plugin payload');
  }
  const nodeExecutable = fs.realpathSync(options.nodeExecutable || process.execPath);
  const spawnProcess = options.spawnProcess || spawn;
  const maxOutputBytes = options.maxOutputBytes || MAX_RUNTIME_OUTPUT_BYTES;
  const environment = runtimeChildEnvironment(sessionEnvironment(
    validated.context, options.environment || process.env, validated.cwd
  ));
  const context = inspectSessionContext(validated.cwd, environment);
  const diagnostic = !context.available && /^(doctor|review|verify|remind)\//.test(validated.entrypoint)
    ? `[sd0x review-context] ${JSON.stringify(context)}\n` : '';

  return new Promise((resolve, reject) => {
    let settled = false;
    let outputBytes = 0;
    const stdout = [];
    const stderr = [];
    const child = spawnProcess(nodeExecutable, [script, ...validated.args], {
      cwd: validated.cwd,
      env: environment,
      signal: options.signal,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true
    });
    const finish = (callback) => {
      if (settled) return;
      settled = true;
      callback();
    };
    const append = (target, chunk) => {
      const body = Buffer.from(chunk);
      outputBytes += body.length;
      if (outputBytes > maxOutputBytes) {
        child.kill('SIGKILL');
        finish(() => reject(new Error('trusted skill script output exceeded the limit')));
        return;
      }
      target.push(body);
    };
    child.stdout.on('data', (chunk) => append(stdout, chunk));
    child.stderr.on('data', (chunk) => append(stderr, chunk));
    child.once('error', (error) => finish(() => reject(error)));
    child.once('close', (code, signal) => finish(() => resolve({
      schema_version: 1,
      entrypoint: validated.entrypoint,
      node_executable: nodeExecutable,
      cwd: validated.cwd,
      exit_code: Number.isInteger(code) ? code : -1,
      signal: signal || null,
      stdout: Buffer.concat(stdout).toString('utf8'),
      stderr: diagnostic + Buffer.concat(stderr).toString('utf8')
    })));
  });
}

// One bounded request per shell invocation. The parent shell supplies task identity.
async function main(argv = process.argv.slice(2)) {
  if (argv.length === 1 && argv[0] === '--describe') {
    process.stdout.write(`${JSON.stringify({
      schema_version: 1, transport: 'cli', entrypoints: Object.keys(RUNTIME_ENTRYPOINTS)
    })}\n`);
    return 0;
  }
  if (argv.length !== 1 || Buffer.byteLength(argv[0]) > 2 * 1024 * 1024) {
    throw new Error('Usage: runner.js <request-json> | --describe');
  }
  const input = JSON.parse(argv[0]);
  const controller = new AbortController();
  let interrupted = null;
  const interrupt = (signal) => {
    interrupted = signal;
    controller.abort();
  };
  const onInterrupt = () => interrupt('SIGINT');
  const onTerminate = () => interrupt('SIGTERM');
  process.on('SIGINT', onInterrupt);
  process.on('SIGTERM', onTerminate);
  try {
    const result = await runSkillScript(input, { signal: controller.signal });
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return result.exit_code >= 0 ? result.exit_code : 1;
  } catch (error) {
    if (interrupted) return interrupted === 'SIGINT' ? 130 : 143;
    throw error;
  } finally {
    process.removeListener('SIGINT', onInterrupt);
    process.removeListener('SIGTERM', onTerminate);
  }
}

if (require.main === module) {
  main().then((code) => { process.exitCode = code; }).catch((error) => {
    process.stderr.write(`sd0x runner: ${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = { RUNTIME_ENTRYPOINTS, runSkillScript, runtimeChildEnvironment, main };
