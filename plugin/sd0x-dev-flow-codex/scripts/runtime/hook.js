#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { isProjectEnabled } = require('./config');
const {
  claimSetupDeferral,
  clearSetupDeferral,
  clearSessionActivationFailure,
  consumeSetupDeferral,
  hasSessionActivationFailure,
  nextAction,
  readState,
  isSessionActive,
  markSessionActivationFailure,
  recordExternalReview,
  recordSubagent,
  recordContinuation,
  refreshState,
  summarize
} = require('./state');
const { extractToolPaths, findRepoRoot, isProtectedPath } = require('./worktree');

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

function pendingMessage(state, sessionId) {
  const action = nextAction(state, { sessionId });
  if (action.action === 'review') {
    if (action.reason === 'review-findings-remain') {
      return 'The current worktree has unresolved review findings. Fix the recorded findings, then run `$sd0x-dev-flow-codex:review` again.';
    }
    return 'The current worktree needs independent review. Run `$sd0x-dev-flow-codex:review` before finishing.';
  }
  if (action.action === 'verify') {
    if (action.reason === 'verification-failed') {
      return 'Deterministic verification failed for the current worktree. Fix the recorded failure, then run `$sd0x-dev-flow-codex:verify` again.';
    }
    return 'Review passed for this fingerprint. Run `$sd0x-dev-flow-codex:verify` before finishing.';
  }
  if (action.action === 'escalate') {
    return `The sd0x loop reached its ${action.reason} safety limit. Stop automatic iteration and explain the remaining blocker to the user.`;
  }
  return 'All required sd0x gates pass for the current worktree fingerprint.';
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

function structuredMcpResult(response) {
  if (!response || typeof response !== 'object' || response.isError === true) {
    return null;
  }
  if (response.structuredContent && typeof response.structuredContent === 'object') {
    return response.structuredContent;
  }
  if (response.structured_content && typeof response.structured_content === 'object') {
    return response.structured_content;
  }
  return null;
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

function handleClaudeReviewResult(input, cwd) {
  const result = structuredMcpResult(input.tool_response);
  if (!result) {
    emit(contextOutput('PostToolUse',
      'Claude MCP did not return a successful structured review. No review evidence was recorded.'));
    return;
  }
  recordExternalReview(cwd, {
    input_fingerprint: input.tool_input?.fingerprint,
    input_root: input.tool_input?.cwd,
    tool_use_id: input.tool_use_id,
    result
  });
  emit(contextOutput('PostToolUse',
    `Recorded Claude MCP ${result.outcome} evidence for fingerprint ${result.fingerprint}.`));
}

function handle(eventName, input) {
  const cwd = input.cwd || process.cwd();

  if (!isProjectEnabled(cwd)) {
    if (eventName === 'Stop' || eventName === 'SubagentStop') {
      emit({ continue: true });
    }
    return;
  }

  if (eventName === 'PreToolUse') {
    handlePreToolUse(input, cwd);
    return;
  }

  if (eventName === 'SessionStart') {
    const sessionId = input.session_id || input.sessionId || null;
    clearSetupDeferral(cwd);
    const state = refreshState(cwd, {
      sessionId
    });
    clearSessionActivationFailure(cwd, sessionId);
    emit(contextOutput(eventName, [
      'sd0x Dev Flow is active.',
      'Completion gates are tied to the exact worktree fingerprint.',
      'Use the Claude MCP primary reviewer plus two independent Codex reviewer subagents; use the deterministic verify runner for tests.',
      pendingMessage(state, sessionId)
    ].join(' ')));
    return;
  }

  const sessionId = input.session_id || input.sessionId || null;
  const stateBeforeEvent = readState(cwd);
  if (isSessionActive(stateBeforeEvent, sessionId)) {
    clearSessionActivationFailure(cwd, sessionId);
  } else if (hasSessionActivationFailure(cwd, sessionId)) {
    if (!isSessionActive(stateBeforeEvent, sessionId)) {
      refreshState(cwd, { sessionId });
    }
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
    recordSubagent(cwd, 'start', input);
    const focus = input.agent_type === 'sd0x_test_reviewer'
      ? 'Focus on missing tests, acceptance coverage, flaky assumptions, and verification gaps.'
      : 'Focus on correctness, security, behavior regressions, race conditions, and error handling.';
    emit(contextOutput(eventName,
      `Stay read-only and review only the current worktree changes. ${focus} Return concrete actionable findings with file and line references; say explicitly when no findings remain.`));
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
      handleClaudeReviewResult(input, cwd);
      return;
    }
    const state = refreshState(cwd, { sessionId });
    emit(contextOutput(eventName,
      `Worktree state refreshed. ${pendingMessage(state, sessionId)}`));
    return;
  }

  if (eventName === 'UserPromptSubmit') {
    const state = refreshState(cwd, { sessionId });
    const action = nextAction(state, { sessionId });
    if (action.action !== 'complete') {
      emit(contextOutput(eventName, pendingMessage(state, sessionId)));
    }
    return;
  }

  if (eventName === 'Stop') {
    const state = refreshState(cwd, { sessionId });
    const action = nextAction(state, { sessionId });
    if (action.action === 'review' || action.action === 'verify') {
      recordContinuation(cwd, sessionId);
      emit({ decision: 'block', reason: pendingMessage(state, sessionId) });
    } else if (action.action === 'escalate') {
      emit({ systemMessage: pendingMessage(state, sessionId) });
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
        markSessionActivationFailure(cwd, sessionId);
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
        reason: 'sd0x could not validate the current completion gates. Run `$sd0x-dev-flow-codex:doctor`, fix the runtime-state error, and try again.'
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
  handleClaudeReviewResult,
  handlePreToolUse,
  pendingMessage,
  structuredMcpResult
};
