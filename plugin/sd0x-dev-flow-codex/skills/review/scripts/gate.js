#!/usr/bin/env node
'use strict';

const { main } = require('../../../scripts/runtime/cli');
const {
  completeCollaborationReview,
  importCollaborationReview
} = require('../../../scripts/runtime/collaboration');
const {
  isCurrentPass,
  readState,
  recordCollaborationFailure,
  refreshState
} = require('../../../scripts/runtime/state');

function runReviewGate(status, args, cwd = process.cwd(), hooks = {}) {
  if (!['pass', 'fail'].includes(status)) return 2;
  const imported = status === 'pass'
    ? importCollaborationReview(cwd, { env: hooks.env })
    : { imported: false };
  const exitCode = main(['gate', 'review', status, ...args], cwd);
  if (status === 'pass' && exitCode === 0 && imported.imported) {
    try {
      if (typeof hooks.beforeRescan === 'function') hooks.beforeRescan(imported);
      importCollaborationReview(cwd, {
        env: hooks.env,
        expectedRoundId: imported.round_id,
        beforeRecord: hooks.beforeRescanRecord
      });
      if (!isCurrentPass(readState(cwd), 'review')) {
        throw new Error('late collaboration evidence revoked the review pass');
      }
      const completed = completeCollaborationReview(cwd, {
        expectedFingerprint: imported.fingerprint,
        expectedProvider: imported.provider,
        expectedRuntimeEpoch: imported.runtime_epoch,
        expectedRoundId: imported.round_id
      });
      if (!completed.completed ||
          !isCurrentPass(refreshState(cwd), 'review')) {
        throw new Error('collaboration marker completion did not preserve the pass');
      }
    } catch (error) {
      let failure = null;
      if (!/being updated concurrently/.test(error.message)) {
        const provider = imported.provider;
        failure = recordCollaborationFailure(cwd, {
          expected_fingerprint: imported.fingerprint,
          expected_provider: provider,
          expected_runtime_epoch: imported.runtime_epoch,
          expected_round_id: imported.round_id
        }, {
          provider,
          reviewers: 3,
          agents: [
            provider === 'claude'
              ? 'sd0x_claude_primary_reviewer'
              : 'sd0x_codex_primary_reviewer',
            'sd0x_reviewer',
            'sd0x_test_reviewer'
          ],
          findings: 1,
          summary: 'collaboration evidence changed before gate completion'
        });
      }
      if (failure?.reason === 'round-superseded') {
        return isCurrentPass(refreshState(cwd), 'review') ? exitCode : 1;
      }
      throw error;
    }
  }
  return exitCode;
}

if (require.main === module) {
  const [status, ...args] = process.argv.slice(2);
  if (!['pass', 'fail'].includes(status)) {
    process.stderr.write('Usage: gate.js <pass|fail> --evidence JSON\n');
    process.exitCode = 2;
  } else {
    try {
      process.exitCode = runReviewGate(status, args);
    } catch (error) {
      process.stderr.write(`sd0x review gate: ${error.message}\n`);
      process.exitCode = 1;
    }
  }
}

module.exports = { runReviewGate };
