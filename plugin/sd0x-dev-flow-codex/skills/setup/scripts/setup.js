#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { boundedInteger } = require('../../../scripts/runtime/config');
const { markSetupDeferral } = require('../../../scripts/runtime/state');
const { findRepoRoot } = require('../../../scripts/runtime/worktree');

const START = '<!-- sd0x-dev-flow-codex:start -->';
const END = '<!-- sd0x-dev-flow-codex:end -->';
const MANAGED_MARKER = '# Managed by sd0x-dev-flow-codex.';
const BLOCK = `${START}
## sd0x Dev Flow

- Treat the current worktree fingerprint as the unit of review and verification.
- Before completing code or configuration changes, run \`$sd0x-dev-flow-codex:review\`, then \`$sd0x-dev-flow-codex:verify\`.
- For documentation-only changes, review is required but deterministic verification is optional.
- After any fix, rerun review because the previous gate belongs to the previous fingerprint.
- Run the Claude MCP primary reviewer and the installed \`sd0x_reviewer\` and \`sd0x_test_reviewer\` agents in parallel; keep every perspective independent and read-only.
- Never claim a gate passed without recording evidence through the plugin runtime.
${END}`;

function updateManagedBlock(content) {
  const start = content.indexOf(START);
  const end = content.indexOf(END);
  if ((start >= 0) !== (end >= 0) || (start >= 0 && end < start)) {
    throw new Error('AGENTS.md contains an incomplete sd0x managed block');
  }
  if (start >= 0) {
    return `${content.slice(0, start)}${BLOCK}${content.slice(end + END.length)}`;
  }
  const prefix = content.trimEnd();
  return prefix ? `${prefix}\n\n${BLOCK}\n` : `${BLOCK}\n`;
}

function writeIfChanged(filePath, content) {
  const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null;
  if (existing === content) return 'unchanged';
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
  return existing === null ? 'created' : 'updated';
}

function installAgent(source, destination) {
  const content = fs.readFileSync(source, 'utf8');
  return writeIfChanged(destination, content);
}

function assertAgentOwnership(destination, desiredContent) {
  if (!fs.existsSync(destination)) return;
  const existing = fs.readFileSync(destination, 'utf8');
  if (existing !== desiredContent && !existing.startsWith(MANAGED_MARKER)) {
    throw new Error(`Refusing to replace unowned agent file: ${destination}`);
  }
}

function projectConfig(existing) {
  let current = {};
  if (existing) {
    try {
      current = JSON.parse(existing);
    } catch {
      throw new Error('Refusing to replace invalid .codex/sd0x-dev-flow.json');
    }
  }
  return `${JSON.stringify({
    ...current,
    schema_version: 1,
    enabled: true,
    limits: {
      max_rounds: boundedInteger(current.limits?.max_rounds, 8),
      max_continuations: boundedInteger(current.limits?.max_continuations, 8)
    }
  }, null, 2)}\n`;
}

function setup(cwd = process.cwd()) {
  const root = findRepoRoot(cwd);
  const pluginRoot = path.resolve(__dirname, '..', '..', '..');
  const agentsPath = path.join(root, 'AGENTS.md');
  const currentAgents = fs.existsSync(agentsPath)
    ? fs.readFileSync(agentsPath, 'utf8')
    : '';
  const desiredAgents = updateManagedBlock(currentAgents);

  const configPath = path.join(root, '.codex', 'sd0x-dev-flow.json');
  const existingConfig = fs.existsSync(configPath)
    ? fs.readFileSync(configPath, 'utf8')
    : '';
  const desiredConfig = projectConfig(existingConfig);
  const agentPlans = ['sd0x-reviewer.toml', 'sd0x-test-reviewer.toml'].map((name) => ({
    source: path.join(pluginRoot, 'templates', 'agents', name),
    destination: path.join(root, '.codex', 'agents', name)
  }));
  for (const plan of agentPlans) {
    assertAgentOwnership(plan.destination, fs.readFileSync(plan.source, 'utf8'));
  }

  const results = [{
    file: agentsPath,
    status: writeIfChanged(agentsPath, desiredAgents)
  }, {
    file: configPath,
    status: writeIfChanged(configPath, desiredConfig)
  }];

  for (const plan of agentPlans) {
    results.push({
      file: plan.destination,
      status: installAgent(plan.source, plan.destination)
    });
  }

  const activationFiles = new Set([
    configPath,
    ...agentPlans.map((plan) => plan.destination)
  ]);
  const activationDeferred = results.some((item) =>
    activationFiles.has(item.file) && item.status !== 'unchanged'
  );
  const claimToken = activationDeferred ? markSetupDeferral(root) : null;

  return {
    root,
    results,
    activation_deferred: activationDeferred,
    setup_claim: claimToken ? {
      schema_version: 1,
      token: claimToken,
      root
    } : null
  };
}

if (require.main === module) {
  try {
    process.stdout.write(`${JSON.stringify(setup(), null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`sd0x setup: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  BLOCK,
  END,
  START,
  assertAgentOwnership,
  projectConfig,
  setup,
  updateManagedBlock
};
