'use strict';

// Pure outcome classification. Inputs must be collected from actual read-only
// GitHub calls by the skill; this module does not create observation evidence.
function stackObservation(layers, responses) {
  if (!Array.isArray(layers) || layers.length < 2 || !Array.isArray(responses) ||
      responses.length !== layers.length || layers.some(layer => typeof layer.head !== 'string' ||
        (layer.pr !== null && (!Number.isSafeInteger(layer.pr) || layer.pr < 1))) ||
      new Set(layers.map(layer => layer.head)).size !== layers.length) return { state: 'unverifiable' };
  const queries = [];
  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i], response = responses[i];
    if (!response || response.pr_lookup_complete !== true) return { state: 'unverifiable' };
    if (layer.pr === null) {
      if (response.prs_found !== 0) return { state: 'unverifiable' };
      continue;
    }
    if (response.status !== 200 || !Array.isArray(response.body)) return { state: 'unverifiable' };
    queries.push(response.body);
  }
  if (!queries.length || queries.every(body => body.length === 0)) return { state: 'confirmed-absent' };
  if (queries.length !== layers.length || queries.some(body => body.length !== 1)) return { state: 'unverifiable' };
  const stack = queries[0][0];
  if (!stack || !Number.isSafeInteger(stack.number) || stack.number < 1 || !Array.isArray(stack.pull_requests)) {
    return { state: 'unverifiable' };
  }
  const members = stack.pull_requests;
  const valid = members.every(pr => Number.isSafeInteger(pr.number) && pr.number > 0 &&
    typeof pr.draft === 'boolean' && typeof pr.state === 'string' && typeof pr.head?.ref === 'string');
  if (!valid || new Set(members.map(pr => pr.number)).size !== members.length ||
      queries.some(body => body[0]?.number !== stack.number ||
        JSON.stringify(body[0]?.pull_requests) !== JSON.stringify(members))) return { state: 'unverifiable' };
  const offset = members.findIndex(pr => pr.number === layers[0].pr);
  if (offset < 0 || layers.some((layer, i) => members[offset + i]?.number !== layer.pr ||
      members[offset + i]?.head.ref !== layer.head)) return { state: 'unverifiable' };
  return { state: 'confirmed', number: stack.number,
    additional_prs: members.filter((_, i) => i < offset || i >= offset + layers.length).map(pr => pr.number) };
}

function publicationOutcome({ mode, exitCode, observation, expected, actual }) {
  if (!['link', 'push', 'submit'].includes(mode) || !Number.isInteger(exitCode) ||
      !observation || !['confirmed', 'confirmed-absent', 'unverifiable'].includes(observation.state)) {
    return { outcome: 'unverifiable', fallback_allowed: false };
  }
  if (observation.state === 'unverifiable' ||
      (mode === 'link' && exitCode === 0 && observation.state === 'confirmed-absent')) {
    return { outcome: 'unverifiable', fallback_allowed: false };
  }
  if (observation.state === 'confirmed-absent') {
    return { outcome: exitCode === 0 && mode === 'push' ? 'pushed-without-stack' : 'published-without-stack',
      command_failed: exitCode !== 0, fallback_allowed: true, requery_before_fallback: true };
  }
  if (exitCode !== 0) return { outcome: 'failed-existing-stack', fallback_allowed: false };
  if (!Array.isArray(expected) || !Array.isArray(actual) || expected.length !== actual.length ||
      !expected.length || actual.some(row => !row || row.read_ok !== true)) {
    return { outcome: 'unverifiable', fallback_allowed: false };
  }
  const mismatches = expected.filter((row, i) => row.pr !== actual[i].pr ||
    Object.entries(row).some(([key, value]) => JSON.stringify(actual[i][key]) !== JSON.stringify(value)));
  return { outcome: mismatches.length ? 'partial' : 'complete', fallback_allowed: false,
    mismatched_prs: mismatches.map(row => row.pr) };
}

module.exports = { stackObservation, publicationOutcome };

// Planning uses collected observations, never treats their JSON as authority.
// The caller must collect them read-only again immediately before execution.
const crypto = require('node:crypto');
const { branchName, isProtected } = require('./git-policy');
const digest = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
function planStack(input) {
  const { mode, repository, remote, base, layers, policy, modifyState = false } = input;
  if (!['report', 'link', 'push', 'submit'].includes(mode) ||
      !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository || '') ||
      !/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(remote || '') || !branchName(base) ||
      !Array.isArray(layers) || layers.length < 2 || layers.length > 100 ||
      new Set(layers.map(layer => layer.head)).size !== layers.length || layers.some(layer => layer.head === base)) {
    throw new Error('Invalid explicit stack chain, base, repository or remote');
  }
  if (mode !== 'report' && modifyState !== false) throw new Error('Pending stack modification requires reconciliation');
  if (['push', 'submit'].includes(mode) && input.tracked !== true) throw new Error('Push/submit require an unambiguous tracked chain');
  const oid = value => typeof value === 'string' && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(value);
  const steps = layers.map((layer, index) => {
    if (!branchName(layer.head) || !oid(layer.local_oid) ||
        !(layer.remote_oid === null || oid(layer.remote_oid)) ||
        (layer.pr !== null && (!Number.isSafeInteger(layer.pr) || layer.pr < 1)) ||
        typeof layer.fast_forward !== 'boolean' || typeof layer.active !== 'boolean') throw new Error('Incomplete layer observation');
    if (!layer.active) return { head: layer.head, skipped: true, reason: 'merged-or-queued' };
    if (mode !== 'report' && isProtected(layer.head, policy)) throw new Error('Stack mutations cannot target a protected layer');
    if (mode === 'link' && !layer.fast_forward && layer.remote_oid !== null && layer.remote_oid !== layer.local_oid) {
      throw new Error('Link cannot force a non-fast-forward branch');
    }
    const baseBranch = index === 0 ? base : layers[index - 1].head;
    const push = layer.local_oid === layer.remote_oid ? null : ['git', 'push',
      `--force-with-lease=refs/heads/${layer.head}:${layer.remote_oid || ''}`, '--', remote,
      `${layer.local_oid}:refs/heads/${layer.head}`];
    return { head: layer.head, pr: layer.pr, base: baseBranch, local_oid: layer.local_oid,
      expected_remote_oid: layer.remote_oid, push_argv: push,
      overwrite: Boolean(push && layer.remote_oid && !layer.fast_forward),
      pr_effects: ['link', 'submit'].includes(mode) ? { draft: input.open !== true,
        disable_auto_merge: mode === 'submit', title: layer.title, body: layer.body } : null };
  });
  const subject = { schema_version: 1, mode, repository, remote, base, steps,
    transport: 'native-exact-lease', atomic: mode === 'link',
    effects: ['push/submit may partially publish', 'PR bases/readiness and auto-merge may change'],
    tracked_sha256: input.tracked_sha256 || null };
  return { ...subject, plan_sha256: digest(subject) };
}

function stackApiPlan(repository, numbers, existing = null) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository) || !Array.isArray(numbers) ||
      numbers.some(n => !Number.isSafeInteger(n) || n < 1) || new Set(numbers).size !== numbers.length ||
      numbers.length < (existing === null ? 2 : 1) ||
      (existing !== null && (!Number.isSafeInteger(existing) || existing < 1))) throw new Error('Invalid Stack API subject');
  const endpoint = `repos/${repository}/stacks` + (existing === null ? '' : `/${existing}/add`);
  return { argv: ['gh', 'api', '--method', 'POST', endpoint, '--input', '-'],
    stdin: JSON.stringify({ pull_requests: numbers }) };
}

module.exports.planStack = planStack;
module.exports.stackApiPlan = stackApiPlan;
