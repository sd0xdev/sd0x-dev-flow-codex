'use strict';

const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { readProjectConfig } = require('./config');
const { findRepoRoot, snapshot } = require('./worktree');

const SCHEMA_VERSION = 4;
const DEFAULT_MAX_CONTINUATIONS = 8;
const DEFAULT_MAX_ROUNDS = 8;
const LOCK_WAIT_MS = 5_000;
const LOCK_RETRY_MS = 20;
const LOCK_OWNER_GRACE_MS = 1_000;
const LOCK_STALE_MS = 30_000;
const SESSION_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

function now() {
  return new Date().toISOString();
}

function sameRealPath(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  try {
    return fs.realpathSync(left) === fs.realpathSync(right);
  } catch {
    return path.resolve(left) === path.resolve(right);
  }
}

function defaultGate() {
  return {
    status: 'pending',
    fingerprint: null,
    evidence: null,
    updated_at: null
  };
}

function defaultState() {
  return {
    schema_version: SCHEMA_VERSION,
    sessions: [],
    updated_at: now(),
    worktree: {
      root: null,
      fingerprint: 'clean',
      files: [],
      code_files: [],
      doc_files: [],
      other_files: [],
      requires_review: false,
      requires_verify: false
    },
    gates: {
      review: defaultGate(),
      verify: defaultGate()
    },
    review_agents: {
      fingerprint: null,
      started: [],
      completed: []
    },
    external_review: {
      fingerprint: null,
      completed: []
    },
    iteration: {
      round: 0,
      max_rounds: DEFAULT_MAX_ROUNDS,
      max_continuations: DEFAULT_MAX_CONTINUATIONS
    }
  };
}

function resolveRuntimeMetadataPath(cwd, relativePath) {
  const root = findRepoRoot(cwd);
  const gitRelativePath = path.posix.join(
    'sd0x-dev-flow-codex',
    ...relativePath.split(path.sep)
  );
  const result = spawnSync('git', [
    'rev-parse', '--git-path', gitRelativePath
  ], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true
  });

  if (result.status === 0 && result.stdout.trim()) {
    const candidate = result.stdout.trim();
    return path.isAbsolute(candidate) ? candidate : path.resolve(root, candidate);
  }

  return path.join(root, '.sd0x', relativePath);
}

function resolveStatePath(cwd = process.cwd()) {
  if (process.env.SD0X_STATE_PATH) {
    return path.resolve(process.env.SD0X_STATE_PATH);
  }
  return resolveRuntimeMetadataPath(cwd, 'runtime-state.json');
}

function activationFailurePath(cwd, sessionId) {
  if (typeof sessionId !== 'string' || !sessionId) return null;
  const digest = crypto.createHash('sha256').update(sessionId).digest('hex');
  return resolveRuntimeMetadataPath(
    cwd,
    path.join('activation-failures', `${digest}.json`)
  );
}

function fallbackActivationFailurePath(cwd, sessionId) {
  if (typeof sessionId !== 'string' || !sessionId) return null;
  const digest = crypto.createHash('sha256').update(sessionId).digest('hex');
  return path.join(
    findRepoRoot(cwd),
    '.sd0x',
    'sd0x-dev-flow-codex',
    'activation-failures',
    `${digest}.json`
  );
}

function activationFailurePaths(cwd, sessionId) {
  return [...new Set([
    activationFailurePath(cwd, sessionId),
    fallbackActivationFailurePath(cwd, sessionId)
  ].filter(Boolean))];
}

function setupDeferralPath(cwd) {
  return resolveRuntimeMetadataPath(cwd, 'setup-deferral.json');
}

function writeRuntimeMarker(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporary, `${JSON.stringify(value)}\n`, { mode: 0o600 });
    fs.renameSync(temporary, filePath);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}

function markSessionActivationFailure(cwd, sessionId) {
  const paths = activationFailurePaths(cwd, sessionId);
  if (paths.length === 0) return false;
  let lastError;
  for (const filePath of paths) {
    try {
      writeRuntimeMarker(filePath, {
        session_id: sessionId,
        recorded_at: now()
      });
      return true;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

function clearSessionActivationFailure(cwd, sessionId) {
  let existed = false;
  for (const filePath of activationFailurePaths(cwd, sessionId)) {
    existed = fs.existsSync(filePath) || existed;
    fs.rmSync(filePath, { force: true });
  }
  return existed;
}

function hasSessionActivationFailure(cwd, sessionId) {
  return activationFailurePaths(cwd, sessionId).some((filePath) =>
    fs.existsSync(filePath)
  );
}

function markSetupDeferral(cwd, claimToken = crypto.randomUUID()) {
  if (typeof claimToken !== 'string' || claimToken.length < 16 ||
      claimToken.length > 200) {
    throw new Error('Setup deferral requires a valid claim token');
  }
  writeRuntimeMarker(setupDeferralPath(cwd), {
    session_id: null,
    claim_token: claimToken,
    recorded_at: now()
  });
  return claimToken;
}

function clearSetupDeferral(cwd) {
  const filePath = setupDeferralPath(cwd);
  const existed = fs.existsSync(filePath);
  fs.rmSync(filePath, { force: true });
  return existed;
}

function readSetupDeferral(filePath) {
  try {
    const value = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return value && typeof value === 'object' ? value : null;
  } catch {
    return null;
  }
}

function restoreClaimedMarker(filePath, claimed) {
  if (fs.existsSync(filePath)) {
    fs.rmSync(claimed, { force: true });
    return;
  }
  fs.renameSync(claimed, filePath);
}

function hasSetupDeferral(cwd, sessionId) {
  const filePath = setupDeferralPath(cwd);
  if (sessionId === undefined) return fs.existsSync(filePath);
  const marker = readSetupDeferral(filePath);
  return Boolean(
    marker && typeof sessionId === 'string' && sessionId &&
    marker.session_id === sessionId
  );
}

function claimSetupDeferral(cwd, sessionId, claimToken) {
  if (typeof sessionId !== 'string' || !sessionId ||
      typeof claimToken !== 'string' || !claimToken) return false;
  const filePath = setupDeferralPath(cwd);
  const observed = readSetupDeferral(filePath);
  if (!observed || observed.claim_token !== claimToken ||
      (observed.session_id && observed.session_id !== sessionId)) {
    return false;
  }
  const claimed = `${filePath}.claimed.${process.pid}.${crypto.randomUUID()}`;
  try {
    fs.renameSync(filePath, claimed);
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
  const marker = readSetupDeferral(claimed);
  if (!marker || marker.claim_token !== claimToken ||
      (marker.session_id && marker.session_id !== sessionId)) {
    restoreClaimedMarker(filePath, claimed);
    return false;
  }
  if (fs.existsSync(filePath)) {
    fs.rmSync(claimed, { force: true });
    return false;
  }
  writeRuntimeMarker(filePath, {
    ...marker,
    session_id: sessionId,
    claimed_at: now()
  });
  fs.rmSync(claimed, { force: true });
  return true;
}

function consumeSetupDeferral(cwd, sessionId) {
  if (typeof sessionId !== 'string' || !sessionId) return false;
  const filePath = setupDeferralPath(cwd);
  const claimed = `${filePath}.claimed.${process.pid}.${crypto.randomUUID()}`;
  try {
    fs.renameSync(filePath, claimed);
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
  const marker = readSetupDeferral(claimed);
  if (!marker || marker.session_id !== sessionId) {
    restoreClaimedMarker(filePath, claimed);
    return false;
  }
  fs.rmSync(claimed, { force: true });
  return true;
}

function normalizeState(value) {
  const base = defaultState();
  if (!value || ![1, 2, 3, SCHEMA_VERSION].includes(value.schema_version)) return base;
  const migratingLegacyState = value.schema_version !== SCHEMA_VERSION;
  const normalizedAt = now();
  const normalizeTimestamp = (candidate) =>
    typeof candidate === 'string' && Number.isFinite(Date.parse(candidate))
      ? candidate
      : normalizedAt;

  const legacySession = typeof value.session_id === 'string' && value.session_id
    ? [{
        session_id: value.session_id,
        continuations: Number.isInteger(value.iteration?.continuations)
          ? value.iteration.continuations
          : 0,
        started_at: normalizeTimestamp(value.updated_at),
        updated_at: normalizeTimestamp(value.updated_at)
      }]
    : [];
  const sessions = Array.isArray(value.sessions)
    ? value.sessions.filter((entry) =>
        entry && typeof entry.session_id === 'string' && entry.session_id
      ).map((entry) => ({
        session_id: entry.session_id,
        continuations: Number.isInteger(entry.continuations)
          ? Math.max(0, entry.continuations)
          : 0,
        started_at: normalizeTimestamp(entry.started_at || value.updated_at),
        updated_at: normalizeTimestamp(entry.updated_at || value.updated_at)
      })).filter((entry) =>
        Date.parse(entry.updated_at) >= Date.now() - SESSION_RETENTION_MS
      )
    : legacySession;
  const normalized = {
    ...base,
    ...value,
    schema_version: SCHEMA_VERSION,
    sessions,
    worktree: { ...base.worktree, ...(value.worktree || {}) },
    gates: {
      review: migratingLegacyState
        ? base.gates.review
        : { ...base.gates.review, ...(value.gates?.review || {}) },
      verify: migratingLegacyState
        ? base.gates.verify
        : { ...base.gates.verify, ...(value.gates?.verify || {}) }
    },
    review_agents: migratingLegacyState ? base.review_agents : {
      ...base.review_agents,
      ...(value.review_agents || {}),
      started: Array.isArray(value.review_agents?.started)
        ? value.review_agents.started
        : [],
      completed: Array.isArray(value.review_agents?.completed)
        ? value.review_agents.completed
        : []
    },
    external_review: migratingLegacyState ? base.external_review : {
      ...base.external_review,
      ...(value.external_review || {}),
      completed: Array.isArray(value.external_review?.completed)
        ? value.external_review.completed
        : []
    },
    iteration: {
      round: !migratingLegacyState && Number.isInteger(value.iteration?.round)
        ? Math.max(0, value.iteration.round)
        : base.iteration.round,
      max_rounds: Number.isInteger(value.iteration?.max_rounds)
        ? value.iteration.max_rounds
        : base.iteration.max_rounds,
      max_continuations: Number.isInteger(value.iteration?.max_continuations)
        ? value.iteration.max_continuations
        : base.iteration.max_continuations
    }
  };
  delete normalized.session_id;
  return normalized;
}

function readState(cwd = process.cwd()) {
  const filePath = resolveStatePath(cwd);
  try {
    return normalizeState(JSON.parse(fs.readFileSync(filePath, 'utf8')));
  } catch {
    return defaultState();
  }
}

function writeState(cwd, state) {
  const filePath = resolveStatePath(cwd);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  const normalized = normalizeState({ ...state, updated_at: now() });
  fs.writeFileSync(temporary, `${JSON.stringify(normalized, null, 2)}\n`, {
    mode: 0o600
  });
  fs.renameSync(temporary, filePath);
  return normalized;
}

function sleep(milliseconds) {
  const buffer = new SharedArrayBuffer(4);
  Atomics.wait(new Int32Array(buffer), 0, 0, milliseconds);
}

function processIsAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
}

function lockIsReclaimable(lockPath) {
  const age = Date.now() - fs.statSync(lockPath).mtimeMs;
  let owner = null;
  try {
    owner = Number.parseInt(
      fs.readFileSync(path.join(lockPath, 'owner'), 'utf8').trim(),
      10
    );
  } catch (error) {
    if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') throw error;
  }

  if (Number.isInteger(owner) && owner > 0 && !processIsAlive(owner)) {
    return true;
  }
  if ((!Number.isInteger(owner) || owner <= 0) && age > LOCK_OWNER_GRACE_MS) {
    return true;
  }
  return age > LOCK_STALE_MS;
}

function acquireLock(filePath) {
  const lockPath = `${filePath}.lock`;
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  const deadline = Date.now() + LOCK_WAIT_MS;

  while (Date.now() < deadline) {
    try {
      fs.mkdirSync(lockPath);
      try {
        fs.writeFileSync(path.join(lockPath, 'owner'), String(process.pid));
      } catch (error) {
        fs.rmSync(lockPath, { recursive: true, force: true });
        throw error;
      }
      return lockPath;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      try {
        if (lockIsReclaimable(lockPath)) {
          const abandoned = `${lockPath}.abandoned.${process.pid}.${crypto.randomUUID()}`;
          fs.renameSync(lockPath, abandoned);
          fs.rmSync(abandoned, { recursive: true, force: true });
          continue;
        }
      } catch (lockError) {
        if (lockError.code === 'ENOENT') continue;
        throw lockError;
      }
      sleep(Math.min(LOCK_RETRY_MS, Math.max(1, deadline - Date.now())));
    }
  }

  throw new Error('Timed out waiting for the sd0x runtime state lock');
}

function withStateLock(cwd, callback) {
  const filePath = resolveStatePath(cwd);
  const lockPath = acquireLock(filePath);
  try {
    const current = readState(cwd);
    const next = callback(current) || current;
    return writeState(cwd, next);
  } finally {
    fs.rmSync(lockPath, { recursive: true, force: true });
  }
}

function invalidateGates(state) {
  state.gates.review = defaultGate();
  state.gates.verify = defaultGate();
  state.review_agents = {
    fingerprint: null,
    started: [],
    completed: []
  };
  state.external_review = {
    fingerprint: null,
    completed: []
  };
}

function resetSessionContinuations(state) {
  state.sessions = state.sessions.map((entry) => ({
    ...entry,
    continuations: 0
  }));
}

function applySnapshot(state, worktree) {
  const previousFingerprint = state.worktree?.fingerprint || 'clean';
  if (previousFingerprint !== worktree.fingerprint) {
    const hadGateEvidence = ['review', 'verify'].some((gate) =>
      state.gates[gate].status !== 'pending'
    );
    invalidateGates(state);
    if (worktree.fingerprint === 'clean') {
      state.iteration.round = 0;
      resetSessionContinuations(state);
    } else if (hadGateEvidence && previousFingerprint !== 'clean' &&
        worktree.fingerprint !== 'clean') {
      state.iteration.round += 1;
    }
  }
  state.worktree = worktree;
  return state;
}

function refreshState(cwd = process.cwd(), options = {}) {
  const worktree = snapshot(cwd);
  const projectConfig = readProjectConfig(cwd);
  return withStateLock(cwd, (state) => {
    if (options.sessionId) {
      const recordedAt = now();
      const existing = state.sessions.findIndex((entry) =>
        entry.session_id === options.sessionId
      );
      const session = {
        session_id: options.sessionId,
        continuations: existing >= 0
          ? state.sessions[existing].continuations
          : 0,
        started_at: existing >= 0
          ? state.sessions[existing].started_at
          : recordedAt,
        updated_at: recordedAt
      };
      if (existing >= 0) state.sessions[existing] = session;
      else state.sessions.push(session);
    }
    state.iteration.max_rounds = projectConfig.limits.max_rounds;
    state.iteration.max_continuations = projectConfig.limits.max_continuations;
    return applySnapshot(state, worktree);
  });
}

function validateEvidence(gate, status, evidence) {
  if (!['pass', 'fail'].includes(status)) {
    throw new Error('Gate status must be pass or fail');
  }
  if (!evidence || typeof evidence !== 'object') {
    throw new Error('Gate evidence must be a JSON object');
  }
  if (gate === 'review' && status === 'pass') {
    if (!Number.isInteger(evidence.reviewers) || evidence.reviewers < 3) {
      throw new Error('A passing review gate requires evidence.reviewers >= 3');
    }
    if (evidence.findings !== 0) {
      throw new Error('A passing review gate requires evidence.findings === 0');
    }
    const requiredReviewers = [
      'claude_mcp_primary',
      'sd0x_reviewer',
      'sd0x_test_reviewer'
    ];
    if (!Array.isArray(evidence.agents) ||
        !requiredReviewers.every((reviewer) => evidence.agents.includes(reviewer))) {
      throw new Error(
        'A passing review gate requires Claude MCP, implementation, and test reviewer evidence'
      );
    }
  }
  if (gate === 'verify' && status === 'pass') {
    if (!Array.isArray(evidence.commands) || evidence.commands.length === 0) {
      throw new Error('A passing verify gate requires at least one command');
    }
    if (evidence.commands.some((command) => command.exit_code !== 0)) {
      throw new Error('A passing verify gate cannot contain failed commands');
    }
  }
}

function markGate(cwd, gate, status, evidence) {
  if (!['review', 'verify'].includes(gate)) {
    throw new Error(`Unknown gate: ${gate}`);
  }
  if (gate === 'verify' && status === 'pass') {
    throw new Error(
      'Verification pass can only be recorded by the deterministic verify runner'
    );
  }
  validateEvidence(gate, status, evidence);
  const worktree = snapshot(cwd);

  return withStateLock(cwd, (state) => {
    applySnapshot(state, worktree);
    if (gate === 'review' && status === 'pass') {
      const currentAgentResults = state.review_agents.fingerprint === worktree.fingerprint
        ? state.review_agents.completed
        : [];
      const currentExternalResults =
        state.external_review.fingerprint === worktree.fingerprint
          ? state.external_review.completed
          : [];
      if (currentAgentResults.some((entry) => entry.outcome === 'findings') ||
          currentExternalResults.some((entry) => entry.outcome === 'findings')) {
        throw new Error(
          'Review pass is blocked by unresolved findings recorded for this fingerprint'
        );
      }
      const cleanTypes = new Set(
        currentAgentResults
          .filter((entry) =>
            typeof entry.result_sha256 === 'string' && entry.outcome === 'clean'
          )
          .map((entry) => entry.agent_type)
      );
      const requiredTypes = ['sd0x_reviewer', 'sd0x_test_reviewer'];
      if (!requiredTypes.every((type) => cleanTypes.has(type))) {
        throw new Error(
          'Review pass requires observed clean terminal results from sd0x_reviewer and sd0x_test_reviewer'
        );
      }
      const hasCleanClaudeReview =
        state.external_review.fingerprint === worktree.fingerprint &&
        currentExternalResults.some((entry) =>
          entry.reviewer === 'claude_mcp' &&
          entry.perspective === 'primary' &&
          entry.outcome === 'clean' &&
          entry.findings === 0 &&
          typeof entry.result_sha256 === 'string'
        );
      if (!hasCleanClaudeReview) {
        throw new Error(
          'Review pass requires an observed clean Claude MCP primary result'
        );
      }
    }
    state.gates[gate] = {
      status,
      fingerprint: worktree.fingerprint,
      evidence,
      updated_at: now()
    };
    return state;
  });
}

function recordVerification(cwd, status, evidence, expectedFingerprint) {
  validateEvidence('verify', status, evidence);
  if (evidence.runner !== 'sd0x-deterministic-v1') {
    throw new Error('Verification evidence must come from the deterministic runner');
  }
  const worktree = snapshot(cwd);
  let recordedStatus = status;
  let recordedEvidence = evidence;
  if (worktree.fingerprint !== expectedFingerprint) {
    recordedStatus = 'fail';
    recordedEvidence = {
      ...evidence,
      fingerprint_changed: true,
      expected_fingerprint: expectedFingerprint,
      observed_fingerprint: worktree.fingerprint
    };
  }

  return withStateLock(cwd, (state) => {
    applySnapshot(state, worktree);
    if (recordedStatus === 'pass' && !isCurrentPass(state, 'review')) {
      throw new Error(
        'Verification pass requires a current review pass for the same fingerprint'
      );
    }
    state.gates.verify = {
      status: recordedStatus,
      fingerprint: worktree.fingerprint,
      evidence: recordedEvidence,
      updated_at: now()
    };
    return state;
  });
}

function recordSubagent(cwd, phase, details) {
  if (!['start', 'stop'].includes(phase)) {
    throw new Error(`Unknown subagent phase: ${phase}`);
  }
  const worktree = snapshot(cwd);
  return withStateLock(cwd, (state) => {
    applySnapshot(state, worktree);
    if (state.review_agents.fingerprint !== worktree.fingerprint) {
      state.review_agents = {
        fingerprint: worktree.fingerprint,
        started: [],
        completed: []
      };
    }

    const entry = {
      agent_id: details.agent_id || 'unknown',
      agent_type: details.agent_type || 'unknown',
      recorded_at: now()
    };
    if (phase === 'stop') {
      const started = state.review_agents.started.find((item) =>
        item.agent_id === entry.agent_id && item.agent_type === entry.agent_type
      );
      if (!started) return state;
      const result = typeof details.last_assistant_message === 'string'
        ? details.last_assistant_message.trim()
        : '';
      if (!result) return state;
      entry.started_at = started.recorded_at;
      entry.result_sha256 = crypto.createHash('sha256').update(result).digest('hex');
      entry.outcome = /^no actionable findings(?: remain)?\.?$/i.test(result)
        ? 'clean'
        : 'findings';
      entry.has_transcript = typeof details.agent_transcript_path === 'string' &&
        details.agent_transcript_path.length > 0;
    }
    const collection = phase === 'start'
      ? state.review_agents.started
      : state.review_agents.completed;
    const existing = collection.findIndex((item) =>
      item.agent_id === entry.agent_id &&
      item.agent_type === entry.agent_type &&
      (phase === 'start' || item.result_sha256 === entry.result_sha256)
    );
    if (existing >= 0) collection[existing] = entry;
    else collection.push(entry);
    return state;
  });
}

function recordExternalReview(cwd, details) {
  if (!details || typeof details !== 'object') {
    throw new Error('External review details are required');
  }
  const result = details.result;
  if (!result || typeof result !== 'object') {
    throw new Error('External review structured result is required');
  }
  if (result.schema_version !== 1 || result.reviewer !== 'claude_mcp' ||
      result.perspective !== 'primary') {
    throw new Error('Unexpected external reviewer identity');
  }
  if (!['clean', 'findings'].includes(result.outcome) ||
      !Array.isArray(result.findings)) {
    throw new Error('Invalid external review outcome');
  }
  if ((result.outcome === 'clean') !== (result.findings.length === 0)) {
    throw new Error('External review outcome does not match its finding count');
  }
  if (typeof details.input_fingerprint !== 'string' ||
      details.input_fingerprint !== result.fingerprint) {
    throw new Error('External review input/output fingerprint mismatch');
  }

  const worktree = snapshot(cwd);
  if (!sameRealPath(details.input_root, worktree.root) ||
      !sameRealPath(result.repository_root, worktree.root)) {
    throw new Error('External review repository root mismatch');
  }
  if (worktree.fingerprint !== result.fingerprint) {
    throw new Error('External review result is stale for the current worktree');
  }
  const canonicalResult = JSON.stringify(result);

  return withStateLock(cwd, (state) => {
    applySnapshot(state, worktree);
    if (state.external_review.fingerprint !== worktree.fingerprint) {
      state.external_review = {
        fingerprint: worktree.fingerprint,
        completed: []
      };
    }
    const entry = {
      reviewer: result.reviewer,
      perspective: result.perspective,
      outcome: result.outcome,
      findings: result.findings.length,
      tool_use_id: details.tool_use_id || 'unknown',
      duration_ms: Number.isInteger(result.duration_ms)
        ? Math.max(0, result.duration_ms)
        : null,
      result_sha256: crypto.createHash('sha256').update(canonicalResult).digest('hex'),
      recorded_at: now()
    };
    const existing = state.external_review.completed.findIndex((item) =>
      item.tool_use_id === entry.tool_use_id &&
      item.result_sha256 === entry.result_sha256
    );
    if (existing >= 0) state.external_review.completed[existing] = entry;
    else state.external_review.completed.push(entry);
    return state;
  });
}

function isCurrentPass(state, gate) {
  const value = state.gates[gate];
  return value.status === 'pass' &&
    value.fingerprint === state.worktree.fingerprint;
}

function isCurrentFail(state, gate) {
  const value = state.gates[gate];
  return value.status === 'fail' &&
    value.fingerprint === state.worktree.fingerprint;
}

function sessionContinuations(state, sessionId) {
  if (!sessionId) return 0;
  return state.sessions.find((entry) => entry.session_id === sessionId)
    ?.continuations || 0;
}

function isSessionActive(state, sessionId) {
  return Boolean(sessionId) && state.sessions.some((entry) =>
    entry.session_id === sessionId
  );
}

function nextAction(state, options = {}) {
  if (!state.worktree.requires_review) {
    return { action: 'complete', reason: 'worktree-clean' };
  }

  if (isCurrentPass(state, 'review') &&
      (!state.worktree.requires_verify || isCurrentPass(state, 'verify'))) {
    return { action: 'complete', reason: 'all-required-gates-pass' };
  }

  if (state.iteration.round >= state.iteration.max_rounds) {
    return { action: 'escalate', reason: 'max-rounds-reached' };
  }
  if (sessionContinuations(state, options.sessionId) >=
      state.iteration.max_continuations) {
    return { action: 'escalate', reason: 'max-continuations-reached' };
  }

  if (isCurrentFail(state, 'review')) {
    return { action: 'review', reason: 'review-findings-remain' };
  }
  if (!isCurrentPass(state, 'review')) {
    return { action: 'review', reason: 'review-required' };
  }

  if (state.worktree.requires_verify) {
    if (isCurrentFail(state, 'verify')) {
      return { action: 'verify', reason: 'verification-failed' };
    }
    if (!isCurrentPass(state, 'verify')) {
      return { action: 'verify', reason: 'verification-required' };
    }
  }

  return { action: 'complete', reason: 'all-required-gates-pass' };
}

function recordContinuation(cwd = process.cwd(), sessionId) {
  return withStateLock(cwd, (state) => {
    const session = state.sessions.find((entry) => entry.session_id === sessionId);
    if (!session) {
      throw new Error('Cannot record a continuation for an inactive session');
    }
    session.continuations += 1;
    session.updated_at = now();
    return state;
  });
}

function resetState(cwd = process.cwd()) {
  return withStateLock(cwd, () => defaultState());
}

function summarize(state, options = {}) {
  const action = nextAction(state, options);
  return {
    fingerprint: state.worktree.fingerprint,
    files: state.worktree.files,
    requires_review: state.worktree.requires_review,
    requires_verify: state.worktree.requires_verify,
    review: state.gates.review.status,
    verify: state.gates.verify.status,
    review_agents_completed: state.review_agents.completed.length,
    external_reviews_completed: state.external_review.completed.length,
    round: state.iteration.round,
    active_sessions: state.sessions.length,
    continuations: sessionContinuations(state, options.sessionId),
    next_action: action.action,
    reason: action.reason
  };
}

module.exports = {
  activationFailurePath,
  applySnapshot,
  claimSetupDeferral,
  clearSetupDeferral,
  clearSessionActivationFailure,
  consumeSetupDeferral,
  defaultState,
  hasSetupDeferral,
  hasSessionActivationFailure,
  isCurrentPass,
  isSessionActive,
  markSetupDeferral,
  markSessionActivationFailure,
  markGate,
  nextAction,
  readState,
  recordExternalReview,
  recordSubagent,
  recordContinuation,
  recordVerification,
  refreshState,
  resetState,
  resolveRuntimeMetadataPath,
  resolveStatePath,
  setupDeferralPath,
  summarize,
  withStateLock,
  writeState
};
