'use strict';

const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');
const {
  isCurrentPass,
  commitClosureReviewIdentity,
  readState,
  recordCollaborationRoundStart,
  refreshState,
  recordCollaborationReview,
  resolveRuntimeMetadataPath
} = require('./state');
const { reviewProvider } = require('./config');
const { findRepoRoot, snapshot } = require('./worktree');
const { inspectSessionContext, locateTranscript } = require('./session-context');

const ADAPTER = 'codex-collaboration-jsonl-v3';
const MARKER_SCHEMA_VERSION = 4;
const MARKER_LOCK_OWNER_GRACE_MS = 1_000;
const MARKER_LOCK_WAIT_MS = 5_000;

function sleep(milliseconds) {
  const buffer = new SharedArrayBuffer(4);
  Atomics.wait(new Int32Array(buffer), 0, 0, milliseconds);
}

function requiredReviewers(provider) {
  if (provider !== 'codex') throw new Error('Collaboration review requires the Codex provider');
  return ['sd0x_codex_primary_reviewer'];
}

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function markerPath(cwd = process.cwd()) {
  return resolveRuntimeMetadataPath(cwd, 'collaboration-review.json');
}

function withMarkerLock(cwd, callback, hooks = {}) {
  const filePath = markerPath(cwd);
  const lockPath = `${filePath}.lock`;
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  let acquired = false;
  const deadline = Date.now() + MARKER_LOCK_WAIT_MS;
  while (!acquired) {
    try {
      fs.mkdirSync(lockPath);
      try {
        fs.writeFileSync(path.join(lockPath, 'owner'), String(process.pid));
      } catch (error) {
        fs.rmSync(lockPath, { recursive: true, force: true });
        throw error;
      }
      acquired = true;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      if (typeof hooks.beforeInspect === 'function') hooks.beforeInspect(lockPath);
      let age;
      try {
        age = Date.now() - fs.statSync(lockPath).mtimeMs;
      } catch (statError) {
        if (statError.code === 'ENOENT') continue;
        throw statError;
      }
      let owner = null;
      try {
        owner = Number.parseInt(
          fs.readFileSync(path.join(lockPath, 'owner'), 'utf8').trim(),
          10
        );
      } catch (readError) {
        if (readError.code !== 'ENOENT') throw readError;
      }
      let ownerAlive = false;
      if (Number.isInteger(owner) && owner > 0) {
        try {
          process.kill(owner, 0);
          ownerAlive = true;
        } catch (killError) {
          ownerAlive = killError.code === 'EPERM';
        }
      }
      const reclaimable = (Number.isInteger(owner) && owner > 0 && !ownerAlive) ||
        ((!Number.isInteger(owner) || owner <= 0) &&
          age > MARKER_LOCK_OWNER_GRACE_MS);
      if (!reclaimable) {
        if (Date.now() < deadline) {
          sleep(Math.min(20, Math.max(1, deadline - Date.now())));
          continue;
        }
        throw new Error('Collaboration review round is being updated concurrently');
      }
      const abandoned = `${lockPath}.abandoned.${process.pid}.${Date.now()}`;
      if (typeof hooks.beforeReclaim === 'function') hooks.beforeReclaim(lockPath);
      try {
        fs.renameSync(lockPath, abandoned);
      } catch (renameError) {
        if (renameError.code === 'ENOENT') continue;
        throw renameError;
      }
      fs.rmSync(abandoned, { recursive: true, force: true });
    }
  }
  try {
    return callback();
  } finally {
    fs.rmSync(lockPath, { recursive: true, force: true });
  }
}

function writeMarker(cwd, marker) {
  const filePath = markerPath(cwd);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(marker, null, 2)}\n`, {
    mode: 0o600
  });
  fs.renameSync(temporary, filePath);
}

function beginCollaborationReview(cwd = process.cwd(), options = {}) {
  const root = findRepoRoot(cwd);
  const worktree = snapshot(root);
  const commitIdentity = options.commitSubjectSha256
    ? commitClosureReviewIdentity(root)
    : null;
  if (!worktree.requires_review &&
      (!commitIdentity ||
       commitIdentity.subject_sha256 !== options.commitSubjectSha256)) {
    return { available: false, reason: 'worktree-clean' };
  }
  if (worktree.requires_review && options.commitSubjectSha256) {
    throw new Error('Commit collaboration review requires a clean tracked worktree');
  }
  const provider = reviewProvider(root);
  const state = refreshState(root);
  const roundId = crypto.randomUUID();
  const roundIdentity = {
    expected_fingerprint: worktree.fingerprint,
    expected_provider: provider,
    expected_runtime_epoch: state.runtime_epoch,
    round_id: roundId
  };
  const context = inspectSessionContext(root, options.env || process.env);
  const transcriptPath = context.available ? context.transcript_path : null;
  const transcriptReal = transcriptPath ? fs.realpathSync(transcriptPath) : null;
  const transcriptBytes = transcriptReal ? fs.readFileSync(transcriptReal) : null;
  const transcriptStat = transcriptReal ? fs.statSync(transcriptReal) : null;
  const parentPath = options.parentPath || '/root';
  const marker = transcriptReal ? {
    schema_version: MARKER_SCHEMA_VERSION,
    adapter: ADAPTER,
    round_id: roundId,
    repository_root: fs.realpathSync(root),
    fingerprint: worktree.fingerprint,
    commit_subject_sha256: commitIdentity?.subject_sha256 || null,
    commit_attestation_generation: commitIdentity?.generation || null,
    provider,
    runtime_epoch: state.runtime_epoch,
    parent_path: parentPath,
    reviewers: requiredReviewers(provider),
    transcript_path: transcriptReal,
    transcript_offset: transcriptBytes.length,
    transcript_prefix_sha256: sha256(transcriptBytes),
    transcript_dev: transcriptStat.dev,
    transcript_ino: transcriptStat.ino,
    started_at: new Date().toISOString()
  } : null;
  let reusedMarker = null;
  withMarkerLock(root, () => {
    let existing;
    try {
      existing = readMarker(root);
    } catch (error) {
      const current = readState(root);
      if (current.review_agents.started.some((entry) =>
        entry.agent_id.startsWith('collaboration:')
      )) throw error;
      const corruptPath = `${markerPath(root)}.corrupt.${Date.now()}.${crypto.randomUUID()}`;
      fs.renameSync(markerPath(root), corruptPath);
      existing = null;
    }
    if (existing && existing.repository_root === fs.realpathSync(root) &&
        existing.fingerprint === worktree.fingerprint &&
        existing.provider === provider &&
        existing.runtime_epoch === state.runtime_epoch &&
        existing.commit_subject_sha256 === (commitIdentity?.subject_sha256 || null) &&
        existing.commit_attestation_generation ===
          (commitIdentity?.generation || null)) {
      if (commitIdentity) {
        reusedMarker = existing;
        return;
      }
      throw new Error(
        'A collaboration review round is already active for this fingerprint'
      );
    }
    if (existing) fs.rmSync(markerPath(root), { force: true });
    recordCollaborationRoundStart(root, roundIdentity);
    if (marker) writeMarker(root, marker);
    const current = readState(root);
    if (current.runtime_epoch !== state.runtime_epoch ||
        current.worktree.fingerprint !== worktree.fingerprint ||
        current.review_provider !== provider) {
      if (marker) fs.rmSync(markerPath(root), { force: true });
      throw new Error('Collaboration review round changed while it was starting');
    }
  });
  if (reusedMarker) return { available: true, ...reusedMarker, reused: true };
  return marker
    ? { available: true, ...marker }
    : {
        available: false,
        reason: 'collaboration-transcript-unavailable',
        context,
        round_id: roundId,
        fingerprint: worktree.fingerprint,
        provider,
        runtime_epoch: state.runtime_epoch
      };
}

function readMarker(cwd) {
  const filePath = markerPath(cwd);
  try {
    const marker = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const keys = Object.keys(marker).sort();
    const expected = [
      'adapter', 'fingerprint', 'parent_path', 'provider', 'repository_root',
      'reviewers', 'round_id', 'runtime_epoch', 'schema_version', 'started_at',
      'commit_subject_sha256', 'commit_attestation_generation',
      'transcript_dev', 'transcript_ino', 'transcript_offset',
      'transcript_path', 'transcript_prefix_sha256'
    ].sort();
    if (JSON.stringify(keys) !== JSON.stringify(expected) ||
        marker.schema_version !== MARKER_SCHEMA_VERSION || marker.adapter !== ADAPTER ||
        typeof marker.round_id !== 'string' || !marker.round_id ||
        marker.provider !== 'codex' ||
        typeof marker.fingerprint !== 'string' ||
        !(/^[a-f0-9]{64}$/.test(marker.fingerprint) ||
          (marker.fingerprint === 'clean' &&
           /^[a-f0-9]{64}$/.test(marker.commit_subject_sha256 || ''))) ||
        !(marker.commit_subject_sha256 === null ||
          /^[a-f0-9]{64}$/.test(marker.commit_subject_sha256 || '')) ||
        !(marker.commit_attestation_generation === null ||
          /^[0-9a-f-]{36}$/i.test(marker.commit_attestation_generation || '')) ||
        ((marker.commit_subject_sha256 === null) !==
          (marker.commit_attestation_generation === null)) ||
        !Array.isArray(marker.reviewers) ||
        JSON.stringify(marker.reviewers) !==
          JSON.stringify(requiredReviewers(marker.provider)) ||
        typeof marker.runtime_epoch !== 'string' || !marker.runtime_epoch ||
        typeof marker.parent_path !== 'string' || !/^\/[A-Za-z0-9_/-]+$/.test(marker.parent_path) ||
        !Number.isInteger(marker.transcript_offset) || marker.transcript_offset < 0 ||
        typeof marker.transcript_prefix_sha256 !== 'string' ||
        !/^[a-f0-9]{64}$/.test(marker.transcript_prefix_sha256) ||
        !Number.isInteger(marker.transcript_dev) || marker.transcript_dev < 0 ||
        !Number.isInteger(marker.transcript_ino) || marker.transcript_ino < 0 ||
        typeof marker.transcript_path !== 'string' ||
        typeof marker.repository_root !== 'string' ||
        typeof marker.started_at !== 'string' ||
        !Number.isFinite(Date.parse(marker.started_at))) {
      throw new Error('Collaboration review marker is malformed');
    }
    return marker;
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function payloadText(message, author, parentPath) {
  const text = Array.isArray(message.content)
    ? message.content.filter((item) => item?.type === 'input_text')
      .map((item) => item.text).join('\n')
    : '';
  const match = /^Message Type: FINAL_ANSWER\r?\nTask name: ([^\r\n]+)\r?\nSender: ([^\r\n]+)\r?\nPayload:\r?\n([\s\S]+)$/.exec(text);
  if (!match || match[1] !== parentPath || match[2] !== author) return null;
  const payload = match[3].trim();
  return payload || null;
}

function parseCollaborationEvents(
  text,
  reviewers,
  parentPath = '/root',
  expectedCommitSubjectSha256 = null
) {
  const reviewerSet = new Set(reviewers);
  const pending = new Map();
  const interrupted = new Set();
  const overlapping = new Set();
  // Codex 0.159.2 records collaboration dispatch as a namespaced function call
  // and its host receipt instead of sub_agent_activity. Both must occur after
  // the round boundary; an agent_message alone never establishes authority.
  const dispatches = new Map();
  const received = new Set();
  const dispatchedPaths = new Map();
  const reviewerAt = (agentPath) => dispatchedPaths.get(agentPath) ||
    reviewers.find((candidate) => agentPath === `${parentPath}/${candidate}`);
  const hostRow = (row) => row.type === 'response_item' &&
    row.metadata?.client_authored === false &&
    typeof row.timestamp === 'string' && Number.isFinite(Date.parse(row.timestamp));
  const startReview = (entry) => {
    if ([...pending.values()].some((item) => item.agent_type === entry.agent_type)) {
      overlapping.add(entry.agent_type);
    }
    pending.set(entry.agent_path, entry);
  };
  const results = [];
  const lines = text.split('\n').filter((line) => line.trim());
  for (let index = 0; index < lines.length; index += 1) {
    let row;
    try {
      row = JSON.parse(lines[index]);
    } catch {
      throw new Error('Collaboration transcript contains malformed JSONL');
    }
    const payload = row?.payload;
    if (payload?.type === 'function_call' && payload.namespace === 'collaboration' &&
        ['spawn_agent', 'followup_task', 'interrupt_agent'].includes(payload.name)) {
      let args;
      try {
        args = JSON.parse(payload.arguments);
      } catch {
        throw new Error('Malformed collaboration dispatch arguments');
      }
      if (!args || typeof args !== 'object' || Array.isArray(args)) {
        throw new Error('Malformed collaboration dispatch arguments');
      }
      if (payload.name !== 'spawn_agent') {
        const target = typeof args.target === 'string' && args.target.startsWith('/')
          ? args.target : `${parentPath}/${args.target}`;
        const agentType = reviewerAt(target);
        if (!agentType) continue;
        if (!hostRow(row)) throw new Error('Untrusted collaboration dispatch');
        if (payload.name === 'interrupt_agent') {
          interrupted.add(agentType);
          pending.delete(target);
        } else {
          // A followup can refer to an agent created before the round boundary.
          // This adapter deliberately requires a fresh, profile-bound spawn.
          throw new Error('Collaboration review requires a fresh configured spawn, not followup_task');
        }
        continue;
      }
      if (!reviewerSet.has(args.agent_type) && !reviewerSet.has(args.task_name)) continue;
      if (!hostRow(row) || typeof payload.call_id !== 'string' || !payload.call_id ||
          !reviewerSet.has(args.agent_type) ||
          typeof args.task_name !== 'string' || !/^[a-z0-9_]+$/.test(args.task_name)) {
        throw new Error('Malformed or untrusted configured reviewer dispatch');
      }
      if (dispatches.has(payload.call_id) || received.has(payload.call_id)) {
        throw new Error('Duplicate collaboration dispatch call');
      }
      dispatches.set(payload.call_id, {
        agent_type: args.agent_type,
        agent_path: `${parentPath}/${args.task_name}`,
        parent_path: parentPath,
        agent_id: `dispatch:${payload.call_id}`,
        started_at: row.timestamp
      });
      continue;
    }
    if (payload?.type === 'function_call_output' &&
        (dispatches.has(payload.call_id) || received.has(payload.call_id))) {
      if (!hostRow(row) || received.has(payload.call_id)) {
        throw new Error('Untrusted or duplicate collaboration dispatch receipt');
      }
      const start = dispatches.get(payload.call_id);
      let receipt;
      try {
        receipt = JSON.parse(payload.output);
      } catch {
        throw new Error('Malformed collaboration dispatch receipt');
      }
      if (!receipt || Object.keys(receipt).length !== 1 ||
          receipt.task_name !== start.agent_path || dispatchedPaths.has(start.agent_path)) {
        throw new Error('Collaboration dispatch receipt does not confirm a fresh configured reviewer');
      }
      dispatches.delete(payload.call_id);
      received.add(payload.call_id);
      dispatchedPaths.set(start.agent_path, start.agent_type);
      startReview(start);
      continue;
    }
    const canonicalActivity = reviewers.find((candidate) =>
      payload?.agent_path === `${parentPath}/${candidate}`
    );
    if (canonicalActivity && payload?.type !== 'sub_agent_activity') {
      throw new Error(`Malformed collaboration activity for ${canonicalActivity}`);
    }
    const canonicalAuthor = reviewerAt(payload?.author);
    if (canonicalAuthor && payload?.type !== 'agent_message') {
      throw new Error(`Malformed collaboration terminal message for ${canonicalAuthor}`);
    }
    if (payload?.type === 'sub_agent_activity') {
      const agentPath = payload.agent_path;
      const agentType = reviewers.find((candidate) =>
        agentPath === `${parentPath}/${candidate}`
      );
      if (!agentType || !reviewerSet.has(agentType)) continue;
      if (row?.type !== 'event_msg' ||
          typeof row.timestamp !== 'string' || !Number.isFinite(Date.parse(row.timestamp)) ||
          typeof payload.agent_thread_id !== 'string' || !payload.agent_thread_id ||
          typeof payload.event_id !== 'string' || !payload.event_id ||
          !['interacted', 'interrupted'].includes(payload.kind)) {
        throw new Error(`Malformed collaboration activity for ${agentType}`);
      }
      if (payload.kind === 'interacted') {
        startReview({
          agent_type: agentType,
          agent_path: agentPath,
          parent_path: parentPath,
          agent_id: `${payload.agent_thread_id}:${payload.event_id}`,
          started_at: row.timestamp
        });
      } else if (payload.kind === 'interrupted') {
        interrupted.add(agentType);
        pending.delete(agentPath);
      }
      continue;
    }
    if (payload?.type !== 'agent_message' || typeof payload.author !== 'string') continue;
    const start = pending.get(payload.author);
    if (canonicalAuthor && (row?.type !== 'response_item' || payload.recipient !== parentPath ||
        (dispatchedPaths.has(payload.author) && !hostRow(row)))) {
      throw new Error('Malformed collaboration terminal message');
    }
    if (!start || payload.recipient !== start.parent_path) continue;
    let result = payloadText(payload, payload.author, start.parent_path);
    if (!result) continue;
    if (expectedCommitSubjectSha256) {
      const terminal = `Commit-Subject-SHA256: ${expectedCommitSubjectSha256}`;
      const resultLines = result.split(/\r?\n/);
      if (resultLines.at(-1) !== terminal) {
        throw new Error(
          `Collaboration reviewer result must end with exactly: ${terminal}`
        );
      }
      result = resultLines.slice(0, -1).join('\n').trim();
      if (!result) throw new Error('Collaboration reviewer result is empty');
    }
    results.push({
      ...start,
      result,
      commit_subject_sha256: expectedCommitSubjectSha256
    });
    pending.delete(payload.author);
  }
  if (dispatches.size) throw new Error('Collaboration dispatch has no successful host receipt');
  for (const reviewer of reviewers) {
    if (interrupted.has(reviewer)) {
      throw new Error(`Collaboration reviewer was interrupted: ${reviewer}`);
    }
    if (overlapping.has(reviewer)) {
      throw new Error(`Collaboration reviewer has overlapping starts: ${reviewer}`);
    }
    if ([...pending.values()].some((entry) => entry.agent_type === reviewer)) {
      throw new Error(`Collaboration reviewer has no terminal result: ${reviewer}`);
    }
    if (!results.some((entry) => entry.agent_type === reviewer)) {
      throw new Error(`Collaboration transcript has no terminal result for ${reviewer}`);
    }
  }
  return results;
}

function completeCollaborationReview(cwd = process.cwd(), options = {}) {
  const root = findRepoRoot(cwd);
  return withMarkerLock(root, () => {
    const marker = readMarker(root);
    if (!marker) {
      const state = readState(root);
      const worktree = snapshot(root);
      const provider = reviewProvider(root);
      const completedTypes = new Set(state.review_agents.completed
        .filter((entry) =>
          typeof options.expectedRoundId === 'string' &&
          entry.agent_id.startsWith(
            `collaboration-result:${options.expectedRoundId}:`
          ) && entry.outcome === 'clean'
        )
        .map((entry) => entry.agent_type));
      if (typeof options.expectedFingerprint === 'string' &&
          state.runtime_epoch === options.expectedRuntimeEpoch &&
          provider === options.expectedProvider &&
          worktree.fingerprint === options.expectedFingerprint &&
          state.worktree.fingerprint === options.expectedFingerprint &&
          requiredReviewers(provider).every((agentType) =>
            completedTypes.has(agentType)
          ) &&
          isCurrentPass(state, 'review')) {
        return {
          completed: true,
          already_completed: true,
          fingerprint: options.expectedFingerprint
        };
      }
      return { completed: false, reason: 'marker-missing' };
    }
    const worktree = snapshot(root);
    const state = readState(root);
    const commitIdentity = marker.commit_subject_sha256
      ? commitClosureReviewIdentity(root)
      : null;
    if ((typeof options.expectedRoundId === 'string' &&
          marker.round_id !== options.expectedRoundId) ||
        (marker.commit_subject_sha256 &&
          (commitIdentity?.subject_sha256 !== marker.commit_subject_sha256 ||
           commitIdentity?.generation !== marker.commit_attestation_generation)) ||
        worktree.fingerprint !== marker.fingerprint ||
        state.runtime_epoch !== marker.runtime_epoch ||
        state.review_provider !== marker.provider ||
        state.gates.review.status !== 'pass' ||
        state.gates.review.fingerprint !== marker.fingerprint) {
      throw new Error('Collaboration review cannot finalize before its gate passes');
    }
    if (typeof options.beforeRemove === 'function') options.beforeRemove();
    const finalMarker = readMarker(root);
    const finalState = readState(root);
    const finalWorktree = snapshot(root);
    const finalCommitIdentity = marker.commit_subject_sha256
      ? commitClosureReviewIdentity(root)
      : null;
    if (!finalMarker || finalMarker.round_id !== marker.round_id ||
        finalMarker.runtime_epoch !== marker.runtime_epoch ||
        finalMarker.fingerprint !== marker.fingerprint ||
        (marker.commit_subject_sha256 &&
          finalCommitIdentity?.generation !== marker.commit_attestation_generation) ||
        finalState.runtime_epoch !== marker.runtime_epoch ||
        finalWorktree.fingerprint !== marker.fingerprint ||
        finalState.gates.review.status !== 'pass' ||
        finalState.gates.review.fingerprint !== marker.fingerprint) {
      throw new Error('Collaboration review changed before marker completion');
    }
    fs.rmSync(markerPath(root), { force: true });
    return {
      completed: true,
      round_id: marker.round_id,
      fingerprint: marker.fingerprint
    };
  });
}

function importCollaborationReview(cwd = process.cwd(), options = {}) {
  const root = findRepoRoot(cwd);
  const marker = readMarker(root);
  if (!marker) return { imported: false, reason: 'marker-missing' };
  if (typeof options.expectedRoundId === 'string' &&
      marker.round_id !== options.expectedRoundId) {
    throw new Error('Collaboration review round was superseded');
  }
  const worktree = snapshot(root);
  const provider = reviewProvider(root);
  const commitIdentity = marker.commit_subject_sha256
    ? commitClosureReviewIdentity(root)
    : null;
  if (fs.realpathSync(root) !== marker.repository_root ||
      worktree.fingerprint !== marker.fingerprint || provider !== marker.provider ||
      (marker.commit_subject_sha256 &&
       (commitIdentity?.subject_sha256 !== marker.commit_subject_sha256 ||
        commitIdentity?.generation !== marker.commit_attestation_generation))) {
    throw new Error('Collaboration review marker is stale for the current worktree');
  }
  const transcriptPath = fs.realpathSync(marker.transcript_path);
  // The prefix check below binds the metadata validated at begin. Check physical
  // identity first so replacement/truncation retains its precise failure reason.
  const currentTranscript = locateTranscript(options.env);
  if (transcriptPath !== marker.transcript_path ||
      !currentTranscript || transcriptPath !== currentTranscript) {
    throw new Error('Collaboration transcript identity changed after review start');
  }
  const bytes = fs.readFileSync(transcriptPath);
  const stat = fs.statSync(transcriptPath);
  if (marker.transcript_offset > bytes.length) {
    throw new Error('Collaboration transcript was truncated after review start');
  }
  if (stat.dev !== marker.transcript_dev || stat.ino !== marker.transcript_ino ||
      sha256(bytes.subarray(0, marker.transcript_offset)) !==
        marker.transcript_prefix_sha256) {
    throw new Error('Collaboration transcript prefix changed after review start');
  }
  const results = parseCollaborationEvents(
    bytes.subarray(marker.transcript_offset).toString('utf8'),
    marker.reviewers,
    marker.parent_path,
    marker.commit_subject_sha256
  );
  if (typeof options.beforeRecord === 'function') options.beforeRecord();
  recordCollaborationReview(root, {
    expected_fingerprint: marker.fingerprint,
    expected_provider: marker.provider,
    expected_runtime_epoch: marker.runtime_epoch,
    expected_round_id: marker.round_id,
    expected_commit_subject_sha256: marker.commit_subject_sha256,
    expected_commit_attestation_generation: marker.commit_attestation_generation,
    transcript_path: transcriptPath,
    results
  });
  return {
    imported: true,
    adapter: ADAPTER,
    fingerprint: marker.fingerprint,
    provider: marker.provider,
    runtime_epoch: marker.runtime_epoch,
    round_id: marker.round_id,
    results: results.map((entry) => ({
      agent_type: entry.agent_type,
      outcome: /^no actionable findings(?: remain)?\.?$/i.test(entry.result)
        ? 'clean'
        : 'findings'
    }))
  };
}

module.exports = {
  ADAPTER,
  beginCollaborationReview,
  completeCollaborationReview,
  importCollaborationReview,
  locateTranscript,
  markerPath,
  parseCollaborationEvents,
  payloadText,
  withMarkerLock,
  requiredReviewers
};
