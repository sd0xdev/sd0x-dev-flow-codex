'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  DEFAULT_REVIEW_PROVIDER,
  normalizeReviewProvider
} = require('./config');
const {
  END,
  MANAGED_BLOCK: BLOCK,
  START
} = require('./workflow-contract');
const { markSetupDeferral } = require('./state');
const { findRepoRoot } = require('./worktree');

const MANAGED_MARKER = '# Managed by sd0x-dev-flow-codex.';

function updateManagedBlock(content) {
  const startCount = content.split(START).length - 1;
  const endCount = content.split(END).length - 1;
  if (!((startCount === 0 && endCount === 0) ||
      (startCount === 1 && endCount === 1))) {
    throw new Error('AGENTS.md contains malformed sd0x managed block markers');
  }
  const start = content.indexOf(START);
  const end = content.indexOf(END);
  if ((start >= 0) !== (end >= 0) || (start >= 0 && end < start)) {
    throw new Error('AGENTS.md contains an incomplete sd0x managed block');
  }
  if (start >= 0) {
    return `${content.slice(0, start)}${BLOCK}${content.slice(end + END.length)}`;
  }
  if (content.length === 0) return `${BLOCK}\n`;
  const separator = content.endsWith('\n\n')
    ? ''
    : content.endsWith('\n') ? '\n' : '\n\n';
  return `${content}${separator}${BLOCK}\n`;
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

function removeRetiredManagedAgent(destination) {
  if (!fs.existsSync(destination)) return 'unchanged';
  const existing = fs.readFileSync(destination, 'utf8');
  if (!existing.startsWith(MANAGED_MARKER)) return 'preserved';
  fs.rmSync(destination);
  return 'removed';
}

function projectConfig(existing) {
  let current = {};
  if (existing !== null && existing !== undefined) {
    try {
      current = JSON.parse(existing);
    } catch {
      throw new Error('Refusing to replace invalid .codex/sd0x-dev-flow.json');
    }
    if (!current || typeof current !== 'object' || Array.isArray(current)) {
      throw new Error('.codex/sd0x-dev-flow.json must contain a JSON object');
    }
  }
  const provider = normalizeReviewProvider(current);
  const { limits: _obsoleteLimits, ...preserved } = current;
  return `${JSON.stringify({
    ...preserved,
    schema_version: 1,
    enabled: true,
    review: {
      ...(current.review && typeof current.review === 'object'
        ? current.review
        : {}),
      provider: provider || DEFAULT_REVIEW_PROVIDER
    }
  }, null, 2)}\n`;
}

function parseSetupArgs(argv) {
  if (argv.length === 0) return 'default';
  const modes = new Map([
    ['--guidance', 'guidance'],
    ['--hooks', 'hooks'],
    ['--scripts', 'scripts']
  ]);
  if (argv.length !== 1 || !modes.has(argv[0])) {
    throw new Error('Usage: setup.js [--guidance|--hooks|--scripts]');
  }
  return modes.get(argv[0]);
}

function setup(cwd = process.cwd(), options = {}) {
  const mode = options.mode || 'default';
  if (!['default', 'guidance', 'hooks', 'scripts'].includes(mode)) {
    throw new Error(`Unsupported setup mode: ${mode}`);
  }
  const root = findRepoRoot(cwd);
  const pluginRoot = path.resolve(__dirname, '..', '..');
  const agentsPath = path.join(root, 'AGENTS.md');
  const configPath = path.join(root, '.codex', 'sd0x-dev-flow.json');
  const desiredAgents = ['default', 'guidance'].includes(mode)
    ? updateManagedBlock(fs.existsSync(agentsPath)
      ? fs.readFileSync(agentsPath, 'utf8')
      : '')
    : null;
  const desiredConfig = ['default', 'hooks'].includes(mode)
    ? projectConfig(fs.existsSync(configPath)
      ? fs.readFileSync(configPath, 'utf8')
      : null)
    : null;
  const agentPlans = [
    'sd0x-codex-primary-reviewer.toml',
    'sd0x-claude-primary-reviewer.toml'
  ].map((name) => ({
    source: path.join(pluginRoot, 'templates', 'agents', name),
    destination: path.join(root, '.codex', 'agents', name)
  }));
  for (const plan of agentPlans) {
    if (mode === 'default') {
      assertAgentOwnership(plan.destination, fs.readFileSync(plan.source, 'utf8'));
    }
  }

  const results = [];
  if (['default', 'guidance'].includes(mode)) {
    results.push({ file: agentsPath, status: writeIfChanged(agentsPath, desiredAgents) });
  }
  if (['default', 'hooks'].includes(mode)) {
    results.push({ file: configPath, status: writeIfChanged(configPath, desiredConfig) });
  }
  if (mode === 'default') {
    results.push({
      file: path.join(root, '.codex', 'agents', 'sd0x-reviewer.toml'),
      status: removeRetiredManagedAgent(path.join(
        root, '.codex', 'agents', 'sd0x-reviewer.toml'
      ))
    }, {
      file: path.join(root, '.codex', 'agents', 'sd0x-test-reviewer.toml'),
      status: removeRetiredManagedAgent(path.join(
        root, '.codex', 'agents', 'sd0x-test-reviewer.toml'
      ))
    });
    for (const plan of agentPlans) {
      results.push({
        file: plan.destination,
        status: installAgent(plan.source, plan.destination)
      });
    }
  }
  if (mode === 'scripts') {
    for (const relative of [
      'scripts/runtime/collaboration.js',
      'scripts/runtime/hook.js',
      'scripts/runtime/setup.js',
      'scripts/runtime/state.js',
      'scripts/runtime/worktree.js',
      'scripts/runtime/workflow-contract.js'
    ]) {
      const file = path.join(pluginRoot, ...relative.split('/'));
      if (!fs.statSync(file, { throwIfNoEntry: false })?.isFile()) {
        throw new Error(`Bundled runtime entrypoint is missing: ${relative}`);
      }
      results.push({ file, status: 'unchanged' });
    }
  }

  const activationFiles = new Set([
    configPath,
    path.join(root, '.codex', 'agents', 'sd0x-reviewer.toml'),
    path.join(root, '.codex', 'agents', 'sd0x-test-reviewer.toml'),
    ...agentPlans.map((plan) => plan.destination)
  ]);
  const activationDeferred = results.some((item) =>
    activationFiles.has(item.file) &&
      !['unchanged', 'preserved'].includes(item.status)
  );
  const claimToken = activationDeferred ? markSetupDeferral(root) : null;

  return {
    root,
    mode,
    results,
    activation_deferred: activationDeferred,
    setup_claim: claimToken ? {
      schema_version: 1,
      token: claimToken,
      root
    } : null
  };
}

function run(argv = process.argv.slice(2), cwd = process.cwd()) {
  try {
    const mode = parseSetupArgs(argv);
    process.stdout.write(`${JSON.stringify(setup(cwd, { mode }), null, 2)}\n`);
    return 0;
  } catch (error) {
    process.stderr.write(`sd0x setup: ${error.message}\n`);
    return 1;
  }
}

module.exports = {
  BLOCK,
  END,
  START,
  assertAgentOwnership,
  parseSetupArgs,
  projectConfig,
  removeRetiredManagedAgent,
  run,
  setup,
  updateManagedBlock
};
