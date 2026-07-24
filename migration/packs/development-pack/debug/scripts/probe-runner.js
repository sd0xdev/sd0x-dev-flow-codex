'use strict';

const {
  classifyProbe,
  probePlan,
  DEFAULT_TIMEOUT_MS,
  MAX_OUTPUT_BYTES
} = require('./probe-policy.js');
const { boundedOutput, redactOutput } = require('./probe-redaction.js');
const { spawnAllowed } = require('./probe-spawn.js');

function collectChild(child, options = {}) {
  const timeoutMs = Number.isInteger(options.timeout_ms) && options.timeout_ms > 0
    ? Math.min(options.timeout_ms, DEFAULT_TIMEOUT_MS)
    : DEFAULT_TIMEOUT_MS;
  const maximum = Number.isInteger(options.max_output_bytes) && options.max_output_bytes > 0
    ? Math.min(options.max_output_bytes, MAX_OUTPUT_BYTES)
    : MAX_OUTPUT_BYTES;
  return new Promise((resolve) => {
    let captured = Buffer.alloc(0);
    let timeout = false;
    let outputLimit = false;
    let settled = false;
    const append = (chunk) => {
      const bytes = Buffer.from(chunk);
      const remaining = Math.max(0, maximum + 1 - captured.length);
      if (remaining > 0) captured = Buffer.concat([captured, bytes.subarray(0, remaining)]);
      if (captured.length > maximum || bytes.length > remaining) {
        outputLimit = true;
        child.kill('SIGKILL');
      }
    };
    child.stdout.on('data', append);
    child.stderr.on('data', append);
    const timer = setTimeout(() => {
      timeout = true;
      child.kill('SIGKILL');
    }, timeoutMs);
    const finish = (code, signal, error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        ...boundedOutput(captured, maximum),
        code,
        signal,
        timeout,
        output_limit: outputLimit,
        error: error ? 'probe-process-error' : null
      });
    };
    child.once('error', (error) => finish(null, null, error));
    child.once('close', (code, signal) => finish(code, signal, null));
  });
}

async function runProbe(command, options = {}) {
  const plan = probePlan(command);
  if (!plan.allowed) {
    return { ...plan, spawned: false, output: '', bytes: 0, truncated: false };
  }
  const cwd = typeof options.cwd === 'string' && options.cwd.length > 0
    ? options.cwd
    : process.cwd();
  const child = spawnAllowed(plan.normalized, cwd);
  const result = await collectChild(child, {
    timeout_ms: plan.timeout_ms,
    max_output_bytes: plan.max_output_bytes
  });
  return { ...plan, spawned: true, ...result };
}

module.exports = {
  boundedOutput,
  classifyProbe,
  collectChild,
  probePlan,
  redactOutput,
  runProbe,
  DEFAULT_TIMEOUT_MS,
  MAX_OUTPUT_BYTES
};
