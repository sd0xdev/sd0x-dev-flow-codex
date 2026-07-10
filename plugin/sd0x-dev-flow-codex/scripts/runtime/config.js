'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { findRepoRoot } = require('./worktree');

const CONFIG_RELATIVE_PATH = path.join('.codex', 'sd0x-dev-flow.json');

function boundedInteger(value, fallback) {
  return Number.isInteger(value) && value >= 1 && value <= 100
    ? value
    : fallback;
}

function configPath(cwd = process.cwd()) {
  return path.join(findRepoRoot(cwd), CONFIG_RELATIVE_PATH);
}

function readProjectConfig(cwd = process.cwd()) {
  const filePath = configPath(cwd);
  try {
    const value = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return {
      schema_version: 1,
      enabled: value.enabled === true,
      limits: {
        max_rounds: boundedInteger(value.limits?.max_rounds, 8),
        max_continuations: boundedInteger(value.limits?.max_continuations, 8)
      },
      raw: value,
      path: filePath
    };
  } catch {
    return {
      schema_version: 1,
      enabled: false,
      limits: { max_rounds: 8, max_continuations: 8 },
      raw: null,
      path: filePath
    };
  }
}

function isProjectEnabled(cwd = process.cwd()) {
  return readProjectConfig(cwd).enabled;
}

module.exports = {
  CONFIG_RELATIVE_PATH,
  boundedInteger,
  configPath,
  isProjectEnabled,
  readProjectConfig
};
