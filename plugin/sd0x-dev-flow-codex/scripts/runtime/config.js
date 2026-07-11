'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { findRepoRoot } = require('./worktree');

const CONFIG_RELATIVE_PATH = path.join('.codex', 'sd0x-dev-flow.json');
const DEFAULT_REVIEW_PROVIDER = 'codex';
const REVIEW_PROVIDERS = new Set(['codex', 'claude']);

function normalizeReviewProvider(value) {
  const provider = value?.review?.provider ?? DEFAULT_REVIEW_PROVIDER;
  if (!REVIEW_PROVIDERS.has(provider)) {
    throw new Error(
      'review.provider must be either "codex" or "claude"'
    );
  }
  return provider;
}

function configPath(cwd = process.cwd()) {
  return path.join(findRepoRoot(cwd), CONFIG_RELATIVE_PATH);
}

function readProjectConfig(cwd = process.cwd()) {
  const filePath = configPath(cwd);
  let source;
  try {
    source = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return {
      schema_version: 1,
      enabled: false,
      review: {
        provider: DEFAULT_REVIEW_PROVIDER
      },
      raw: null,
      path: filePath
    };
  }
  let value;
  try {
    value = JSON.parse(source);
  } catch {
    throw new Error(`Invalid JSON in ${CONFIG_RELATIVE_PATH}`);
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${CONFIG_RELATIVE_PATH} must contain a JSON object`);
  }
  return {
    schema_version: 1,
    enabled: value.enabled === true,
    review: {
      provider: normalizeReviewProvider(value)
    },
    raw: value,
    path: filePath
  };
}

function isProjectEnabled(cwd = process.cwd()) {
  return readProjectConfig(cwd).enabled;
}

function reviewProvider(cwd = process.cwd()) {
  return readProjectConfig(cwd).review.provider;
}

module.exports = {
  CONFIG_RELATIVE_PATH,
  DEFAULT_REVIEW_PROVIDER,
  REVIEW_PROVIDERS,
  configPath,
  isProjectEnabled,
  normalizeReviewProvider,
  reviewProvider,
  readProjectConfig
};
