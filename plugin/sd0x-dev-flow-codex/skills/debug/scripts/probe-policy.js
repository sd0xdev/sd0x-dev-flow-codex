'use strict';

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_OUTPUT_BYTES = 64 * 1024;
const MAX_COMMAND_BYTES = 4 * 1024;
const WHITESPACE = new RegExp('\\s+', 'g');
const SAFE_FORMS = Object.freeze(new Set([
  'git rev-parse --verify refs/sd0x-debug-probe/missing'
]));

function classifyProbe(command) {
  if (typeof command !== 'string' || command.length === 0 ||
      Buffer.byteLength(command) > MAX_COMMAND_BYTES || command.includes('\n') ||
      command.includes('\r') || command.includes('\0')) {
    return { allowed: false, reason: 'invalid-command' };
  }
  const normalized = command.trim().replace(WHITESPACE, ' ');
  if (!SAFE_FORMS.has(normalized)) {
    return { allowed: false, reason: 'not-explicitly-read-only' };
  }
  return { allowed: true, reason: 'explicit-read-only', normalized };
}

function probePlan(command) {
  return {
    ...classifyProbe(command),
    timeout_ms: DEFAULT_TIMEOUT_MS,
    max_output_bytes: MAX_OUTPUT_BYTES,
    redact_output: true
  };
}

module.exports = {
  classifyProbe,
  probePlan,
  DEFAULT_TIMEOUT_MS,
  MAX_OUTPUT_BYTES
};
