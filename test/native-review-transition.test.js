'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const state = require('../plugin/sd0x-dev-flow-codex/scripts/runtime/state');
const { setup } = require('../plugin/sd0x-dev-flow-codex/scripts/runtime/setup');
const { readProjectConfig } = require('../plugin/sd0x-dev-flow-codex/scripts/runtime/config');
const collaboration = require('../plugin/sd0x-dev-flow-codex/scripts/runtime/collaboration');
const { initRepository, git, commit, isolateGitEnvironment } = require('./helpers/git');

isolateGitEnvironment();

test('current review and verification entrypoints reject the retired provider without changing state', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-native-round-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  initRepository(root);
  fs.writeFileSync(path.join(root, 'app.js'), 'module.exports = 1;\n');
  git(root, ['add', '.']);
  commit(root, 'baseline');
  fs.writeFileSync(path.join(root, 'app.js'), 'module.exports = 2;\n');
  const initial = state.refreshState(root);
  const identity = {
    expected_fingerprint: initial.worktree.fingerprint,
    expected_runtime_epoch: initial.runtime_epoch,
    expected_provider: 'claude',
    round_id: 'retired-provider-round'
  };
  assert.throws(() => collaboration.requiredReviewers('claude'), /Codex provider/);
  assert.throws(() => state.recordCollaborationRoundStart(root, identity), /malformed/);
  assert.throws(() => state.recordCollaborationReview(root, {
    ...identity, expected_round_id: identity.round_id,
    transcript_path: '/unused', results: []
  }), /malformed/);
  assert.throws(() => state.recordCollaborationFailure(root, {
    ...identity, expected_round_id: identity.round_id
  }, {
    provider: 'claude', reviewers: 1, findings: 0, reviewer_failure: true
  }), /malformed/);
  assert.throws(() => state.recordVerification(root, 'fail', {
    runner: 'sd0x-deterministic-v1', commands: []
  }, initial.worktree.fingerprint, 'claude'), /starting review provider/);
  assert.deepEqual(state.readState(root), initial);

});

test('v9 retirement preserves sessions but invalidates gates, epochs and old reviewers', (t) => {
  for (const provider of ['codex', 'claude']) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-native-transition-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    initRepository(root);
    fs.writeFileSync(path.join(root, 'app.js'), 'module.exports = 1;\n');
    git(root, ['add', '.']);
    commit(root, 'baseline');
    fs.writeFileSync(path.join(root, 'app.js'), 'module.exports = 2;\n');
    const old = state.refreshState(root, { sessionId: 'existing-session' });
    old.schema_version = 9;
    old.review_provider = provider;
    old.review_agents.fingerprint = old.worktree.fingerprint;
    old.review_agents.started.push({
      agent_id: 'old-primary',
      agent_type: provider === 'codex' ? 'sd0x_codex_primary_reviewer' : 'sd0x_claude_primary_reviewer',
      recorded_at: new Date().toISOString()
    });
    fs.writeFileSync(state.resolveStatePath(root), JSON.stringify(old));
    const migrated = state.refreshState(root);
    assert.equal(migrated.schema_version, 10);
    assert.equal(migrated.review_provider, 'codex');
    assert.notEqual(migrated.runtime_epoch, old.runtime_epoch);
    assert.equal(migrated.sessions[0].session_id, 'existing-session');
    assert.equal(migrated.gates.review.status, 'pending');
    assert.equal(migrated.gates.verify.status, 'pending');
    assert.deepEqual(migrated.review_agents.started, []);
    state.recordSubagent(root, 'stop', {
      agent_id: 'old-primary', agent_type: 'sd0x_codex_primary_reviewer',
      last_assistant_message: 'No actionable findings remain.'
    });
    assert.deepEqual(state.readState(root).review_agents.completed, []);
    assert.equal(state.nextAction(state.readState(root)).action, 'review');
  }
});

test('legacy Claude config fails closed until setup migrates only managed artifacts', (t) => {
  for (const managed of [true, false]) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-native-setup-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    initRepository(root);
    const agents = path.join(root, '.codex', 'agents');
    fs.mkdirSync(agents, { recursive: true });
    const oldAgent = path.join(agents, 'sd0x-claude-primary-reviewer.toml');
    const bytes = managed ? '# Managed by sd0x-dev-flow-codex.\nold template\n' : '# user-owned reviewer\n';
    fs.writeFileSync(oldAgent, bytes);
    fs.writeFileSync(path.join(root, '.codex', 'sd0x-dev-flow.json'), JSON.stringify({
      enabled: true, review: { provider: 'claude', custom: 'keep' }, custom: 'keep'
    }));
    assert.throws(() => readProjectConfig(root), /Claude review is retired/);
    setup(root);
    const config = readProjectConfig(root);
    assert.equal(config.review.provider, 'codex');
    assert.equal(config.raw.review.custom, 'keep');
    assert.equal(config.raw.custom, 'keep');
    if (managed) assert.equal(fs.existsSync(oldAgent), false);
    else assert.equal(fs.readFileSync(oldAgent, 'utf8'), bytes);
    const primary = fs.readFileSync(path.join(agents, 'sd0x-codex-primary-reviewer.toml'), 'utf8');
    assert.doesNotMatch(primary, /^model(?:_reasoning_effort)?\s*=/m);
    assert.match(primary, /sandbox_mode = "read-only"/);
    assert.equal(state.recordExternalReview, undefined);
    assert.equal(state.recordExternalReviewStart, undefined);
  }
});
