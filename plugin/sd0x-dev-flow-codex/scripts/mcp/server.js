#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const { spawn } = require('node:child_process');

// The MCP connection key remains stable for installed skill entrypoints.
// This server executes allowlisted deterministic scripts; it has no LLM tool.
const SERVER_INFO = { name: 'sd0x-skill-runtime', version: '2.0.0' };
const MAX_RUNTIME_OUTPUT_BYTES = 4 * 1024 * 1024;
const RUNTIME_ENTRYPOINTS = Object.freeze({
  'create-request/request-tool.js': 'skills/create-request/scripts/request-tool.js',
  'doctor/doctor.js': 'skills/doctor/scripts/doctor.js',
  'remind/status.js': 'skills/remind/scripts/status.js',
  'reset/reset.js': 'skills/reset/scripts/reset.js',
  'review/gate.js': 'skills/review/scripts/gate.js',
  'review/provider.js': 'skills/review/scripts/provider.js',
  'review/round.js': 'skills/review/scripts/round.js',
  'review/snapshot.js': 'skills/review/scripts/snapshot.js',
  'setup/setup.js': 'skills/setup/scripts/setup.js',
  'verify/verify.js': 'skills/verify/scripts/verify.js'
});

const RUNTIME_TOOL_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    schema_version: { type: 'integer', const: 1 },
    entrypoint: { type: 'string', enum: Object.keys(RUNTIME_ENTRYPOINTS) },
    node_executable: { type: 'string', minLength: 1 },
    cwd: { type: 'string', minLength: 1 },
    exit_code: { type: 'integer' },
    signal: { type: ['string', 'null'] },
    stdout: { type: 'string' },
    stderr: { type: 'string' }
  },
  required: [
    'schema_version',
    'entrypoint',
    'node_executable',
    'cwd',
    'exit_code',
    'signal',
    'stdout',
    'stderr'
  ]
};

const RUN_SKILL_SCRIPT_TOOL = {
  name: 'run_skill_script',
  title: 'Run a trusted sd0x skill script',
  description: [
    'Run one allowlisted script from the installed sd0x plugin with the exact Node',
    'executable that owns this MCP runtime. The entrypoint is resolved inside the',
    'installed plugin payload and never through the repository working directory or PATH.'
  ].join(' '),
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      entrypoint: {
        type: 'string',
        enum: Object.keys(RUNTIME_ENTRYPOINTS)
      },
      args: {
        type: 'array',
        maxItems: 64,
        items: { type: 'string', maxLength: 16 * 1024 }
      },
      cwd: {
        type: 'string',
        minLength: 1,
        description: 'Absolute repository root in which the trusted script should run.'
      }
    },
    required: ['entrypoint', 'cwd']
  },
  outputSchema: RUNTIME_TOOL_OUTPUT_SCHEMA,
  annotations: {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: false,
    openWorldHint: false
  }
};

function runtimeChildEnvironment(environment = process.env) {
  const childEnvironment = { ...environment };
  const unsafe = new Set([
    'NODE_OPTIONS',
    'NODE_PATH',
    'LD_PRELOAD',
    'LD_LIBRARY_PATH',
    'DYLD_INSERT_LIBRARIES',
    'DYLD_LIBRARY_PATH',
    'DYLD_FRAMEWORK_PATH'
  ]);
  for (const name of Object.keys(childEnvironment)) {
    if (unsafe.has(name.toUpperCase())) delete childEnvironment[name];
  }
  return childEnvironment;
}

function validateRuntimeToolInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('runtime tool input must be an object');
  }
  const extra = Object.keys(input)
    .filter((name) => !['args', 'cwd', 'entrypoint'].includes(name));
  if (extra.length > 0) {
    throw new Error(`runtime tool input contains unsupported fields: ${extra.join(', ')}`);
  }
  if (!Object.hasOwn(RUNTIME_ENTRYPOINTS, input.entrypoint)) {
    throw new Error('entrypoint is not an allowlisted installed skill script');
  }
  if (typeof input.cwd !== 'string' || !path.isAbsolute(input.cwd) ||
      input.cwd.includes('\0')) {
    throw new Error('cwd must be an absolute path');
  }
  const args = input.args === undefined ? [] : input.args;
  if (!Array.isArray(args) || args.length > 64 ||
      args.some((value) =>
        typeof value !== 'string' || value.length > 16 * 1024 || value.includes('\0'))) {
    throw new Error('args must contain at most 64 bounded strings');
  }
  let cwd;
  try {
    cwd = fs.realpathSync(input.cwd);
  } catch {
    throw new Error('cwd must resolve to an existing directory');
  }
  if (!fs.statSync(cwd).isDirectory()) {
    throw new Error('cwd must resolve to an existing directory');
  }
  return { args, cwd, entrypoint: input.entrypoint };
}

function runSkillScript(input, options = {}) {
  const validated = validateRuntimeToolInput(input);
  const pluginRoot = fs.realpathSync(options.pluginRoot ||
    path.resolve(__dirname, '..', '..'));
  const script = fs.realpathSync(path.resolve(
    pluginRoot,
    RUNTIME_ENTRYPOINTS[validated.entrypoint]
  ));
  const relativeScript = path.relative(pluginRoot, script);
  if (!relativeScript || relativeScript.startsWith('..') || path.isAbsolute(relativeScript)) {
    throw new Error('runtime entrypoint escapes the installed plugin payload');
  }
  const nodeExecutable = fs.realpathSync(options.nodeExecutable || process.execPath);
  const spawnProcess = options.spawnProcess || spawn;
  const maxOutputBytes = options.maxOutputBytes || MAX_RUNTIME_OUTPUT_BYTES;

  return new Promise((resolve, reject) => {
    let settled = false;
    let outputBytes = 0;
    const stdout = [];
    const stderr = [];
    const child = spawnProcess(nodeExecutable, [script, ...validated.args], {
      cwd: validated.cwd,
      env: runtimeChildEnvironment(options.environment || process.env),
      signal: options.signal,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true
    });
    const finish = (callback) => {
      if (settled) return;
      settled = true;
      callback();
    };
    const append = (target, chunk) => {
      const body = Buffer.from(chunk);
      outputBytes += body.length;
      if (outputBytes > maxOutputBytes) {
        child.kill('SIGKILL');
        finish(() => reject(new Error('trusted skill script output exceeded the limit')));
        return;
      }
      target.push(body);
    };
    child.stdout.on('data', (chunk) => append(stdout, chunk));
    child.stderr.on('data', (chunk) => append(stderr, chunk));
    child.once('error', (error) => finish(() => reject(error)));
    child.once('close', (code, signal) => finish(() => resolve({
      schema_version: 1,
      entrypoint: validated.entrypoint,
      node_executable: nodeExecutable,
      cwd: validated.cwd,
      exit_code: Number.isInteger(code) ? code : -1,
      signal: signal || null,
      stdout: Buffer.concat(stdout).toString('utf8'),
      stderr: Buffer.concat(stderr).toString('utf8')
    })));
  });
}

function formatRuntimeResult(result) {
  const streams = [result.stdout, result.stderr].filter(Boolean).join(
    result.stdout && result.stderr ? '\n' : ''
  );
  return streams || `Trusted skill script exited with code ${result.exit_code}.`;
}

function jsonRpcError(id, code, message) {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

function writeMessage(output, value) {
  if (output.destroyed || output.writableEnded) return;
  output.write(`${JSON.stringify(value)}\n`);
}

function serve(options = {}) {
  const input = options.input || process.stdin;
  const output = options.output || process.stdout;
  const executeRuntime = options.runSkillScript || runSkillScript;
  const lines = readline.createInterface({ input, crlfDelay: Infinity });
  const activeRequests = new Map();

  lines.on('close', () => {
    for (const controller of activeRequests.values()) controller.abort();
    activeRequests.clear();
  });

  lines.on('line', async (line) => {
    if (!line.trim()) return;
    let request;
    try {
      request = JSON.parse(line);
    } catch {
      writeMessage(output, jsonRpcError(null, -32700, 'Parse error'));
      return;
    }
    const id = Object.prototype.hasOwnProperty.call(request, 'id')
      ? request.id
      : undefined;
    if (request.jsonrpc !== '2.0' || typeof request.method !== 'string') {
      if (id !== undefined) {
        writeMessage(output, jsonRpcError(id, -32600, 'Invalid Request'));
      }
      return;
    }

    try {
      if (request.method === 'notifications/cancelled') {
        activeRequests.get(request.params?.requestId)?.abort();
        return;
      }
      if (request.method === 'initialize') {
        const requested = request.params?.protocolVersion;
        writeMessage(output, {
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: typeof requested === 'string' && requested
              ? requested
              : '2025-06-18',
            capabilities: { tools: { listChanged: false } },
            serverInfo: SERVER_INFO
          }
        });
        return;
      }
      if (request.method === 'ping') {
        writeMessage(output, { jsonrpc: '2.0', id, result: {} });
        return;
      }
      if (request.method === 'tools/list') {
        writeMessage(output, {
          jsonrpc: '2.0',
          id,
          result: { tools: [RUN_SKILL_SCRIPT_TOOL] }
        });
        return;
      }
      if (request.method === 'tools/call') {
        const toolName = request.params?.name;
        if (toolName !== RUN_SKILL_SCRIPT_TOOL.name) {
          writeMessage(output, jsonRpcError(id, -32602, 'Unknown tool'));
          return;
        }
        const controller = new AbortController();
        activeRequests.set(id, controller);
        try {
          const result = await executeRuntime(request.params.arguments || {}, {
            signal: controller.signal
          });
          writeMessage(output, {
            jsonrpc: '2.0',
            id,
            result: {
              content: [{
                type: 'text',
                text: formatRuntimeResult(result)
              }],
              structuredContent: result,
              isError: toolName === RUN_SKILL_SCRIPT_TOOL.name &&
                result.exit_code !== 0
            }
          });
        } catch (error) {
          writeMessage(output, {
            jsonrpc: '2.0',
            id,
            result: {
              content: [{
                type: 'text',
                text: `Trusted skill script failed: ${error.message}`
              }],
              isError: true
            }
          });
        } finally {
          if (activeRequests.get(id) === controller) activeRequests.delete(id);
        }
        return;
      }
      if (id !== undefined) {
        writeMessage(output, jsonRpcError(id, -32601, 'Method not found'));
      }
    } catch (error) {
      if (id !== undefined) {
        writeMessage(output, jsonRpcError(id, -32603, error.message));
      }
    }
  });
  return lines;
}

if (require.main === module) {
  serve();
}

module.exports = {
  MAX_RUNTIME_OUTPUT_BYTES,
  RUN_SKILL_SCRIPT_TOOL,
  RUNTIME_ENTRYPOINTS,
  RUNTIME_TOOL_OUTPUT_SCHEMA,
  runSkillScript,
  runtimeChildEnvironment,
  serve
};
