'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const policy = require('../plugin/sd0x-dev-flow-codex/scripts/runtime/git-policy');
const deploy = require('../plugin/sd0x-dev-flow-codex/scripts/runtime/deployment');
const stack = require('../plugin/sd0x-dev-flow-codex/scripts/runtime/stack');
const gates = { fingerprint: 'abc', review: 'pass', verify: 'pass', requires_verify: true, next_action: 'complete' };

function fixture(t, config = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-v5-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const env = { ...deploy.environment(), GIT_CONFIG_GLOBAL: os.devNull, GIT_CONFIG_NOSYSTEM: '1' };
  const git = (...args) => execFileSync('git', ['-C', root, ...args], { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init', '-b', 'main');
  git('config', 'user.name', 'Fixture'); git('config', 'user.email', 'fixture@example.test');
  git('config', 'commit.gpgSign', 'false');
  fs.mkdirSync(path.join(root, '.codex'));
  fs.writeFileSync(path.join(root, '.codex/sd0x-git.json'), JSON.stringify(config));
  fs.writeFileSync(path.join(root, 'data'), 'base');
  git('add', '.'); git('commit', '-m', 'fixture');
  return { root, git };
}

test('protected branches are additive and invalid settings fail closed', () => {
  const p = policy.parsePolicy({ protected_branches: ['production', 'hotfix/*'] });
  for (const name of ['main', 'master', 'develop', 'release/1', 'hotfix/a/b', 'production']) assert.equal(policy.isProtected(name, p), true);
  for (const name of ['feat/main-menu', 'release-notes', 'hotfix']) assert.equal(policy.isProtected(name, p), false);
  for (const bad of [{ protected_branches: ['!main'] }, { protected_branches: null },
    { offer_mode: null }, { run_steps: 'yes' }, { anchors: [] }, { deploy: [{ kind: 'run', path: '../x' }] }]) {
    assert.throws(() => policy.parsePolicy(bad));
  }
});

test('offer respects protected/detached branches, exact gates and declined fingerprint', () => {
  const args = { policy: policy.parsePolicy(), branch: 'feature', fingerprint: 'abc', gates };
  assert.deepEqual(policy.offerDecision(args), ['commit', 'commit-and-push', 'not-now']);
  assert.deepEqual(policy.offerDecision({ ...args, branch: 'main' }), ['commit', 'not-now']);
  for (const change of [{ branch: null }, { declinedFingerprint: 'abc' }, { fingerprint: 'other' },
    { prohibited: true }, { gates: { ...gates, verify: 'pending' } }]) assert.deepEqual(policy.offerDecision({ ...args, ...change }), []);
});

test('goal commit requires explicit user grant, live scope and protected-branch permission', () => {
  const args = { policy: policy.parsePolicy(), root: '/repo', branch: 'feat/x', fingerprint: 'abc', gates, now: 10,
    goal: { id: 'g', root: '/repo', branch: 'feat/x', origin: 'user', status: 'active', commit_authorized: true, expires_at: 20 } };
  assert.equal(policy.goalCommitEligible(args), true);
  for (const change of [{ origin: 'model' }, { commit_authorized: false }, { expires_at: 10 },
    { root: '/other' }, { status: 'complete' }]) assert.equal(policy.goalCommitEligible({ ...args, goal: { ...args.goal, ...change } }), false);
  const protectedArgs = { ...args, branch: 'main', goal: { ...args.goal, branch: 'main' } };
  assert.equal(policy.goalCommitEligible(protectedArgs), false);
  assert.equal(policy.goalCommitEligible({ ...protectedArgs, goal: { ...protectedArgs.goal, protected_branch_authorized: true } }), true);
});

test('selected unreadable/malformed policy cannot fall back to defaults', t => {
  const { root } = fixture(t);
  const file = path.join(root, '.codex/sd0x-git.json');
  fs.writeFileSync(file, '{'); assert.throws(() => policy.readPolicy(root));
  fs.writeFileSync(file, '{}'); fs.chmodSync(file, 0); assert.throws(() => policy.readPolicy(root), /unreadable/);
  fs.chmodSync(file, 0o644); fs.unlinkSync(file); fs.symlinkSync('missing', file);
  assert.throws(() => policy.readPolicy(root), /regular/);
});

test('deploy merge binds OIDs and verifies exact merge parents/message', t => {
  const { root, git } = fixture(t, { deploy: [{ kind: 'merge', source: 'feature', target: 'main' }] });
  git('switch', '-c', 'feature'); fs.writeFileSync(path.join(root, 'new'), 'feature'); git('add', '.'); git('commit', '-m', 'feature'); git('switch', 'main');
  const plan = deploy.planStep(root, 0);
  assert.throws(() => deploy.executeStep(root, plan, null), /authorization/);
  const result = deploy.executeStep(root, plan, { plan_sha256: plan.plan_sha256 });
  assert.equal(result.outcome, 'complete');
  assert.equal(git('show', '-s', '--format=%P', 'HEAD'), `${plan.target_oid} ${plan.source_oid}`);
  assert.equal(git('show', '-s', '--format=%B', 'HEAD'), plan.message);
  assert.throws(() => deploy.planStep(root, 0), /already merged/);
});

test('deploy refuses source drift before switching or merging', t => {
  const { root, git } = fixture(t, { deploy: [{ kind: 'merge', source: 'feature', target: 'main', form: 'ff-only' }] });
  git('switch', '-c', 'feature'); fs.writeFileSync(path.join(root, 'new'), 'one'); git('add', '.'); git('commit', '-m', 'one'); git('switch', 'main');
  const plan = deploy.planStep(root, 0), before = git('rev-parse', 'HEAD');
  git('switch', 'feature'); fs.writeFileSync(path.join(root, 'new'), 'two'); git('add', '.'); git('commit', '-m', 'two'); git('switch', 'main');
  assert.throws(() => deploy.executeStep(root, plan, { plan_sha256: plan.plan_sha256 }), /drift/);
  assert.equal(git('rev-parse', 'HEAD'), before);
});

test('run mode defaults to print; failed step prevents all later execution', async t => {
  const steps = [{ kind: 'run', path: 'run.sh', args: ['literal; argument'] }, { kind: 'run', path: 'later.sh', args: [] }];
  const { root, git } = fixture(t, { deploy: steps });
  fs.writeFileSync(path.join(root, 'run.sh'), '#!/bin/sh\nexit 7\n', { mode: 0o755 });
  fs.writeFileSync(path.join(root, 'later.sh'), '#!/bin/sh\ntouch later-ran\n', { mode: 0o755 });
  git('add', '.'); git('commit', '-m', 'scripts');
  let approvals = 0;
  const authorize = plan => { approvals++; return { plan_sha256: plan.plan_sha256 }; };
  const printed = await deploy.runFlow(root, { authorize });
  assert.equal(approvals, 0); assert.equal(printed.results.length, 2); assert.equal(printed.results[0].outcome, 'printed');
  fs.writeFileSync(path.join(root, '.codex/sd0x-git.json'), JSON.stringify({ deploy: steps, run_steps: 'execute' }));
  git('add', '.'); git('commit', '-m', 'execute policy');
  const result = await deploy.runFlow(root, { authorize });
  assert.equal(result.outcome, 'stopped'); assert.equal(result.stopped_at, 0); assert.equal(approvals, 1);
  assert.equal(result.results[0].exit_code, 7); assert.equal(fs.existsSync(path.join(root, 'later-ran')), false);
});

test('stack readback distinguishes absence, unavailable API, partial and complete', () => {
  const layers = [{ head: 'a', pr: 1 }, { head: 'b', pr: 2 }];
  const body = [{ number: 3, pull_requests: layers.map(l => ({ number: l.pr, head: { ref: l.head }, draft: true, state: 'open' })) }];
  const responses = layers.map(() => ({ pr_lookup_complete: true, status: 200, body }));
  const observation = stack.stackObservation(layers, responses);
  assert.equal(observation.state, 'confirmed');
  assert.equal(stack.stackObservation(layers, responses.map(r => ({ ...r, status: 404 }))).state, 'unverifiable');
  assert.equal(stack.stackObservation(layers, responses.map(r => ({ ...r, body: [] }))).state, 'confirmed-absent');
  const input = { mode: 'link', exitCode: 0, observation, expected: [{ pr: 1, base: 'main', draft: false }],
    actual: [{ pr: 1, base: 'main', draft: true, read_ok: true }] };
  assert.equal(stack.publicationOutcome(input).outcome, 'partial');
  assert.equal(stack.publicationOutcome(input).fallback_allowed, false);
  assert.equal(stack.publicationOutcome({ ...input, actual: [{ ...input.actual[0], draft: false }] }).outcome, 'complete');
  assert.equal(stack.publicationOutcome({ ...input, observation: { state: 'confirmed-absent' } }).outcome, 'unverifiable');
  assert.equal(stack.publicationOutcome({ ...input, exitCode: 1 }).outcome, 'failed-existing-stack');
});

test('stack plan pins each lease and head, preserves base and rejects destructive ambiguity', () => {
  const input = { mode: 'push', repository: 'org/repo', remote: 'origin', base: 'trunk', tracked: true,
    policy: policy.parsePolicy(), layers: ['one', 'two'].map((head, i) => ({ head,
      local_oid: String(i + 1).repeat(40), remote_oid: 'a'.repeat(40), fast_forward: false, pr: i + 1, active: true })) };
  const result = stack.planStack(input);
  assert.equal(result.base, 'trunk'); assert.equal(result.steps[1].base, 'one');
  assert.equal(result.steps[0].push_argv[2], '--force-with-lease=refs/heads/one:' + 'a'.repeat(40));
  assert.equal(result.steps[0].push_argv.at(-1), '1'.repeat(40) + ':refs/heads/one');
  assert.throws(() => stack.planStack({ ...input, modifyState: true }), /reconciliation/);
  assert.throws(() => stack.planStack({ ...input, mode: 'link' }), /cannot force/);
  assert.throws(() => stack.planStack({ ...input, tracked: false }), /tracked/);
  assert.throws(() => stack.planStack({ ...input, layers: [{ ...input.layers[0], head: 'main' }, input.layers[1]] }), /protected/);
  assert.deepEqual(stack.stackApiPlan('org/repo', [1, 2]), {
    argv: ['gh', 'api', '--method', 'POST', 'repos/org/repo/stacks', '--input', '-'], stdin: '{"pull_requests":[1,2]}' });
  assert.throws(() => stack.stackApiPlan('org/repo', [1, 1]));
});

test('policy scaffold preserves existing user settings and rejects symlink ownership', t => {
  const { root } = fixture(t, { offer_mode: 'off', protected_branches: ['production'] });
  const file = path.join(root, '.codex/sd0x-git.json'), before = fs.readFileSync(file);
  assert.equal(policy.scaffoldPolicy(root).created, false);
  assert.deepEqual(fs.readFileSync(file), before);
  fs.unlinkSync(file); assert.equal(policy.scaffoldPolicy(root).created, true);
  assert.equal(policy.readPolicy(root).policy.run_steps, 'print');
  fs.unlinkSync(file); fs.symlinkSync('missing', file);
  assert.throws(() => policy.scaffoldPolicy(root), /regular/);
});

test('merge conflict aborts only the initiated merge and leaves both branch tips intact', t => {
  const { root, git } = fixture(t, { deploy: [{ kind: 'merge', source: 'feature', target: 'main' }] });
  git('switch', '-c', 'feature'); fs.writeFileSync(path.join(root, 'data'), 'feature'); git('add', '.'); git('commit', '-m', 'feature');
  git('switch', 'main'); fs.writeFileSync(path.join(root, 'data'), 'main'); git('add', '.'); git('commit', '-m', 'main');
  const plan = deploy.planStep(root, 0);
  const result = deploy.executeStep(root, plan, { plan_sha256: plan.plan_sha256 });
  assert.equal(result.outcome, 'failed'); assert.equal(result.conflict_aborted, true);
  assert.equal(git('rev-parse', 'main'), plan.target_oid); assert.equal(git('rev-parse', 'feature'), plan.source_oid);
  assert.equal(git('status', '--porcelain'), '');
});

test('declaration change on target branch prevents merge after checkout', t => {
  const { root, git } = fixture(t, { deploy: [{ kind: 'merge', source: 'feature', target: 'main' }] });
  git('switch', '-c', 'feature');
  fs.writeFileSync(path.join(root, '.codex/sd0x-git.json'), JSON.stringify({ offer_mode: 'off', deploy: [{ kind: 'merge', source: 'feature', target: 'main' }] }));
  git('add', '.'); git('commit', '-m', 'different declaration');
  const plan = deploy.planStep(root, 0);
  assert.throws(() => deploy.executeStep(root, plan, { plan_sha256: plan.plan_sha256 }), /after switch/);
  assert.equal(git('rev-parse', 'main'), plan.target_oid);
});

test('ADR plans use owning resolver and number across archived records without rewriting history', t => {
  const { planAdr } = require('../plugin/sd0x-dev-flow-codex/scripts/runtime/adr');
  const { root } = fixture(t);
  const directory = path.join(root, 'docs/features/payments');
  fs.mkdirSync(path.join(directory, 'archived'), { recursive: true });
  fs.writeFileSync(path.join(directory, 'adr-001-original.md'), '# Original\nStatus: Accepted\n');
  const archived = path.join(directory, 'archived/ADR-009-older.md');
  fs.writeFileSync(archived, '# Older\nStatus: Accepted\n');
  const before = fs.readFileSync(archived);
  const plan = planAdr(root, { feature: 'payments', title: 'new-boundary', supersedes: 9 });
  assert.equal(plan.destination, 'docs/features/payments/adr-010-new-boundary.md');
  assert.deepEqual(plan.links, { from_new: 'archived/ADR-009-older.md', from_old: '../adr-010-new-boundary.md' });
  assert.deepEqual(fs.readFileSync(archived), before);
  assert.equal(fs.existsSync(path.join(root, plan.destination)), false);
  assert.throws(() => planAdr(root, { feature: '../outside', title: 'no' }));
  assert.throws(() => planAdr(root, { feature: 'payments', title: 'no', supersedes: 8 }), /does not exist/);
  fs.writeFileSync(path.join(directory, 'adr-009-duplicate.md'), 'duplicate');
  assert.throws(() => planAdr(root, { feature: 'payments', title: 'no' }), /duplicate/);
});

test('real multi-layer publication preserves approved leases after a partial remote update', t => {
  const { root, git } = fixture(t);
  const remote = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-stack-remote-'));
  t.after(() => fs.rmSync(remote, { recursive: true, force: true }));
  execFileSync('git', ['init', '--bare', remote], { stdio: 'ignore' });
  git('remote', 'add', 'origin', remote);
  const base = git('rev-parse', 'HEAD');
  git('branch', 'one'); git('branch', 'two'); git('push', 'origin', 'one', 'two');
  git('switch', 'one'); fs.writeFileSync(path.join(root, 'new'), 'one'); git('add', '.'); git('commit', '-m', 'one');
  const one = git('rev-parse', 'HEAD');
  git('switch', 'two'); fs.writeFileSync(path.join(root, 'second'), 'two'); git('add', '.'); git('commit', '-m', 'two');
  const two = git('rev-parse', 'HEAD');
  const plan = stack.planStack({ mode: 'push', repository: 'org/repo', remote: 'origin', base: 'main', tracked: true,
    policy: policy.parsePolicy(), layers: [{ head: 'one', local_oid: one }, { head: 'two', local_oid: two }]
      .map((layer, i) => ({ ...layer, remote_oid: base, pr: i + 1, fast_forward: true, active: true })) });
  git(...plan.steps[0].push_argv.slice(1));
  // Another actor changes only layer two after the plan; no implicit fetch may
  // replace its approved lease, even though the new object exists locally.
  git('push', 'origin', `${one}:refs/heads/two`);
  assert.throws(() => git(...plan.steps[1].push_argv.slice(1)));
  const refs = git('ls-remote', '--heads', 'origin');
  assert.ok(refs.includes(`${one}\trefs/heads/one`));
  assert.ok(refs.includes(`${one}\trefs/heads/two`));
  assert.ok(!refs.includes(`${two}\trefs/heads/two`));
  assert.equal(stack.publicationOutcome({ mode: 'push', exitCode: 1, observation: { state: 'confirmed' } }).fallback_allowed, false);
});

test('attribution accepts ordinary names but rejects hyphenated tags and redacts removed lines', () => {
  const { assertClean, sanitizePr } = require('../plugin/sd0x-dev-flow-codex/scripts/runtime/attribution');
  assert.equal(assertClean('Fix OpenAI API adapter for maintainers\nCo-Authored-By: Human <human@example.test>'), true);
  for (const name of ['Claude', 'Anthropic', 'AI', 'GPT', 'OpenAI', 'Copilot', 'Codex', 'Gemini']) {
    assert.throws(() => assertClean('Generated-by: ' + name));
  }
  const result = sanitizePr({ title: 'Fix API adapter', body: 'Summary\nGenerated-by: Codex secret-value\nTests pass' });
  assert.equal(result.body, 'Summary\nTests pass'); assert.equal(result.removed_count, 1);
  assert.ok(!JSON.stringify(result).includes('secret-value'));
  assert.throws(() => sanitizePr({ title: 'Generated-by: Codex', body: 'kept' }));
});

test('remote mapping refuses negative, non-invertible and multiple owners', () => {
  const { remoteMapping } = require('../plugin/sd0x-dev-flow-codex/scripts/runtime/git-refs');
  const remote = { name: 'origin', fetch: ['+refs/heads/*:refs/remotes/origin/*'] };
  assert.deepEqual(remoteMapping('refs/remotes/origin/topic', [remote]), { remote: 'origin', source: 'refs/heads/topic', destination: 'refs/remotes/origin/topic' });
  assert.throws(() => remoteMapping('refs/remotes/origin/topic', [{ ...remote, fetch: [...remote.fetch, '^refs/heads/topic'] }]), /negative/);
  assert.throws(() => remoteMapping('refs/remotes/origin/topic', [remote, { ...remote, name: 'other' }]), /unambiguous/);
  assert.throws(() => remoteMapping('refs/remotes/origin/topic', [{ ...remote, fetch: ['refs/heads/main:refs/remotes/origin/*'] }]), /invertible/);
});

test('equivalent fetch mappings deduplicate and excluded owners do not hide a valid one', () => {
  const {remoteMapping}=require('../plugin/sd0x-dev-flow-codex/scripts/runtime/git-refs');
  const valid={name:'origin',fetch:['refs/heads/*:refs/remotes/origin/*','refs/heads/main:refs/remotes/origin/main']};
  const excluded={name:'other',fetch:['refs/heads/*:refs/remotes/origin/*','^refs/heads/main']};
  assert.equal(remoteMapping('refs/remotes/origin/main',[excluded,valid]).remote,'origin');
});
