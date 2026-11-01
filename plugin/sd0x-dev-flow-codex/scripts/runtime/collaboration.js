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
const { inspectSessionContext, locateTranscript, findTranscriptFiles } = require('./session-context');

const ADAPTER = 'codex-collaboration-jsonl-v4';
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

function configuredProfileDispatch(marker) {
  const pluginRoot = path.resolve(__dirname, '../..');
  const file = path.join(marker.repository_root, '.codex/agents/sd0x-codex-primary-reviewer.toml');
  const profile = fs.readFileSync(file, 'utf8');
  // The managed profile has a known grammar and no model/effort pins. Preserve
  // custom profiles; do not guess how to translate arbitrary TOML into a prompt.
  const template = fs.readFileSync(path.join(pluginRoot, 'templates/agents/sd0x-codex-primary-reviewer.toml'), 'utf8');
  if (fs.lstatSync(file).isSymbolicLink() ||
      fs.realpathSync(file) !== path.join(marker.repository_root, '.codex/agents/sd0x-codex-primary-reviewer.toml') ||
      profile !== template) throw new Error('Profile dispatch requires the unchanged managed read-only primary profile; preserve custom profiles and use native role dispatch');
  const instructions = /developer_instructions = """\n([\s\S]+)\n"""\s*$/.exec(profile)?.[1];
  if (!instructions || !/^sandbox_mode = "read-only"$/m.test(profile) ||
      /^\s*(model|model_reasoning_effort)\s*=/m.test(profile)) throw new Error('Unsupported configured primary profile');
  const theory = fs.readFileSync(path.join(pluginRoot, 'skills/review/references/review-theory.md'), 'utf8');
  const taskName = `sd0x_primary_${marker.round_id.replaceAll('-', '_')}`;
  const quote = value => "'" + value.replaceAll("'", "'\\''") + "'";
  const message = [
    'Execute the configured sd0x primary review through the plugin-bound profile transport.',
    'Stay read-only: do not directly edit files, runtime state, gates, Git index or refs. Do not dispatch another reviewer.',
    'Inherit this full-history parent model and reasoning effort without overrides.',
    'Before reviewing, invoke this installed helper from your own Codex shell. It loads the configured profile and records only a bounded profile-load receipt, never a gate. Read the returned instructions and append its terminal_suffix to your final result. Do not proceed if loading fails:',
    `node ${quote(path.join(pluginRoot, 'scripts/runtime/runner.js'))} ${quote(JSON.stringify({ entrypoint: 'review/round.js', cwd: marker.repository_root, args: ['profile-load', marker.round_id] }))}`,
    `Repository: ${JSON.stringify(marker.repository_root)}`,
    `Fingerprint: ${marker.fingerprint}`,
    `Review-Round: ${marker.round_id}`,
    `Configured-Profile-SHA256: ${sha256(profile)}`,
    `Review-Contract-SHA256: ${sha256(theory)}`,
    'The helper returns the complete configured instructions and review theory. Review the complete changed-file set independently under those instructions; do not infer a verdict from previous reviews.',
    marker.commit_subject_sha256
      ? `After the verdict and profile-load terminal_suffix, end with exactly: Commit-Subject-SHA256: ${marker.commit_subject_sha256}`
      : 'When clean, return No actionable findings remain. followed by the terminal_suffix returned by profile-load.'
  ].join('\n\n');
  return {
    binding: { profile_sha256: sha256(profile), contract_sha256: sha256(theory),
      message_sha256: sha256(message), task_name: taskName },
    args: { task_name: taskName, message, fork_turns: 'all' },
    instructions: [instructions, theory].join('\n\n')
  };
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
  const profileDispatch = marker && options.profileDispatch ? configuredProfileDispatch(marker) : null;
  if (profileDispatch) marker.profile_dispatch = profileDispatch.binding;
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
  if (reusedMarker) return { available: true, ...reusedMarker, reused: true,
    ...(reusedMarker.profile_dispatch ? { dispatch: configuredProfileDispatch(reusedMarker).args } : {}) };
  return marker
    ? { available: true, ...marker, ...(profileDispatch ? { dispatch: profileDispatch.args } : {}) }
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
    ];
    if (Object.hasOwn(marker, 'profile_dispatch')) expected.push('profile_dispatch');
    if (Object.hasOwn(marker, 'profile_load')) expected.push('profile_load');
    expected.sort();
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
    if (Object.hasOwn(marker, 'profile_dispatch')) {
      const binding = marker.profile_dispatch;
      if (!binding || JSON.stringify(Object.keys(binding).sort()) !==
          JSON.stringify(['contract_sha256', 'message_sha256', 'profile_sha256', 'task_name']) ||
          !['contract_sha256', 'message_sha256', 'profile_sha256'].every(key => /^[a-f0-9]{64}$/.test(binding[key])) ||
          binding.task_name !== `sd0x_primary_${marker.round_id.replaceAll('-', '_')}`) {
        throw new Error('Collaboration profile dispatch binding is malformed');
      }
    }
    if (Object.hasOwn(marker, 'profile_load')) {
      const load = marker.profile_load;
      if (!marker.profile_dispatch || !load || JSON.stringify(Object.keys(load).sort()) !==
          JSON.stringify(['ack', 'child_id', 'delivery_sha256', 'dispatch_sha256', 'header_sha256', 'loaded_at']) ||
          !['ack', 'delivery_sha256', 'dispatch_sha256', 'header_sha256'].every(key => /^[a-f0-9]{64}$/.test(load[key])) ||
          !/^[0-9a-f-]{36}$/i.test(load.child_id || '') || !Number.isFinite(Date.parse(load.loaded_at))) {
        throw new Error('Collaboration profile load receipt is malformed');
      }
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

// Role-less schemas bind child identity separately from configured profile
// selection. An arbitrary task name, prompt or terminal claim grants no role.
function childProfileResolver(marker, env, loadingChildId = null) {
  const sessions = fs.realpathSync(path.join(env.CODEX_HOME, 'sessions'));
  let headers;
  const used = [];
  const profileDispatch = marker.profile_dispatch ? configuredProfileDispatch(marker) : null;
  if (profileDispatch && JSON.stringify(profileDispatch.binding) !== JSON.stringify(marker.profile_dispatch)) {
    throw new Error('Configured reviewer profile changed after review start');
  }
  function readHeader(file) {
    const real = fs.realpathSync(file);
    if (!real.startsWith(sessions + path.sep)) throw new Error('Child transcript escapes the session store');
    const fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
    try {
      const stat = fs.fstatSync(fd);
      if (!stat.isFile()) throw new Error('Child transcript is not a regular file');
      const buffer = Buffer.alloc(64 * 1024);
      const size = fs.readSync(fd, buffer, 0, buffer.length, 0);
      const end = buffer.subarray(0, size).indexOf(10);
      if (end < 0) throw new Error('Child session metadata is unavailable');
      const prefix = buffer.subarray(0, end + 1);
      return { file, real, dev: stat.dev, ino: stat.ino,
        hash: sha256(prefix), row: JSON.parse(prefix.toString('utf8')) };
    } finally { fs.closeSync(fd); }
  }
  function deliveredMessage(proof, start) {
    const rows = fs.readFileSync(proof.file, 'utf8').trim().split('\n').map(line => JSON.parse(line));
    const delivery = rows.find(row => row.type === 'response_item' &&
      row.metadata?.client_authored === false && row.metadata?.inherited_user_message !== true &&
      row.payload?.type === 'agent_message' && row.payload.author === marker.parent_path &&
      row.payload.recipient === start.agent_path &&
      row.payload.content?.[0]?.text?.startsWith('Message Type: NEW_TASK\n'));
    if (!delivery || Date.parse(delivery.timestamp) < Date.parse(proof.row.timestamp)) return null;
    const envelope = `Message Type: NEW_TASK\nTask name: ${start.agent_path}\nSender: ${marker.parent_path}\nPayload:\n`;
    const content = delivery.payload.content;
    const plain = content.length === 1 && content[0].type === 'input_text' &&
      content[0].text === envelope + profileDispatch.args.message && start.dispatch.message === profileDispatch.args.message;
    const encrypted = content.length === 2 && content[0].type === 'input_text' && content[0].text === envelope &&
      content[1].type === 'encrypted_content' && /^gAAAA[A-Za-z0-9_-]+={0,2}$/.test(start.dispatch.message) &&
      content[1].encrypted_content === start.dispatch.message;
    return plain || encrypted ? sha256(JSON.stringify(delivery)) : null;
  }
  function resolve(start, receiptTime) {
    if (!headers) {
      headers = findTranscriptFiles(sessions, '.jsonl').map(file => {
        // Unrelated/partially-created sessions need not block this review.
        try { return readHeader(file); } catch { return null; }
      }).filter(Boolean);
    }
    const candidates = headers.filter(({ row }) => {
      const spawn = row.payload?.source?.subagent?.thread_spawn;
      return spawn?.parent_thread_id === env.CODEX_THREAD_ID &&
        spawn.agent_path === start.agent_path &&
        Date.parse(row.timestamp) >= Date.parse(start.started_at) &&
        Date.parse(row.timestamp) <= Date.parse(receiptTime);
    });
    if (candidates.length !== 1) return null;
    const proof = candidates[0];
    const { row } = proof;
    const meta = row.payload;
    const spawn = meta.source.subagent.thread_spawn;
    const nativeRole = meta.agent_role === spawn.agent_role && marker.reviewers.includes(meta.agent_role);
    const untypedRole = [undefined, null, 'default'].includes(meta.agent_role) &&
      [undefined, null, 'default'].includes(spawn.agent_role);
    const exactDispatch = profileDispatch && start.dispatch &&
      JSON.stringify(Object.keys(start.dispatch).sort()) === JSON.stringify(['fork_turns', 'message', 'task_name']) &&
      start.dispatch.task_name === profileDispatch.args.task_name && start.dispatch.fork_turns === 'all' &&
      typeof start.dispatch.message === 'string';
    const deliveryHash = exactDispatch ? deliveredMessage(proof, start) : null;
    const loadProof = deliveryHash ? { child_id: meta.id, header_sha256: proof.hash,
      delivery_sha256: deliveryHash, dispatch_sha256: sha256(start.dispatch.message) } : null;
    const loaded = loadProof && (loadingChildId === meta.id ||
      (marker.profile_load && Object.entries(loadProof).every(([key, value]) => marker.profile_load[key] === value)));
    const boundRole = untypedRole && loaded;
    if (row.type !== 'session_meta' || row.metadata?.client_authored === true ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(meta.id || '') ||
        !proof.file.endsWith(`-${meta.id}.jsonl`) ||
        Date.parse(row.timestamp) < Date.parse(marker.started_at) ||
        (meta.timestamp !== undefined &&
          !(Date.parse(meta.timestamp) >= Date.parse(start.started_at) && Date.parse(meta.timestamp) <= Date.parse(receiptTime))) ||
        meta.parent_thread_id !== env.CODEX_THREAD_ID ||
        (meta.forked_from_id !== undefined && meta.forked_from_id !== env.CODEX_THREAD_ID) ||
        meta.agent_path !== start.agent_path || meta.thread_source !== 'subagent' ||
        (!nativeRole && !boundRole) || (profileDispatch && !loaded) ||
        typeof meta.cwd !== 'string' || !path.isAbsolute(meta.cwd) ||
        fs.realpathSync(findRepoRoot(meta.cwd)) !== marker.repository_root) return null;
    used.push({ ...proof, start, deliveryHash });
    return { agent_type: marker.reviewers[0],
      agent_id: `${start.agent_id}:${meta.id}${profileDispatch ? ':profile:' + marker.profile_dispatch.profile_sha256 : ''}`,
      ...(profileDispatch ? { profile_load_proof: loadProof, profile_ack: marker.profile_load?.ack || null } : {}) };
  }
  function revalidate() {
    if (profileDispatch && JSON.stringify(configuredProfileDispatch(marker).binding) !== JSON.stringify(marker.profile_dispatch)) {
      throw new Error('Configured reviewer profile changed during import');
    }
    for (const before of used) {
      const after = readHeader(before.file);
      if (before.real !== after.real || before.dev !== after.dev ||
          before.ino !== after.ino || before.hash !== after.hash ||
          (before.deliveryHash && deliveredMessage(after, before.start) !== before.deliveryHash)) {
        throw new Error('Configured reviewer child metadata changed during import');
      }
    }
  }
  return { resolve, revalidate };
}

function loadCollaborationProfile(cwd = process.cwd(), roundId, options = {}) {
  const env = options.env || process.env;
  const root = findRepoRoot(cwd);
  const context = inspectSessionContext(root, env);
  if (!context.available) throw new Error(`Child profile context unavailable: ${context.reason}`);
  const child = JSON.parse(fs.readFileSync(context.transcript_path, 'utf8').split('\n')[0]).payload;
  return withMarkerLock(root, () => {
    const marker = readMarker(root), state = readState(root), worktree = snapshot(root);
    if (!marker?.profile_dispatch || marker.round_id !== roundId ||
        marker.fingerprint !== worktree.fingerprint || marker.runtime_epoch !== state.runtime_epoch ||
        state.review_agents.collaboration_round_id !== marker.round_id) throw new Error('Profile load round is stale or unavailable');
    const parentEnv = { ...env, CODEX_THREAD_ID: child.parent_thread_id };
    const parent = inspectSessionContext(root, parentEnv);
    if (!parent.available || parent.transcript_path !== marker.transcript_path) throw new Error('Profile load parent context does not match');
    const bytes = fs.readFileSync(parent.transcript_path), stat = fs.statSync(parent.transcript_path);
    if (stat.dev !== marker.transcript_dev || stat.ino !== marker.transcript_ino ||
        sha256(bytes.subarray(0, marker.transcript_offset)) !== marker.transcript_prefix_sha256) throw new Error('Profile load parent transcript changed');
    const rows = bytes.subarray(marker.transcript_offset).toString('utf8').trim().split('\n').map(line => JSON.parse(line));
    const calls = rows.filter(row => row.type === 'response_item' && row.metadata?.client_authored === false &&
      row.payload?.type === 'function_call' && row.payload.namespace === 'collaboration' && row.payload.name === 'spawn_agent')
      .map(row => ({ row, args: JSON.parse(row.payload.arguments) }))
      .filter(({ args }) => args.task_name === marker.profile_dispatch.task_name);
    if (calls.length !== 1) throw new Error('Profile load requires one fresh prepared dispatch');
    const { row: call, args } = calls[0];
    const receipts = rows.filter(row => row.type === 'response_item' && row.metadata?.client_authored === false &&
      row.payload?.type === 'function_call_output' && row.payload.call_id === call.payload.call_id);
    const agentPath = `${marker.parent_path}/${args.task_name}`;
    if (receipts.length !== 1 || JSON.stringify(JSON.parse(receipts[0].payload.output)) !== JSON.stringify({ task_name: agentPath })) {
      throw new Error('Profile load requires the successful direct-child receipt');
    }
    const resolver = childProfileResolver(marker, parentEnv, env.CODEX_THREAD_ID);
    const identity = resolver.resolve({ dispatch: args, agent_path: agentPath,
      agent_id: `dispatch:${call.payload.call_id}`, started_at: call.timestamp }, receipts[0].timestamp);
    if (!identity?.profile_load_proof) throw new Error('Profile load child, delivery or dispatch does not match');
    const profile = configuredProfileDispatch(marker);
    resolver.revalidate();
    if (marker.profile_load && !Object.entries(identity.profile_load_proof).every(([key, value]) => marker.profile_load[key] === value)) {
      throw new Error('Profile was already loaded by a different child or delivery');
    }
    marker.profile_load ||= { ...identity.profile_load_proof, ack: crypto.randomBytes(32).toString('hex'), loaded_at: new Date().toISOString() };
    writeMarker(root, marker);
    return { loaded: true, round_id: marker.round_id, fingerprint: marker.fingerprint,
      primary_agent: marker.reviewers[0], profile_sha256: marker.profile_dispatch.profile_sha256,
      instructions: profile.instructions, terminal_suffix: `Profile-Load-Ack: ${marker.profile_load.ack}` };
  });
}

function parseCollaborationEvents(
  text,
  reviewers,
  parentPath = '/root',
  expectedCommitSubjectSha256 = null,
  options = {}
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
  let roleless = false;
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
    if (row.type === 'turn_context' && options.repositoryRoot &&
        (row.metadata?.client_authored === true || typeof payload?.cwd !== 'string' ||
         !path.isAbsolute(payload.cwd) ||
         fs.realpathSync(findRepoRoot(payload.cwd)) !== options.repositoryRoot)) {
      throw new Error('Collaboration review crossed a project context boundary');
    }
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
      const withoutRole = !Object.hasOwn(args, 'agent_type');
      if (options.profileDispatch && !withoutRole && reviewerSet.has(args.agent_type)) {
        throw new Error('Profile-bound review requires its exact prepared dispatch arguments');
      }
      if (!withoutRole && !reviewerSet.has(args.agent_type) && !reviewerSet.has(args.task_name)) continue;
      if (!hostRow(row) || typeof payload.call_id !== 'string' || !payload.call_id ||
          (!withoutRole && !reviewerSet.has(args.agent_type)) ||
          typeof args.task_name !== 'string' || !/^[a-z0-9_]+$/.test(args.task_name)) {
        throw new Error('Malformed or untrusted configured reviewer dispatch');
      }
      if (dispatches.has(payload.call_id) || received.has(payload.call_id)) {
        throw new Error('Duplicate collaboration dispatch call');
      }
      dispatches.set(payload.call_id, {
        agent_type: withoutRole ? null : args.agent_type,
        agent_path: `${parentPath}/${args.task_name}`,
        parent_path: parentPath,
        agent_id: `dispatch:${payload.call_id}`,
        started_at: row.timestamp,
        ...(withoutRole ? { dispatch: args } : {})
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
      if (start.agent_type === null) {
        roleless = true;
        const identity = options.resolveProfile?.(start, row.timestamp);
        if (!identity) continue;
        if (!reviewerSet.has(identity.agent_type)) throw new Error('Unconfigured reviewer profile');
        Object.assign(start, identity);
      }
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
      if (options.profileDispatch) throw new Error('Profile-bound review requires its prepared dispatch and child metadata');
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
    if (start.profile_ack) {
      const resultLines = result.split(/\r?\n/);
      if (resultLines.at(-1) !== `Profile-Load-Ack: ${start.profile_ack}`) throw new Error('Configured reviewer profile-load acknowledgement is missing or incorrect');
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
      if (roleless) throw new Error(`Role-less spawn has no authenticated configured reviewer profile and terminal result for ${reviewer}; start a fresh round with begin --profile-dispatch and use its exact dispatch arguments`);
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
  const env = options.env || process.env;
  const context = inspectSessionContext(root, env);
  if (!context.available) throw new Error(`Collaboration session context unavailable: ${context.reason}`);
  const profiles = childProfileResolver(marker, env);
  const results = parseCollaborationEvents(
    bytes.subarray(marker.transcript_offset).toString('utf8'),
    marker.reviewers,
    marker.parent_path,
    marker.commit_subject_sha256,
    { repositoryRoot: marker.repository_root, resolveProfile: profiles.resolve,
      profileDispatch: Boolean(marker.profile_dispatch) }
  );
  if (typeof options.beforeRecord === 'function') options.beforeRecord();
  profiles.revalidate();
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
  loadCollaborationProfile,
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
