'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { findRepoRoot, snapshot } = require('./worktree');
const {
  isCurrentPass,
  recordVerification,
  refreshState
} = require('./state');

const OUTPUT_LIMIT = 12_000;
const TIMEOUT_MS = 15 * 60 * 1000;
const WINDOWS_COMMAND_RUNNERS = new Set(['npm', 'yarn', 'pnpm']);

function commandSpec(command, args) {
  return { command, args };
}

function changedPaths(root, args) {
  const result = spawnSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true
  });
  if (result.status !== 0) {
    throw new Error((result.stderr || 'Unable to inspect Git change layers').trim());
  }
  return new Set(result.stdout.split('\0').filter(Boolean));
}

function stagedWorktreeDivergence(cwd = process.cwd()) {
  const root = findRepoRoot(cwd);
  const staged = changedPaths(root, [
    'diff', '--cached', '--ignore-submodules=none', '--no-renames',
    '--name-only', '-z', '--'
  ]);
  const unstaged = changedPaths(root, [
    'diff', '--ignore-submodules=none', '--no-renames', '--name-only', '-z', '--'
  ]);
  const stagedDeleted = changedPaths(root, [
    'diff', '--cached', '--ignore-submodules=none', '--no-renames', '--diff-filter=D',
    '--name-only', '-z', '--'
  ]);
  const recreatedAfterStagedDeletion = [...stagedDeleted].filter((file) => {
    try {
      fs.lstatSync(path.join(root, file));
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') return false;
      throw error;
    }
  });
  return [...new Set([
    ...[...staged].filter((file) => unstaged.has(file)),
    ...recreatedAfterStagedDeletion
  ])].sort();
}

function packageRunner(root) {
  if (fs.existsSync(path.join(root, 'pnpm-lock.yaml'))) return 'pnpm';
  if (fs.existsSync(path.join(root, 'yarn.lock'))) return 'yarn';
  if (fs.existsSync(path.join(root, 'bun.lockb')) ||
      fs.existsSync(path.join(root, 'bun.lock'))) return 'bun';
  return 'npm';
}

function scriptCommand(runner, name) {
  if (runner === 'npm') return commandSpec('npm', ['run', name]);
  if (runner === 'yarn') return commandSpec('yarn', [name]);
  return commandSpec(runner, ['run', name]);
}

function detectCommands(cwd = process.cwd()) {
  const root = findRepoRoot(cwd);
  const hasHead = spawnSync('git', ['rev-parse', '--verify', 'HEAD'], {
    cwd: root,
    stdio: 'ignore',
    windowsHide: true
  }).status === 0;
  const commands = [
    commandSpec('git', ['diff', '--check', '--cached', '--']),
    commandSpec('git', hasHead
      ? ['diff', '--check', 'HEAD', '--']
      : ['diff', '--check', '--'])
  ];
  const packagePath = path.join(root, 'package.json');

  if (fs.existsSync(packagePath)) {
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    const scripts = packageJson.scripts || {};
    const runner = packageRunner(root);
    let selectedProjectCommand = false;
    if (scripts.check) {
      commands.push(scriptCommand(runner, 'check'));
      selectedProjectCommand = true;
    } else {
      for (const name of ['typecheck', 'lint', 'test']) {
        if (scripts[name]) {
          commands.push(scriptCommand(runner, name));
          selectedProjectCommand = true;
        }
      }
      if (!selectedProjectCommand && scripts.build) {
        commands.push(scriptCommand(runner, 'build'));
      }
    }
    return { root, commands };
  }

  if (fs.existsSync(path.join(root, 'pyproject.toml')) ||
      fs.existsSync(path.join(root, 'pytest.ini'))) {
    commands.push(commandSpec(process.env.PYTHON || 'python3', ['-m', 'pytest']));
  } else if (fs.existsSync(path.join(root, 'go.mod'))) {
    commands.push(commandSpec('go', ['test', './...']));
  } else if (fs.existsSync(path.join(root, 'Cargo.toml'))) {
    commands.push(commandSpec('cargo', ['test']));
  }

  return { root, commands };
}

function printable(spec) {
  return [spec.command, ...spec.args]
    .map((part) => /[\s"']/.test(part) ? JSON.stringify(part) : part)
    .join(' ');
}

function commandForPlatform(command, platform = process.platform) {
  if (platform === 'win32' && WINDOWS_COMMAND_RUNNERS.has(command)) {
    return `${command}.cmd`;
  }
  return command;
}

function truncate(value) {
  if (value.length <= OUTPUT_LIMIT) return value;
  return `[truncated]\n${value.slice(-OUTPUT_LIMIT)}`;
}

function execute(spec, root, options = {}) {
  const started = Date.now();
  const platform = options.platform || process.platform;
  const resolvedSpec = commandSpec(
    commandForPlatform(spec.command, platform),
    spec.args
  );
  const spawnProcess = options.spawnProcess || spawnSync;
  const result = spawnProcess(resolvedSpec.command, resolvedSpec.args, {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, CI: process.env.CI || '1' },
    timeout: TIMEOUT_MS,
    maxBuffer: 32 * 1024 * 1024,
    windowsHide: true,
    shell: platform === 'win32' && resolvedSpec.command.endsWith('.cmd')
  });
  const exitCode = result.error
    ? (result.error.code === 'ETIMEDOUT' ? 124 : 127)
    : (result.status ?? 1);
  const output = truncate([
    result.stdout || '',
    result.stderr || '',
    result.error ? result.error.message : ''
  ].filter(Boolean).join('\n').trim());

  return {
    command: printable(resolvedSpec),
    exit_code: exitCode,
    duration_ms: Date.now() - started,
    output
  };
}

function runVerification(cwd = process.cwd(), options = {}) {
  const { root, commands } = detectCommands(cwd);
  const startingState = refreshState(root);
  if (!isCurrentPass(startingState, 'review')) {
    throw new Error(
      'Deterministic verification requires a current review pass first'
    );
  }
  const startingFingerprint = startingState.worktree.fingerprint;
  const startingProvider = startingState.review_provider;
  const results = [];
  const divergentFiles = stagedWorktreeDivergence(root);

  if (divergentFiles.length > 0) {
    results.push({
      command: 'sd0x staged/worktree divergence check',
      exit_code: 1,
      duration_ms: 0,
      output: 'Verification cannot certify different staged and worktree versions: ' +
        divergentFiles.join(', ')
    });
  } else {
    for (const command of commands) {
      const result = execute(command, root);
      results.push(result);
      if (typeof options.onResult === 'function') options.onResult(result);
      if (result.exit_code !== 0) break;
    }
  }
  if (divergentFiles.length > 0 && typeof options.onResult === 'function') {
    options.onResult(results[0]);
  }

  const endingFingerprint = snapshot(root).fingerprint;
  const status = results.every((result) => result.exit_code === 0) &&
      endingFingerprint === startingFingerprint
    ? 'pass'
    : 'fail';
  const evidence = {
    runner: 'sd0x-deterministic-v1',
    commands: results,
    starting_fingerprint: startingFingerprint,
    ending_fingerprint: endingFingerprint,
    fingerprint_changed: endingFingerprint !== startingFingerprint,
    recorded_at: new Date().toISOString()
  };
  const state = recordVerification(
    root,
    status,
    evidence,
    startingFingerprint,
    startingProvider
  );
  return {
    status: state.gates.verify.status,
    evidence: state.gates.verify.evidence,
    state
  };
}

module.exports = {
  commandForPlatform,
  detectCommands,
  execute,
  printable,
  runVerification,
  stagedWorktreeDivergence
};
