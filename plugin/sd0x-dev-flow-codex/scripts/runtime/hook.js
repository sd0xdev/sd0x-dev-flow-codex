#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { readProjectConfig } = require('./config');
const {
  claimSetupDeferral,
  clearSetupDeferral,
  clearSessionActivationFailure,
  consumeSetupDeferral,
  commitClosureReviewerContext,
  nextAction,
  readState,
  isSessionActive,
  markSessionActivationFailure,
  recordSubagent,
  recoverSessionActivation,
  refreshState,
  runtimeStateGeneration,
  summarize
} = require('./state');
const { extractToolPaths, findRepoRoot, isProtectedPath } = require('./worktree');
const { formatStateSignal } = require('./workflow-contract');

const CLAUDE_REVIEW_TOOL = 'mcp__sd0x_claude_review__review_worktree';

function readInput() {
  try {
    return JSON.parse(require('node:fs').readFileSync(0, 'utf8') || '{}');
  } catch {
    return {};
  }
}

function emit(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

function contextOutput(eventName, context) {
  return {
    hookSpecificOutput: {
      hookEventName: eventName,
      additionalContext: context
    }
  };
}

function pendingMessage(state, sessionId, eventName = 'Runtime') {
  const action = nextAction(state, { sessionId });
  const signal = formatStateSignal(eventName, summarize(state, { sessionId }));
  if (action.action === 'review') {
    if (action.reason === 'review-in-progress') {
      return `${signal} The configured primary review is still running for this fingerprint.`;
    }
    if (action.reason === 'reviewer-unavailable') {
      return `${signal} Reviewer infrastructure did not produce valid terminal evidence. The failed gate and ledger remain authoritative until the fingerprint changes or an authorized reset runs. Existing user authorization applies within its scope.`;
    }
    if (action.reason === 'review-findings-remain') {
      return `${signal} Actionable primary-review findings remain recorded for this fingerprint.`;
    }
    return `${signal} No configured-primary review pass is recorded for this fingerprint.`;
  }
  if (action.action === 'verify') {
    if (action.reason === 'verification-failed') {
      return `${signal} Deterministic verification is recorded as failed for this fingerprint.`;
    }
    return `${signal} Review passed, but deterministic verification is not recorded for this fingerprint.`;
  }
  return `${signal} All required sd0x gates pass for this fingerprint.`;
}

function handlePreToolUse(input, cwd) {
  const root = findRepoRoot(cwd);
  const blocked = extractToolPaths(input).filter((file) => isProtectedPath(file, root));
  if (blocked.length === 0) return;
  emit({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: `sd0x protected-path policy blocked: ${blocked.join(', ')}`
    }
  });
}

function sameRealPath(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  try {
    return fs.realpathSync(left) === fs.realpathSync(right);
  } catch {
    return path.resolve(left) === path.resolve(right);
  }
}

function parseJsonText(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const text = value.trim();
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

function setupClaimFromToolResult(input, cwd) {
  const response = input.tool_response;
  if (!response || response.isError === true ||
      (Number.isInteger(response.exit_code) && response.exit_code !== 0)) {
    return null;
  }
  const texts = [];
  if (typeof response === 'string') texts.push(response);
  for (const key of ['output', 'stdout', 'result']) {
    if (typeof response[key] === 'string') texts.push(response[key]);
  }
  if (Array.isArray(response.content)) {
    for (const item of response.content) {
      if (item && typeof item.text === 'string') texts.push(item.text);
    }
  }
  for (const text of texts) {
    const result = parseJsonText(text);
    const claim = result?.setup_claim;
    if (result?.activation_deferred === true && claim?.schema_version === 1 &&
        typeof claim.token === 'string' &&
        sameRealPath(claim.root, findRepoRoot(cwd))) {
      return claim.token;
    }
  }
  return null;
}

function handle(eventName, input) {
  const cwd = input.cwd || process.cwd();
  const projectConfig = readProjectConfig(cwd);

  if (!projectConfig.enabled) {
    if (eventName === 'Stop' || eventName === 'SubagentStop') {
      emit({ continue: true });
    }
    return;
  }

  if (eventName === 'PreToolUse' && input.tool_name === CLAUDE_REVIEW_TOOL) {
    emit({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: 'Claude MCP review is retired. Use the configured Codex primary subagent.'
      }
    });
    return;
  }

  if (eventName === 'PreToolUse' && input.tool_name !== CLAUDE_REVIEW_TOOL) {
    handlePreToolUse(input, cwd);
    return;
  }

  if (eventName === 'SessionStart') {
    const sessionId = input.session_id || input.sessionId || null;
    try {
      input.sd0x_activation_runtime_generation = runtimeStateGeneration(cwd);
    } catch {
      input.sd0x_activation_runtime_generation = null;
    }
    clearSetupDeferral(cwd);
    const state = refreshState(cwd, {
      sessionId
    });
    clearSessionActivationFailure(cwd, sessionId);
    emit(contextOutput(eventName, [
      'sd0x Dev Flow is active.',
      pendingMessage(state, sessionId, eventName)
    ].join(' ')));
    return;
  }

  const sessionId = input.session_id || input.sessionId || null;
  const stateBeforeEvent = readState(cwd);
  if (stateBeforeEvent.reset_recovery?.requires_new_session === true) {
    if (eventName === 'Stop' || eventName === 'SubagentStop') {
      emit({
        decision: 'block',
        reason: 'sd0x quarantined corrupt runtime state. This session cannot be recovered from prior activation markers; start a new Codex task so SessionStart can establish trusted state.'
      });
    }
    return;
  }
  if (isSessionActive(stateBeforeEvent, sessionId)) {
    clearSessionActivationFailure(cwd, sessionId);
  } else if (recoverSessionActivation(cwd, sessionId)) {
    clearSessionActivationFailure(cwd, sessionId);
  } else if (!isSessionActive(stateBeforeEvent, sessionId)) {
    const setupClaim = eventName === 'PostToolUse' && input.tool_name === 'exec_command'
      ? setupClaimFromToolResult(input, cwd)
      : null;
    if (setupClaim && claimSetupDeferral(cwd, sessionId, setupClaim)) {
      emit(contextOutput(eventName,
        'sd0x setup was completed in this session. Start a new Codex task to activate the workflow and project agents.'));
    } else if ((eventName === 'Stop' || eventName === 'SubagentStop') &&
        consumeSetupDeferral(cwd, sessionId)) {
      emit({
        continue: true,
        systemMessage: 'sd0x setup is present but was not active at SessionStart. Start a new Codex task to activate the workflow and project agents.'
      });
    } else if (eventName === 'Stop' || eventName === 'SubagentStop') {
      emit({
        decision: 'block',
        reason: 'sd0x is enabled, but this session has no successful SessionStart activation. Start a new Codex task or run `$sd0x-dev-flow-codex:doctor`; completion cannot be trusted in this session.'
      });
    }
    return;
  }

  if (eventName === 'SubagentStart') {
    const state = recordSubagent(cwd, 'start', input);
    const commitContext = commitClosureReviewerContext(cwd);
    emit(contextOutput(eventName,
      `Review subject: ${commitContext || `current worktree fingerprint ${state.worktree.fingerprint}`}. Follow the configured read-only reviewer profile and review skill.`));
    return;
  }

  if (eventName === 'SubagentStop') {
    recordSubagent(cwd, 'stop', input);
    const result = typeof input.last_assistant_message === 'string'
      ? input.last_assistant_message.trim()
      : '';
    if (!result && input.stop_hook_active !== true) {
      emit({
        decision: 'block',
        reason: 'Return an explicit final review result with actionable findings or state that no actionable findings remain.'
      });
    } else {
      emit({ continue: true });
    }
    return;
  }

  if (eventName === 'PostToolUse') {
    if (input.tool_name === CLAUDE_REVIEW_TOOL) {
      return;
    }
    const state = refreshState(cwd, { sessionId });
    emit(contextOutput(eventName,
      pendingMessage(state, sessionId, eventName)));
    return;
  }

  if (eventName === 'UserPromptSubmit') {
    const state = refreshState(cwd, { sessionId });
    const action = nextAction(state, { sessionId });
    if (action.action !== 'complete') {
      emit(contextOutput(eventName, pendingMessage(state, sessionId, eventName)));
    }
    return;
  }

  if (eventName === 'Stop') {
    const state = refreshState(cwd, { sessionId });
    const action = nextAction(state, { sessionId });
    if (action.action === 'review' || action.action === 'verify') {
      emit({
        continue: true,
        systemMessage: [
          'sd0x completion advisory (non-blocking).',
          pendingMessage(state, sessionId, eventName)
        ].join(' ')
      });
    } else {
      emit({ continue: true });
    }
  }
}

if (require.main === module) {
  const input = readInput();
  const eventName = input.hook_event_name || input.hookEventName || '';

  try {
    handle(eventName, input);
  } catch (error) {
    process.stderr.write(`sd0x hook warning: ${error.message}\n`);
    if (eventName === 'PreToolUse') {
      process.exitCode = 2;
    } else if (eventName === 'SessionStart') {
      const cwd = input.cwd || process.cwd();
      const sessionId = input.session_id || input.sessionId || null;
      try {
        markSessionActivationFailure(
          cwd,
          sessionId,
          input.sd0x_activation_runtime_generation ?? null
        );
      } catch (markerError) {
        process.stderr.write(
          `sd0x activation marker warning: ${markerError.message}\n`
        );
      }
      try {
        clearSetupDeferral(cwd);
      } catch (markerError) {
        process.stderr.write(
          `sd0x setup deferral cleanup warning: ${markerError.message}\n`
        );
      }
      emit(contextOutput('SessionStart',
        'sd0x activation failed. Completion will remain fail-closed until this session can refresh runtime state; run `$sd0x-dev-flow-codex:doctor` if the failure persists.'));
    } else if (eventName === 'Stop') {
      emit({
        decision: 'block',
        reason: 'sd0x could not validate the current completion gates. Run `$sd0x-dev-flow-codex:doctor`; corrupt state recovery uses `$sd0x-dev-flow-codex:reset`, which quarantines the corrupt bytes and requires a new SessionStart. Use existing user authorization within its scope; otherwise ask before reset.'
      });
    } else if (eventName === 'SubagentStop') {
      emit({
        continue: true,
        systemMessage: 'sd0x subagent hook failed; run the doctor skill before relying on review evidence.'
      });
    }
  }
}

module.exports = {
  contextOutput,
  handle,
  handlePreToolUse,
  pendingMessage
};
