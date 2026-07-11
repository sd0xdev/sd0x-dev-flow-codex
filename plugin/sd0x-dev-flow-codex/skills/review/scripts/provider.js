#!/usr/bin/env node
'use strict';

const { readProjectConfig } = require('../../../scripts/runtime/config');
const { DEFAULT_REVIEW_MODEL } = require('../../../scripts/mcp/server');

function reviewPlan(cwd = process.cwd()) {
  const config = readProjectConfig(cwd);
  const provider = config.review.provider;
  const primaryAgent = provider === 'claude'
    ? 'sd0x_claude_primary_reviewer'
    : 'sd0x_codex_primary_reviewer';
  const agents = [primaryAgent, 'sd0x_reviewer', 'sd0x_test_reviewer'];
  if (provider === 'claude') agents.push('claude_mcp_primary');
  return {
    provider,
    primary_agent: primaryAgent,
    reviewers: 3,
    agents,
    codex: {
      model: 'gpt-5.6-sol',
      reasoning_effort: 'xhigh'
    },
    claude: {
      model: process.env.SD0X_CLAUDE_REVIEW_MODEL || DEFAULT_REVIEW_MODEL,
      enabled: provider === 'claude'
    }
  };
}

if (require.main === module) {
  process.stdout.write(`${JSON.stringify(reviewPlan(), null, 2)}\n`);
}

module.exports = { reviewPlan };
