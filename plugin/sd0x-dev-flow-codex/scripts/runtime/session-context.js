'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { findRepoRoot } = require('./worktree');

const THREAD_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RECOVERY = 'Read CODEX_HOME and CODEX_THREAD_ID from the current Codex shell tool, then pass context: { codex_home, thread_id } on each run_skill_script call. Do not guess a home, select the newest transcript, or reuse another task. Alternatively run the installed script directly in that same shell. Reset does not repair missing task context.';

function findTranscriptFiles(directory, suffix, depth = 0) {
  if (depth > 5) return [];
  const matches = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const candidate = path.join(directory, entry.name);
    if (entry.isDirectory()) matches.push(...findTranscriptFiles(candidate, suffix, depth + 1));
    else if (entry.isFile() && entry.name.endsWith(suffix)) matches.push(candidate);
  }
  return matches;
}

function locateTranscript(env = process.env) {
  if (!THREAD_ID.test(env.CODEX_THREAD_ID || '') ||
      typeof env.CODEX_HOME !== 'string' || !path.isAbsolute(env.CODEX_HOME)) return null;
  const sessions = path.join(env.CODEX_HOME, 'sessions');
  if (!fs.existsSync(sessions)) return null;
  const root = fs.realpathSync(sessions);
  const matches = findTranscriptFiles(root, `-${env.CODEX_THREAD_ID}.jsonl`)
    .map((file) => fs.realpathSync(file))
    .filter((file) => {
      const relative = path.relative(root, file);
      return relative && !relative.startsWith('..') && !path.isAbsolute(relative);
    });
  return matches.length === 1 ? matches[0] : null;
}

function inspectSessionContext(cwd, env = process.env) {
  const missing = ['CODEX_HOME', 'CODEX_THREAD_ID'].filter((key) => !env[key]);
  const unavailable = (reason) => ({
    available: false, reason, missing, recovery: RECOVERY,
    native_fallback: 'Requires actual configured-primary start and terminal hook evidence. With hooks disabled, transcript evidence is required; never claim a review pass from this diagnostic.'
  });
  if (missing.length) return unavailable('session-context-missing');
  if (typeof env.CODEX_HOME !== 'string' || !path.isAbsolute(env.CODEX_HOME) ||
      !THREAD_ID.test(env.CODEX_THREAD_ID)) return unavailable('session-context-invalid');
  try {
    const transcript = locateTranscript(env);
    if (!transcript) return unavailable('session-transcript-unavailable');
    const fd = fs.openSync(transcript, 'r');
    let header;
    try {
      const buffer = Buffer.alloc(64 * 1024);
      const size = fs.readSync(fd, buffer, 0, buffer.length, 0);
      const lineEnd = buffer.subarray(0, size).indexOf(10);
      if (lineEnd < 0) return unavailable('session-metadata-invalid');
      header = JSON.parse(buffer.subarray(0, lineEnd).toString('utf8'));
    } finally {
      fs.closeSync(fd);
    }
    if (header.type !== 'session_meta' || header.payload?.id !== env.CODEX_THREAD_ID ||
        typeof header.payload?.cwd !== 'string' || !path.isAbsolute(header.payload.cwd)) {
      return unavailable('session-metadata-mismatch');
    }
    if (fs.realpathSync(findRepoRoot(header.payload.cwd)) !== fs.realpathSync(findRepoRoot(cwd))) {
      return unavailable('session-repository-mismatch');
    }
    return { available: true, reason: null, missing: [], transcript_path: transcript };
  } catch {
    return unavailable('session-transcript-unreadable');
  }
}

function sessionEnvironment(context, environment, cwd) {
  if (context === undefined) return { ...environment };
  if (!context || typeof context !== 'object' || Array.isArray(context) ||
      Object.keys(context).some((key) => !['codex_home', 'thread_id'].includes(key)) ||
      typeof context.codex_home !== 'string' || context.codex_home.length > 4096 ||
      context.codex_home.includes('\0') || !path.isAbsolute(context.codex_home) ||
      typeof context.thread_id !== 'string' || !THREAD_ID.test(context.thread_id)) {
    throw new Error('context requires only an absolute codex_home and UUID thread_id from the current Codex shell');
  }
  // A long-lived MCP process may serve several threads. Never mutate its environment.
  const env = { ...environment, CODEX_HOME: context.codex_home, CODEX_THREAD_ID: context.thread_id };
  const inspected = inspectSessionContext(cwd, env);
  if (!inspected.available) throw new Error(`${inspected.reason}: ${inspected.recovery}`);
  return env;
}

module.exports = { inspectSessionContext, locateTranscript, sessionEnvironment };
