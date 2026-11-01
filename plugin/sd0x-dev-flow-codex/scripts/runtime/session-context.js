'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { findRepoRoot } = require('./worktree');

const THREAD_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RECOVERY = 'Run the installed runner from the current Codex shell with its CODEX_HOME and CODEX_THREAD_ID. Explicit callers may pass context: { codex_home, thread_id } from that same shell. Do not guess a home, select the newest transcript, or reuse another task. Alternatively run the installed script directly in that same shell. Reset does not repair missing task context.';

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

// These are top-level host records, never environment snippets in messages or
// tool output. Bind a project change to its task-start event in this transcript.
function currentProjectContext(rows, threadId) {
  const boundary = rows.findLastIndex(row => row.type === 'event_msg' && row.payload?.type === 'task_started');
  if (boundary < 0) {
    if (rows.some(row => row.type === 'turn_context')) throw new Error('Current turn boundary is unavailable');
    return null;
  }
  const start = rows[boundary];
  const started = start.payload.turn_id;
  if (start.metadata?.client_authored === true || !THREAD_ID.test(started || '') ||
      !Number.isFinite(Date.parse(start.timestamp)) ||
      (start.payload.thread_id !== undefined && start.payload.thread_id !== threadId)) {
    throw new Error('Invalid task context');
  }
  let context = null;
  // A full-history fork can begin with inherited, unpaired turn_context rows.
  // Only the latest task boundary supplies this thread's current project.
  for (const row of rows.slice(boundary + 1)) {
    if (row.type !== 'turn_context') continue;
    const value = row.payload;
    if (row.metadata?.client_authored === true ||
        !Number.isFinite(Date.parse(row.timestamp)) ||
        !value || !THREAD_ID.test(value.turn_id || '') || value.turn_id !== started ||
        (value.thread_id !== undefined && value.thread_id !== threadId) ||
        typeof value.cwd !== 'string' || !path.isAbsolute(value.cwd) ||
        !['read-only', 'workspace-write', 'danger-full-access'].includes(value.sandbox_policy?.type)) {
      throw new Error('Invalid current project context');
    }
    context = value;
  }
  if (context?.turn_id !== started) throw new Error('Current turn context is unavailable');
  return context;
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
    const bytes = fs.readFileSync(transcript);
    const lineEnd = bytes.indexOf(10);
    if (lineEnd < 0 || lineEnd >= 64 * 1024) return unavailable('session-metadata-invalid');
    const header = JSON.parse(bytes.subarray(0, lineEnd).toString('utf8'));
    if (header.type !== 'session_meta' || header.payload?.id !== env.CODEX_THREAD_ID ||
        typeof header.payload?.cwd !== 'string' || !path.isAbsolute(header.payload.cwd)) {
      return unavailable('session-metadata-mismatch');
    }
    let current;
    try {
      const rows = bytes.subarray(lineEnd + 1).toString('utf8').split('\n')
        .filter(line => line.trim()).map(line => JSON.parse(line));
      current = currentProjectContext(rows, env.CODEX_THREAD_ID);
    } catch {
      return unavailable('session-turn-context-invalid');
    }
    const effectiveCwd = current?.cwd || header.payload.cwd;
    if (fs.realpathSync(findRepoRoot(effectiveCwd)) !== fs.realpathSync(findRepoRoot(cwd))) {
      return unavailable('session-repository-mismatch');
    }
    return { available: true, reason: null, missing: [], transcript_path: transcript,
      context_source: current ? 'host-turn-context' : 'session-meta',
      turn_id: current?.turn_id || null };
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
  // Explicit callers may supply task identity. Never mutate the caller environment.
  if ((environment.CODEX_THREAD_ID && environment.CODEX_THREAD_ID !== context.thread_id) ||
      (environment.CODEX_HOME && path.resolve(environment.CODEX_HOME) !== path.resolve(context.codex_home))) {
    throw new Error('Explicit context conflicts with the active Codex shell context');
  }
  const env = { ...environment, CODEX_HOME: context.codex_home, CODEX_THREAD_ID: context.thread_id };
  const inspected = inspectSessionContext(cwd, env);
  if (!inspected.available) throw new Error(`${inspected.reason}: ${inspected.recovery}`);
  return env;
}

module.exports = { inspectSessionContext, locateTranscript, sessionEnvironment, findTranscriptFiles };
