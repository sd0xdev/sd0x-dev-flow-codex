'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { REQUIRED_JOBS, verifyCi } = require('../scripts/release-ci');

function fixture() {
  const repository = 'owner/project', sha = 'a'.repeat(40);
  const run = { id: 123, path: '.github/workflows/ci.yml', repository: { full_name: repository },
    head_repository: { full_name: repository }, event: 'push', head_branch: 'main', head_sha: sha,
    status: 'completed', conclusion: 'success', run_attempt: 2 };
  const jobs = REQUIRED_JOBS.map(name => ({ name, run_id: 123, run_attempt: 2, head_sha: sha,
    status: 'completed', conclusion: 'success' }));
  const event = { workflow_run: structuredClone(run) };
  const calls = [];
  return { repository, sha, run, jobs, event, calls,
    options() {
      return { repository, sha, event, readApi(endpoint, paginate) {
        calls.push(endpoint);
        if (paginate) return [{ jobs: jobs.slice(0, 1) }, { jobs: jobs.slice(1) }];
        return structuredClone(run);
      } };
    } };
}

test('release reuses only exact-commit successful CI with every required job across pages', () => {
  const f = fixture();
  assert.deepEqual(verifyCi(f.options()), { sha: f.sha, run_id: 123, run_attempt: 2, jobs: REQUIRED_JOBS });
  assert.deepEqual(f.calls, ['repos/owner/project/actions/runs/123',
    'repos/owner/project/actions/runs/123/attempts/2/jobs?per_page=100',
    'repos/owner/project/actions/runs/123']);
});

test('untrusted, wrong-version and unsuccessful triggers cannot start CI reuse', () => {
  for (const change of [
    { event: 'pull_request' }, { head_branch: 'feature' }, { head_sha: 'b'.repeat(40) },
    { repository: { full_name: 'other/project' } }, { head_repository: { full_name: 'fork/project' } },
    { path: '.github/workflows/other.yml' }, { status: 'in_progress' },
    { conclusion: 'failure' }, { conclusion: 'cancelled' }, { conclusion: 'skipped' },
    { id: '../jobs' }, { run_attempt: 0 }
  ]) {
    const f = fixture(); Object.assign(f.event.workflow_run, change);
    assert.throws(() => verifyCi(f.options()));
    assert.equal(f.calls.length, 0, JSON.stringify(change));
  }
});

test('success on another commit, repository, workflow or rerun cannot replace the trigger', () => {
  for (const change of [{ head_sha: 'b'.repeat(40) }, { id: 456 }, { run_attempt: 3 },
    { path: '.github/workflows/other.yml' }, { head_repository: { full_name: 'fork/project' } },
    { event: 'pull_request' }, { conclusion: 'failure' }]) {
    const f = fixture(); Object.assign(f.run, change);
    assert.throws(() => verifyCi(f.options()));
  }
});

test('every required job must be unique, successful and bound to the exact run attempt', () => {
  for (let i = 0; i < REQUIRED_JOBS.length; i++) {
    for (const kind of ['missing', 'duplicate', 'failed', 'skipped', 'running', 'commit', 'run', 'attempt']) {
      const f = fixture();
      if (kind === 'missing') f.jobs.splice(i, 1);
      if (kind === 'duplicate') f.jobs.push(structuredClone(f.jobs[i]));
      if (kind === 'failed') f.jobs[i].conclusion = 'failure';
      if (kind === 'skipped') f.jobs[i].conclusion = 'skipped';
      if (kind === 'running') f.jobs[i].status = 'in_progress';
      if (kind === 'commit') f.jobs[i].head_sha = 'b'.repeat(40);
      if (kind === 'run') f.jobs[i].run_id = 456;
      if (kind === 'attempt') f.jobs[i].run_attempt = 1;
      assert.throws(() => verifyCi(f.options()), undefined, REQUIRED_JOBS[i] + ': ' + kind);
    }
  }
});

test('unavailable or incomplete API reads and a rerun during observation fail closed', () => {
  const f = fixture();
  for (const response of [null, {}, [], [{ jobs: null }], [{ jobs: [] }]]) {
    const base = f.options();
    assert.throws(() => verifyCi({ ...base, readApi: (endpoint, paginate) => paginate ? response : f.run }));
  }
  assert.throws(() => verifyCi({ ...f.options(), readApi() { throw new Error('API unavailable'); } }), /unavailable/);
  let reads = 0; const base = f.options();
  assert.throws(() => verifyCi({ ...base, readApi(endpoint, paginate) {
    const value = base.readApi(endpoint, paginate);
    if (!paginate && ++reads === 2) value.run_attempt++;
    return value;
  } }), /attempt changed/);
});
