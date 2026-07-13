#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { readProjectConfig } = require('./config');
const {
  applyRequestClosure,
  attestCommitClosureReview,
  beginCommitClosureReview,
  markGate,
  finalizeRequestClosure,
  prepareRequestClosure,
  recoverRequestClosure,
  recordPromotionEvidence,
  readState,
  refreshState,
  resetState,
  resolveStatePath,
  summarize
} = require('./state');
const { snapshot } = require('./worktree');
const { runVerification } = require('./verify');
const {
  claudeRequiredFlags,
  resolveClaudeExecutable
} = require('../mcp/server');
const {
  beginCollaborationReview
} = require('./collaboration');

function print(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function valueAfter(args, flag) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

function parseEvidence(args) {
  const inline = valueAfter(args, '--evidence');
  const evidenceFile = valueAfter(args, '--evidence-file');
  if (inline) return JSON.parse(inline);
  if (evidenceFile) {
    return JSON.parse(fs.readFileSync(path.resolve(evidenceFile), 'utf8'));
  }
  throw new Error('Provide --evidence JSON or --evidence-file PATH');
}

function parseInput(args) {
  const inline = valueAfter(args, '--input');
  const inputFile = valueAfter(args, '--input-file');
  if (inline) return JSON.parse(inline);
  if (inputFile) return JSON.parse(fs.readFileSync(path.resolve(inputFile), 'utf8'));
  throw new Error('Provide --input JSON or --input-file PATH');
}

function claudeCliStatus(
  env = process.env,
  execute = spawnSync,
  platform = process.platform,
  resolveBinary = resolveClaudeExecutable
) {
  const configuredBinary = env.SD0X_CLAUDE_BIN || 'claude';
  let binary;
  try {
    binary = resolveBinary(configuredBinary, { env, platform, execute });
  } catch (error) {
    return {
      binary: configuredBinary,
      installed: false,
      authenticated: false,
      reason: error.code === 'ENOENT'
        ? 'command-not-found'
        : 'native-windows-cli-required'
    };
  }
  const options = {
    encoding: 'utf8',
    env,
    maxBuffer: 1024 * 1024,
    timeout: 10_000,
    windowsHide: true,
    shell: false
  };
  const versionResult = execute(binary, ['--version'], options);
  if (versionResult.error || versionResult.status !== 0) {
    return {
      binary,
      installed: false,
      authenticated: false,
      reason: versionResult.error?.code === 'ENOENT'
        ? 'command-not-found'
        : 'version-check-failed'
    };
  }

  const version = String(versionResult.stdout || '').trim().split(/\r?\n/, 1)[0];
  const helpResult = execute(binary, ['--help'], options);
  const help = helpResult.status === 0 ? String(helpResult.stdout || '') : '';
  const requiredFlags = claudeRequiredFlags(env);
  const missingFlags = requiredFlags.filter((flag) => !help.includes(flag));
  const compatible = helpResult.status === 0 && missingFlags.length === 0;
  const authResult = execute(binary, ['auth', 'status', '--json'], options);
  let auth = null;
  try {
    auth = JSON.parse(authResult.stdout || '{}');
  } catch {
    auth = null;
  }
  const authenticated = authResult.status === 0 && auth?.loggedIn === true;
  return {
    binary: configuredBinary,
    ...(binary !== configuredBinary ? { resolved_binary: binary } : {}),
    installed: true,
    version: version.slice(0, 200),
    compatible,
    missing_flags: missingFlags,
    authenticated,
    auth_method: authenticated && typeof auth.authMethod === 'string'
      ? auth.authMethod
      : null,
    api_provider: authenticated && typeof auth.apiProvider === 'string'
      ? auth.apiProvider
      : null,
    reason: !compatible
      ? 'missing-required-flags'
      : (authenticated ? null : 'not-authenticated')
  };
}

function mcpServerStatus(pluginRoot, execute = spawnSync) {
  const configPath = path.join(pluginRoot, '.mcp.json');
  let server;
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    server = config.mcpServers?.sd0x_claude_review;
  } catch (error) {
    return { ready: false, reason: `invalid-config:${error.message}` };
  }
  if (!server || server.command !== 'node' ||
      !Array.isArray(server.args) || server.args.length !== 1 ||
      server.args[0] !== 'server.js' || typeof server.cwd !== 'string') {
    return { ready: false, reason: 'unexpected-server-config' };
  }
  const input = [
    JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-11-25',
        capabilities: {},
        clientInfo: { name: 'sd0x-doctor', version: '1.0.0' }
      }
    }),
    JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
    JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }),
    ''
  ].join('\n');
  const result = execute(process.execPath, server.args, {
    cwd: path.resolve(pluginRoot, server.cwd),
    input,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
    timeout: 10_000,
    windowsHide: true
  });
  if (result.error || result.status !== 0) {
    return {
      ready: false,
      reason: result.error?.code === 'ETIMEDOUT'
        ? 'handshake-timeout'
        : 'server-start-failed'
    };
  }
  let responses;
  try {
    responses = String(result.stdout || '').trim().split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch {
    return { ready: false, reason: 'invalid-json-rpc-output' };
  }
  const initialized = responses.find((item) => item.id === 1)?.result;
  const tools = responses.find((item) => item.id === 2)?.result?.tools;
  const tool = Array.isArray(tools)
    ? tools.find((item) => item.name === 'review_worktree')
    : null;
  return {
    ready: initialized?.serverInfo?.name === 'sd0x-claude-review' && Boolean(tool),
    server_name: initialized?.serverInfo?.name || null,
    protocol_version: initialized?.protocolVersion || null,
    tool: tool?.name || null,
    reason: tool ? null : 'review-tool-missing'
  };
}

function doctor(cwd, options = {}) {
  const pluginRoot = options.pluginRoot || path.resolve(__dirname, '..', '..');
  const projectConfig = readProjectConfig(cwd);
  const required = [
    '.codex-plugin/plugin.json',
    '.mcp.json',
    'hooks/hooks.json',
    'scripts/runtime/collaboration.js',
    'scripts/mcp/server.js',
    'skills/bug-fix/SKILL.md',
    'skills/create-request/SKILL.md',
    'skills/create-request/references/request-format.md',
    'skills/create-request/scripts/request-tool.js',
    'skills/doctor/SKILL.md',
    'skills/doctor/scripts/doctor.js',
    'skills/feature-dev/SKILL.md',
    'skills/remind/SKILL.md',
    'skills/remind/scripts/status.js',
    'skills/reset/SKILL.md',
    'skills/reset/scripts/reset.js',
    'skills/review/SKILL.md',
    'skills/review/references/review-theory.md',
    'skills/review/scripts/gate.js',
    'skills/review/scripts/provider.js',
    'skills/review/scripts/round.js',
    'skills/review/scripts/snapshot.js',
    'skills/verify/SKILL.md',
    'skills/verify/scripts/verify.js',
    'skills/setup/SKILL.md',
    'skills/setup/scripts/setup.js',
    'templates/agents/sd0x-claude-primary-reviewer.toml',
    'templates/agents/sd0x-codex-primary-reviewer.toml',
    'templates/agents/sd0x-test-reviewer.toml'
  ];
  const checks = required.map((relative) => ({
    check: relative,
    ok: fs.existsSync(path.join(pluginRoot, relative))
  }));
  const nodeMajor = options.nodeMajor ?? Number(process.versions.node.split('.')[0]);
  checks.push({ check: 'node>=24', ok: nodeMajor >= 24 });
  checks.push({ check: 'state-path', ok: Boolean(resolveStatePath(cwd)) });
  const claudeRequired = projectConfig.review.provider === 'claude';
  const claude = claudeRequired
    ? (options.claudeStatus || claudeCliStatus)()
    : { required: false, checked: false };
  const mcp = claudeRequired
    ? (options.mcpStatus || mcpServerStatus)(pluginRoot)
    : { required: false, checked: false };
  if (claudeRequired) {
    checks.push({ check: 'claude-cli', ok: claude.installed });
    checks.push({ check: 'claude-capabilities', ok: claude.compatible === true });
    checks.push({ check: 'claude-auth', ok: claude.authenticated });
    checks.push({ check: 'claude-review-mcp-handshake', ok: mcp.ready });
  }
  let status = null;
  let stateError = null;
  try {
    status = summarize(refreshState(cwd));
  } catch (error) {
    stateError = error.message;
    checks.push({ check: 'runtime-state-readable', ok: false });
  }
  return {
    ok: checks.every((check) => check.ok),
    plugin_root: pluginRoot,
    project_enabled: projectConfig.enabled,
    project_config: projectConfig.path,
    review_provider: projectConfig.review.provider,
    state_path: resolveStatePath(cwd),
    claude,
    mcp,
    checks,
    state_error: stateError,
    status
  };
}

function usage() {
  process.stderr.write([
    'Usage:',
    '  cli.js status',
    '  cli.js snapshot',
    '  cli.js reset',
    '  cli.js doctor',
    '  cli.js verify',
    '  cli.js gate review <pass|fail> --evidence JSON',
    '  cli.js closure prepare --input-file PATH',
    '  cli.js closure apply --input-file PATH',
    '  cli.js closure recover --input-file PATH',
    '  cli.js closure finalize --input-file PATH',
    '  cli.js closure commit-review-begin --input-file PATH',
    '  cli.js closure commit-review-attest --input-file PATH',
    '  cli.js evidence record --input-file PATH',
    ''
  ].join('\n'));
}

function main(argv = process.argv.slice(2), cwd = process.cwd()) {
  const [command, gate, status] = argv;
  if (command === 'status') {
    print(summarize(refreshState(cwd)));
    return 0;
  }
  if (command === 'snapshot') {
    print(snapshot(cwd));
    return 0;
  }
  if (command === 'reset') {
    print(summarize(resetState(cwd)));
    return 0;
  }
  if (command === 'doctor') {
    const result = doctor(cwd);
    print(result);
    return result.ok ? 0 : 1;
  }
  if (command === 'verify') {
    const result = runVerification(cwd, {
      onResult(item) {
        process.stdout.write(`\n$ ${item.command}\n`);
        if (item.output) process.stdout.write(`${item.output}\n`);
        process.stdout.write(`[exit ${item.exit_code}, ${item.duration_ms}ms]\n`);
      }
    });
    process.stdout.write(`\nVerification gate: ${result.status}\n`);
    return result.status === 'pass' ? 0 : 1;
  }
  if (command === 'closure' && gate === 'prepare') {
    print(prepareRequestClosure(cwd, parseInput(argv)));
    return 0;
  }
  if (command === 'closure' && gate === 'apply') {
    print(applyRequestClosure(cwd, parseInput(argv)));
    return 0;
  }
  if (command === 'closure' && gate === 'recover') {
    print(recoverRequestClosure(cwd, parseInput(argv)));
    return 0;
  }
  if (command === 'closure' && gate === 'commit-review-begin') {
    const marker = beginCommitClosureReview(cwd, parseInput(argv));
    print({
      marker,
      collaboration: beginCollaborationReview(cwd, {
        commitSubjectSha256: marker.subject_sha256
      })
    });
    return 0;
  }
  if (command === 'closure' && gate === 'commit-review-attest') {
    print(attestCommitClosureReview(cwd, parseInput(argv)));
    return 0;
  }
  if (command === 'closure' && gate === 'finalize') {
    print(finalizeRequestClosure(cwd, parseInput(argv)));
    return 0;
  }
  if (command === 'evidence' && gate === 'record') {
    print(recordPromotionEvidence(cwd, parseInput(argv)));
    return 0;
  }
  if (command === 'gate' && gate && status) {
    if (gate !== 'review') {
      throw new Error(
        'Verification gates can only be recorded by the deterministic verify command'
      );
    }
    const state = markGate(cwd, gate, status, parseEvidence(argv));
    print(summarize(state));
    return 0;
  }
  if (command === 'raw-state') {
    print(readState(cwd));
    return 0;
  }

  usage();
  return 2;
}

if (require.main === module) {
  try {
    process.exitCode = main();
  } catch (error) {
    process.stderr.write(`sd0x: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  claudeCliStatus,
  doctor,
  main,
  mcpServerStatus,
  parseInput,
  parseEvidence
};
