'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

const REQUIRED_JOBS = Object.freeze(['Node 24 LTS', 'Exhaustive migration replay', 'Native Windows bound-tree']);

function validateRun(run, repository, sha, id) {
  assert(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository), 'Invalid release repository');
  assert(/^[a-f0-9]{40}$/.test(sha), 'Invalid release commit');
  assert(Number.isSafeInteger(id) && id > 0 && run?.id === id, 'CI run identity mismatch');
  assert(run.path === '.github/workflows/ci.yml', 'Unexpected CI workflow');
  assert(run.repository?.full_name === repository && run.head_repository?.full_name === repository, 'CI repository mismatch');
  assert(run.event === 'push' && run.head_branch === 'main', 'CI must originate from a main push');
  assert(run.head_sha === sha, 'CI commit mismatch');
  assert(run.status === 'completed' && run.conclusion === 'success', 'CI is not successfully completed');
  assert(Number.isSafeInteger(run.run_attempt) && run.run_attempt > 0, 'Invalid CI attempt');
}

function verifyCi({ event, repository, sha, readApi }) {
  const trigger = event.workflow_run;
  // Validate the trigger before deriving any API path. Re-query authoritative
  // run and attempt-specific jobs; a success label alone is insufficient.
  validateRun(trigger, repository, sha, trigger?.id);
  const endpoint = `repos/${repository}/actions/runs/${trigger.id}`;
  const run = readApi(endpoint);
  validateRun(run, repository, sha, trigger.id);
  assert.equal(run.run_attempt, trigger.run_attempt, 'CI attempt changed after the trigger');
  const pages = readApi(`${endpoint}/attempts/${run.run_attempt}/jobs?per_page=100`, true);
  assert(Array.isArray(pages) && pages.length > 0 && pages.every(page => Array.isArray(page.jobs)), 'Incomplete CI job response');
  const jobs = pages.flatMap(page => page.jobs);
  for (const name of REQUIRED_JOBS) {
    const matches = jobs.filter(job => job.name === name);
    assert.equal(matches.length, 1, `Missing or ambiguous required CI job: ${name}`);
    const job = matches[0];
    assert(job.run_id === run.id && job.run_attempt === run.run_attempt && job.head_sha === sha, `CI job subject mismatch: ${name}`);
    assert(job.status === 'completed' && job.conclusion === 'success', `Required CI job did not pass: ${name}`);
  }
  const final = readApi(endpoint);
  validateRun(final, repository, sha, trigger.id);
  assert.equal(final.run_attempt, run.run_attempt, 'CI attempt changed during validation');
  return { sha, run_id: run.id, run_attempt: run.run_attempt, jobs: REQUIRED_JOBS };
}

function main() {
  assert.equal(process.env.GITHUB_EVENT_NAME, 'workflow_run', 'CI reuse requires a workflow_run event');
  const sha = process.env.RELEASE_SHA;
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  assert.equal(head, sha, 'Checked-out commit differs from release subject');
  const result = verifyCi({
    event: JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')),
    repository: process.env.GITHUB_REPOSITORY, sha,
    readApi(endpoint, paginate = false) {
      return JSON.parse(execFileSync('gh', ['api', ...(paginate ? ['--paginate', '--slurp'] : []), endpoint], {
        encoding: 'utf8', timeout: 60_000, maxBuffer: 8 * 1024 * 1024
      }));
    }
  });
  console.log(JSON.stringify(result));
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(`Release CI validation failed: ${error.message}`); process.exitCode = 1; }
}
module.exports = { REQUIRED_JOBS, validateRun, verifyCi };
