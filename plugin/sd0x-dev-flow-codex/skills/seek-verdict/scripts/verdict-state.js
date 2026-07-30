'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const THRESHOLDS = Object.freeze({
  P0: Object.freeze({ confirm: 0.60, dismiss: 0.95, evidence: 4, human: true }),
  P1: Object.freeze({ confirm: 0.65, dismiss: 0.90, evidence: 3, human: true }),
  P2: Object.freeze({ confirm: 0.70, dismiss: 0.85, evidence: 2, human: false }),
  Nit: Object.freeze({ confirm: 0.70, dismiss: 0.70, evidence: 1, human: false })
});
const STATE_KEYS = Object.freeze(['attempts', 'binding', 'candidate', 'dismiss_streak', 'schema_version', 'version']);
const CANDIDATE_KEYS = Object.freeze(['dismissal_evidence_hash', 'evidence_ids', 'expected_user_turn', 'finding_key', 'fingerprint', 'trusted_registry_sha256']);
const EVALUATION_KEYS = Object.freeze(['branch', 'confidence', 'dismissal_evidence_hash', 'evidence', 'finding_key', 'fingerprint', 'intent', 'origin', 'session', 'severity', 'user_turn']);
const EVIDENCE_KEYS = Object.freeze(['binding_hash', 'evidence_id']);
const REGISTRY_KEYS = Object.freeze(['binding_hash', 'independence_key', 'source_id']);
const CONFIRMATION_KEYS = Object.freeze(['branch', 'decision', 'dismissal_evidence_hash', 'finding_key', 'fingerprint', 'session', 'user_turn']);
const HASH = new RegExp('^[0-9a-f]{64}$');
const INDEPENDENCE_KEY = new RegExp('^(publisher|repository|verifier):[a-z0-9][a-z0-9._:@/-]{1,254}$');

function exactKeys(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value) &&
    JSON.stringify(Object.keys(value).sort()) === JSON.stringify(keys);
}

function nonempty(value) {
  return typeof value === 'string' && value.trim().length > 0 &&
    !value.includes('\0') && !value.includes('\n') && !value.includes('\r');
}

function sortedUnique(values) {
  return Array.isArray(values) &&
    JSON.stringify(values) === JSON.stringify([...new Set(values)].sort());
}

function freshState() {
  return {
    schema_version: 2,
    version: 0,
    binding: null,
    attempts: [],
    dismiss_streak: 0,
    candidate: null
  };
}

function thresholdFor(severity) {
  if (severity === 'P0') return THRESHOLDS.P0;
  if (severity === 'P1') return THRESHOLDS.P1;
  if (severity === 'P2') return THRESHOLDS.P2;
  if (severity === 'Nit') return THRESHOLDS.Nit;
  throw new Error('severity is invalid');
}

function oppositeVerifier(origin) {
  if (origin === 'claude') return ['native-codex'];
  if (origin === 'native-codex') return ['claude-adapter'];
  if (origin === 'user') return ['native-codex', 'claude-adapter'];
  throw new Error('finding origin is invalid');
}

function identity(input) {
  return [input.session, input.branch, input.fingerprint].join('\0');
}

function attemptKey(input) {
  return [input.finding_key, input.fingerprint, input.intent].join('\0');
}

function evidenceHash(evidence) {
  return crypto.createHash('sha256').update(JSON.stringify(evidence)).digest('hex');
}

function validTrustedEvidenceRegistry(registry) {
  if (!(registry instanceof Map) || registry.size === 0) return false;
  const sourceKeys = new Map();
  const bindingOwners = new Map();
  for (const [evidenceId, record] of registry.entries()) {
    if (!HASH.test(evidenceId) || !exactKeys(record, REGISTRY_KEYS) ||
        !HASH.test(record.binding_hash) || !INDEPENDENCE_KEY.test(record.independence_key) ||
        !nonempty(record.source_id)) return false;
    const knownKey = sourceKeys.get(record.source_id);
    if (knownKey && knownKey !== record.independence_key) return false;
    sourceKeys.set(record.source_id, record.independence_key);
    const knownOwner = bindingOwners.get(record.binding_hash);
    if (knownOwner && knownOwner !== evidenceId) return false;
    bindingOwners.set(record.binding_hash, evidenceId);
  }
  return true;
}

function trustedRegistryHash(registry, evidenceIds) {
  if (!validTrustedEvidenceRegistry(registry) || !sortedUnique(evidenceIds) ||
      evidenceIds.length === 0 || evidenceIds.some((id) => !registry.has(id))) {
    throw new Error('trusted evidence registry subset is invalid');
  }
  const canonical = evidenceIds.map((evidenceId) => {
    const record = registry.get(evidenceId);
    return {
      evidence_id: evidenceId,
      binding_hash: record.binding_hash,
      independence_key: record.independence_key,
      source_id: record.source_id
    };
  });
  return crypto.createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

function validEvidence(values, registry) {
  return Array.isArray(values) && values.length > 0 &&
    values.every((value) => {
      const binding = registry.get(value.evidence_id);
      return exactKeys(value, EVIDENCE_KEYS) && HASH.test(value.evidence_id) &&
        HASH.test(value.binding_hash) && binding && binding.binding_hash === value.binding_hash;
    }) && sortedUnique(values.map((value) => value.evidence_id));
}

function independentEvidenceCount(values, registry) {
  return new Set(values.map((value) => registry.get(value.evidence_id).independence_key)).size;
}

function validateCandidate(candidate) {
  return candidate === null || (exactKeys(candidate, CANDIDATE_KEYS) &&
    nonempty(candidate.finding_key) && HASH.test(candidate.fingerprint) &&
    HASH.test(candidate.dismissal_evidence_hash) && HASH.test(candidate.trusted_registry_sha256) &&
    sortedUnique(candidate.evidence_ids) && candidate.evidence_ids.length > 0 &&
    candidate.evidence_ids.every((id) => HASH.test(id)) &&
    Number.isInteger(candidate.expected_user_turn) && candidate.expected_user_turn >= 1);
}

function validBinding(value) {
  if (value === null) return true;
  if (typeof value !== 'string') return false;
  const parts = value.split('\0');
  return parts.length === 3 && nonempty(parts[0]) && nonempty(parts[1]) && HASH.test(parts[2]);
}

function validAttempt(value) {
  if (typeof value !== 'string') return false;
  const parts = value.split('\0');
  return parts.length === 3 && nonempty(parts[0]) && HASH.test(parts[1]) &&
    ['confirm', 'dismiss', 'clarify'].includes(parts[2]);
}

function validateState(state) {
  return exactKeys(state, STATE_KEYS) && state.schema_version === 2 &&
    Number.isInteger(state.version) && state.version >= 0 &&
    validBinding(state.binding) && Array.isArray(state.attempts) &&
    state.attempts.every(validAttempt) && new Set(state.attempts).size === state.attempts.length &&
    Number.isInteger(state.dismiss_streak) && state.dismiss_streak >= 0 &&
    validateCandidate(state.candidate);
}

function validateEvaluationInput(input, trustedEvidenceRegistry) {
  return exactKeys(input, EVALUATION_KEYS) && nonempty(input.finding_key) &&
    nonempty(input.session) && nonempty(input.branch) && HASH.test(input.fingerprint) &&
    ['confirm', 'dismiss', 'clarify'].includes(input.intent) &&
    ['P0', 'P1', 'P2', 'Nit'].includes(input.severity) &&
    ['claude', 'native-codex', 'user'].includes(input.origin) &&
    typeof input.confidence === 'number' && Number.isFinite(input.confidence) &&
    input.confidence >= 0 && input.confidence <= 1 &&
    Number.isInteger(input.user_turn) && input.user_turn >= 1 &&
    validTrustedEvidenceRegistry(trustedEvidenceRegistry) &&
    validEvidence(input.evidence, trustedEvidenceRegistry) &&
    HASH.test(input.dismissal_evidence_hash) &&
    input.dismissal_evidence_hash === evidenceHash(input.evidence);
}

function validateConfirmationInput(input) {
  return exactKeys(input, CONFIRMATION_KEYS) && nonempty(input.finding_key) &&
    nonempty(input.session) && nonempty(input.branch) && HASH.test(input.fingerprint) &&
    HASH.test(input.dismissal_evidence_hash) &&
    ['confirm', 'reject', 'ambiguous'].includes(input.decision) &&
    Number.isInteger(input.user_turn) && input.user_turn >= 1;
}

function normalizeBinding(state, input) {
  const next = identity(input);
  if (state.binding !== next) {
    state.binding = next;
    state.dismiss_streak = 0;
    state.candidate = null;
  }
}

function effectiveDismissThreshold(severity, streak) {
  if (!Number.isInteger(streak) || streak < 0) throw new Error('dismiss streak is invalid');
  const base = thresholdFor(severity);
  return {
    confidence: Math.min(0.99, base.dismiss + (streak >= 3 ? 0.05 : 0)),
    evidence: base.evidence + (streak >= 3 ? 1 : 0)
  };
}

function evaluate(current, input, trustedEvidenceRegistry) {
  const initial = current === undefined || current === null ? freshState() : current;
  if (!validateState(initial)) throw new Error('verdict state is invalid');
  if (!validateEvaluationInput(input, trustedEvidenceRegistry)) {
    throw new Error('verdict input or trusted evidence registry is invalid');
  }
  const state = structuredClone(initial);
  const threshold = thresholdFor(input.severity);
  normalizeBinding(state, input);
  if (state.candidate && input.user_turn >= state.candidate.expected_user_turn) {
    state.candidate = null;
    state.dismiss_streak = 0;
  }
  const key = attemptKey(input);
  if (state.attempts.includes(key)) {
    throw new Error('intent already consumed for this finding and fingerprint');
  }
  state.attempts.push(key);
  let transition = 'UNRESOLVED';
  if (input.intent === 'confirm' && input.confidence >= threshold.confirm) {
    transition = 'CONFIRMED';
    state.dismiss_streak = 0;
  } else if (input.intent === 'dismiss') {
    const dismiss = effectiveDismissThreshold(input.severity, state.dismiss_streak);
    if (input.confidence >= dismiss.confidence &&
        independentEvidenceCount(input.evidence, trustedEvidenceRegistry) >= dismiss.evidence) {
      if (threshold.human) {
        const evidenceIds = input.evidence.map((item) => item.evidence_id);
        transition = 'DISMISS_CANDIDATE';
        state.candidate = {
          finding_key: input.finding_key,
          fingerprint: input.fingerprint,
          dismissal_evidence_hash: input.dismissal_evidence_hash,
          evidence_ids: evidenceIds,
          trusted_registry_sha256: trustedRegistryHash(trustedEvidenceRegistry, evidenceIds),
          expected_user_turn: input.user_turn + 1
        };
      } else {
        transition = 'DISMISS_VERIFIED';
        state.dismiss_streak += 1;
      }
    } else {
      state.dismiss_streak = 0;
    }
  } else {
    state.dismiss_streak = 0;
  }
  return { state, transition, verifier: oppositeVerifier(input.origin) };
}

function confirmCandidate(current, input, trustedEvidenceRegistry) {
  const initial = current === undefined || current === null ? freshState() : current;
  if (!validateState(initial)) throw new Error('verdict state is invalid');
  if (!validateConfirmationInput(input)) throw new Error('confirmation input is invalid');
  const state = structuredClone(initial);
  const candidate = state.candidate;
  let registryMatches = false;
  if (candidate && validTrustedEvidenceRegistry(trustedEvidenceRegistry)) {
    try {
      registryMatches = trustedRegistryHash(
        trustedEvidenceRegistry,
        candidate.evidence_ids
      ) === candidate.trusted_registry_sha256;
    } catch {
      registryMatches = false;
    }
  }
  const exact = candidate && registryMatches && state.binding === identity(input) &&
    input.user_turn === candidate.expected_user_turn && input.decision === 'confirm' &&
    input.finding_key === candidate.finding_key && input.fingerprint === candidate.fingerprint &&
    input.dismissal_evidence_hash === candidate.dismissal_evidence_hash;
  state.candidate = null;
  if (exact) {
    state.dismiss_streak += 1;
    return { state, transition: 'DISMISS_VERIFIED' };
  }
  state.dismiss_streak = 0;
  return { state, transition: 'ACTIVE' };
}

function statePath(root) {
  return path.join(path.resolve(root), '.sd0x', 'seek-verdict-state.json');
}

function stateLockPath(root) {
  return path.join(path.dirname(statePath(root)), 'seek-verdict-state.lock');
}

function ensureStateDirectory(root) {
  const directory = path.dirname(statePath(root));
  if (fs.existsSync(directory) && fs.lstatSync(directory).isSymbolicLink()) {
    throw new Error('state directory must not be a symlink');
  }
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  return directory;
}

function withStateLock(root, operation) {
  ensureStateDirectory(root);
  const lock = stateLockPath(root);
  const owner = acquireStateLock(lock);
  try {
    return operation();
  } finally {
    releaseStateLock(lock, owner);
  }
}

function lockOwnerPath(lock) {
  return path.join(lock, 'owner.json');
}

function processIsAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
}

function readLockOwner(lock) {
  try {
    const value = JSON.parse(fs.readFileSync(lockOwnerPath(lock), 'utf8'));
    return exactKeys(value, ['created_at', 'nonce', 'pid']) &&
      Number.isInteger(value.pid) && value.pid > 0 && nonempty(value.nonce) &&
      typeof value.created_at === 'string' && Number.isFinite(Date.parse(value.created_at))
      ? value
      : null;
  } catch {
    return null;
  }
}

function sameOwner(left, right) {
  if (!left || !right) return left === right;
  return left.pid === right.pid && left.created_at === right.created_at &&
    left.nonce === right.nonce;
}

function newOwner() {
  return {
    pid: process.pid,
    created_at: new Date().toISOString(),
    nonce: crypto.randomUUID()
  };
}

function tryCreateStateLock(lock) {
  const owner = newOwner();
  try {
    fs.mkdirSync(lock, { mode: 0o700 });
  } catch (error) {
    if (error.code === 'EEXIST') return null;
    throw error;
  }
  try {
    fs.writeFileSync(lockOwnerPath(lock), JSON.stringify(owner) + '\n', {
      flag: 'wx',
      mode: 0o600
    });
    return owner;
  } catch (error) {
    fs.rmSync(lock, { recursive: true, force: true });
    throw error;
  }
}

function sleep(milliseconds) {
  const wait = new Int32Array(new SharedArrayBuffer(4));
  Atomics.wait(wait, 0, 0, milliseconds);
}

function reclaimClaimsPath(lock) {
  return lock + '.reclaim-claims';
}

function ensureReclaimClaimsDirectory(lock) {
  const directory = reclaimClaimsPath(lock);
  try {
    fs.mkdirSync(directory, { mode: 0o700 });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
  const stat = Object.freeze(fs.lstatSync(directory));
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error('verdict reclaim claims must be a real directory');
  }
  return directory;
}

function sameLockIdentity(left, right) {
  return left.dev === right.dev && left.ino === right.ino &&
    sameOwner(left.owner, right.owner);
}

function readReclaimClaim(file) {
  try {
    const value = JSON.parse(fs.readFileSync(file, 'utf8'));
    return exactKeys(value, ['owner', 'target']) &&
      exactKeys(value.owner, ['created_at', 'nonce', 'pid']) &&
      Number.isInteger(value.owner.pid) && value.owner.pid > 0 &&
      nonempty(value.owner.nonce) && typeof value.owner.created_at === 'string' &&
      Number.isFinite(Date.parse(value.owner.created_at)) &&
      exactKeys(value.target, ['dev', 'ino', 'owner']) &&
      Number.isInteger(value.target.dev) && Number.isInteger(value.target.ino) &&
      (value.target.owner === null ||
        (exactKeys(value.target.owner, ['created_at', 'nonce', 'pid']) &&
          Number.isInteger(value.target.owner.pid) && value.target.owner.pid > 0 &&
          nonempty(value.target.owner.nonce) &&
          typeof value.target.owner.created_at === 'string' &&
          Number.isFinite(Date.parse(value.target.owner.created_at))))
      ? value
      : null;
  } catch (error) {
    if (error.code === 'ENOENT') return undefined;
    return null;
  }
}

function activeReclaimClaims(directory) {
  const claims = [];
  for (const name of fs.readdirSync(directory).sort()) {
    const file = path.join(directory, name);
    let stat;
    try {
      stat = Object.freeze(fs.lstatSync(file));
    } catch (error) {
      if (error.code === 'ENOENT') continue;
      throw error;
    }
    if (!stat.isFile() || stat.isSymbolicLink()) {
      throw new Error('verdict reclaim claim must be a regular file');
    }
    const value = readReclaimClaim(file);
    if (value === undefined) continue;
    if (value === null) {
      if (Date.now() - stat.mtimeMs <= 30000) {
        throw new Error('verdict state lock is busy');
      }
      fs.rmSync(file, { force: true });
    } else if (processIsAlive(value.owner.pid)) {
      claims.push({ file, name, mtimeMs: stat.mtimeMs, value });
    } else {
      fs.rmSync(file, { force: true });
    }
  }
  return claims;
}

function inspectStateLock(lock) {
  const stat = Object.freeze(fs.lstatSync(lock));
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error('verdict state lock must be a real directory');
  }
  return { dev: stat.dev, ino: stat.ino, mtimeMs: stat.mtimeMs, owner: readLockOwner(lock) };
}

function acquireStateLock(lock) {
  const direct = tryCreateStateLock(lock);
  if (direct) return direct;
  let inspected;
  try {
    inspected = inspectStateLock(lock);
  } catch (error) {
    if (error.code === 'ENOENT') {
      const created = tryCreateStateLock(lock);
      if (created) return created;
      throw new Error('verdict state lock is busy');
    }
    throw error;
  }
  const staleWithoutOwner = !inspected.owner &&
    Date.now() - inspected.mtimeMs > 30000;
  if ((inspected.owner && processIsAlive(inspected.owner.pid)) ||
      (!inspected.owner && !staleWithoutOwner)) {
    throw new Error('verdict state lock is busy');
  }
  const directory = ensureReclaimClaimsDirectory(lock);
  const owner = newOwner();
  const claim = path.join(directory, owner.nonce + '.json');
  fs.writeFileSync(claim, JSON.stringify({
    owner,
    target: { dev: inspected.dev, ino: inspected.ino, owner: inspected.owner }
  }) + '\n', { flag: 'wx', mode: 0o600 });
  try {
    const claimStat = Object.freeze(fs.lstatSync(claim));
    sleep(Math.max(25, Math.ceil(claimStat.mtimeMs + 25 - Date.now())));
    const contenders = activeReclaimClaims(directory)
      .filter((entry) => sameLockIdentity(entry.value.target, inspected))
      .sort((left, right) => left.mtimeMs - right.mtimeMs ||
        Buffer.from(left.name).compare(Buffer.from(right.name)));
    if (contenders.length === 0 || contenders[0].name !== path.basename(claim)) {
      throw new Error('verdict state lock is busy');
    }
    let current;
    try {
      current = inspectStateLock(lock);
    } catch (error) {
      if (error.code === 'ENOENT') throw new Error('verdict state lock is busy');
      throw error;
    }
    if (!sameLockIdentity(current, inspected)) {
      throw new Error('verdict state lock changed during reclaim');
    }
    fs.rmSync(lock, { recursive: true, force: true });
    const created = tryCreateStateLock(lock);
    if (created) return created;
    throw new Error('verdict state lock is busy');
  } finally {
    fs.rmSync(claim, { force: true });
  }
}

function releaseStateLock(lock, owner) {
  const current = readLockOwner(lock);
  if (current && current.nonce === owner.nonce && current.pid === owner.pid) {
    fs.rmSync(lock, { recursive: true, force: true });
  }
}

function loadStateUnlocked(root) {
  const file = statePath(root);
  if (!fs.existsSync(file)) return freshState();
  if (fs.lstatSync(file).isSymbolicLink()) throw new Error('state path must not be a symlink');
  const state = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!validateState(state)) throw new Error('persisted verdict state is invalid');
  return state;
}

function loadState(root) {
  return loadStateUnlocked(root);
}

function writeStateUnlocked(root, state) {
  const directory = ensureStateDirectory(root);
  const temporary = path.join(directory, '.seek-verdict-' + crypto.randomUUID() + '.tmp');
  fs.writeFileSync(temporary, JSON.stringify(state, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  fs.renameSync(temporary, statePath(root));
}

function saveState(root, state, expectedVersion) {
  if (!validateState(state) || !Number.isInteger(expectedVersion) ||
      expectedVersion < 0 || state.version !== expectedVersion) {
    throw new Error('verdict state or expected version is invalid');
  }
  return withStateLock(root, () => {
    const persisted = loadStateUnlocked(root);
    if (persisted.version !== expectedVersion) {
      throw new Error('verdict state changed; retry the complete transition');
    }
    const next = structuredClone(state);
    next.version += 1;
    writeStateUnlocked(root, next);
    return next;
  });
}

function updateState(root, transition) {
  if (typeof transition !== 'function') throw new Error('state transition must be a function');
  return withStateLock(root, () => {
    const current = loadStateUnlocked(root);
    const result = transition(structuredClone(current));
    if (!result || typeof result !== 'object' || !validateState(result.state) ||
        result.state.version !== current.version) {
      throw new Error('state transition returned invalid state');
    }
    const next = structuredClone(result.state);
    next.version += 1;
    writeStateUnlocked(root, next);
    return { ...result, state: next };
  });
}

module.exports = {
  THRESHOLDS,
  attemptKey,
  confirmCandidate,
  effectiveDismissThreshold,
  evaluate,
  evidenceHash,
  freshState,
  loadState,
  oppositeVerifier,
  saveState,
  statePath,
  trustedRegistryHash,
  updateState,
  validateEvaluationInput,
  validateState,
  validTrustedEvidenceRegistry
};
