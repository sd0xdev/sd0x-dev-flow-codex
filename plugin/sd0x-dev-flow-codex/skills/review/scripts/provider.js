'use strict';

const { readProjectConfig } = require('../../../scripts/runtime/config');

function reviewPlan(cwd = process.cwd()) {
  const config = readProjectConfig(cwd);
  return {
    provider: config.review.provider,
    primary_agent: 'sd0x_codex_primary_reviewer',
    reviewers: 1,
    agents: ['sd0x_codex_primary_reviewer'],
    codex: {
      model: null,
      reasoning_effort: null,
      settings_source: 'parent-session',
      sandbox_mode: 'read-only'
    }
  };
}

if (require.main === module) {
  process.stdout.write(JSON.stringify(reviewPlan(), null, 2) + '\n');
}

module.exports = { reviewPlan };
