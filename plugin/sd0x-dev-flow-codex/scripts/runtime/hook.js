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
  discardExternalReviewStart,
  nextAction,
  readState,
  isSessionActive,
  markSessionActivationFailure,
  recordExternalReview,
  recordExternalReviewStart,
  recordSubagent,
  recoverSessionActivation,
  refreshState,
  runtimeStateGeneration,
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
    if (action.reason === 'review-in-progress') {
      return 'Independent reviewers are still running for the current worktree. Wait for their terminal results; if the reviewer ledger is stale, ask the user before running `$sd0x-dev-flow-codex:reset`.';
    }
    if (action.reason === 'reviewer-unavailable') {
      return 'Review remains failed because reviewer infrastructure is unavailable. The model should account for this incomplete evidence when deciding whether more review is useful. For the same fingerprint, only a user-authorized `$sd0x-dev-flow-codex:reset` clears the failed gate and stale ledger.';
    }
    if (action.reason === 'review-findings-remain') {
      return 'Review is blocked for the current worktree. Inspect the recorded reviewer results: fix actionable findings and rerun `$sd0x-dev-flow-codex:review`; if a reviewer failed or its ledger is stale, ask the user before running `$sd0x-dev-flow-codex:reset`.';
    }
    return 'No independent review pass is recorded for the current worktree fingerprint.';
  }
  if (action.action === 'verify') {
    if (action.reason === 'verification-failed') {
      return 'Deterministic verification is recorded as failed for the current worktree.';
    }
    return 'Review passed for this fingerprint, but deterministic verification is not recorded.';
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
  const identity = {
    session_id: input.session_id || input.sessionId || null,
    tool_use_id: input.tool_use_id
  };
  const result = structuredMcpResult(input.tool_response);
  if (!result) {
    discardExternalReviewStart(cwd, identity);
    emit(contextOutput('PostToolUse',
      'Claude MCP did not return a successful structured review. No review evidence was recorded.'));
    return;
  }
  try {
    recordExternalReview(cwd, {
      input_fingerprint: input.tool_input?.fingerprint,
      input_root: input.tool_input?.cwd,
      ...identity,
      result
    });
  } catch (error) {
    discardExternalReviewStart(cwd, identity);
    throw error;
  }
  emit(contextOutput('PostToolUse',
    `Recorded Claude MCP ${result.outcome} evidence for fingerprint ${result.fingerprint}.`));
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

  if (eventName === 'PreToolUse' && input.tool_name === CLAUDE_REVIEW_TOOL &&
      projectConfig.review.provider !== 'claude') {
    emit({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: 'Claude review is disabled. Set review.provider to "claude" and start a new task before using the Claude reviewer.'
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
      'Completion gates are tied to the exact worktree fingerprint.',
      projectConfig.review.provider === 'claude'
        ? 'Use the Claude-wrapper primary subagent plus two independent Codex reviewer subagents; the Claude MCP call must happen inside its wrapper.'
        : 'Use the gpt-5.6-sol xhigh Codex primary subagent plus two independent gpt-5.6-sol xhigh Codex reviewer subagents; do not call Claude.',
      'Use the deterministic verify runner for tests.',
      pendingMessage(state, sessionId)
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
    recordSubagent(cwd, 'start', input);
    let focus = 'Focus on correctness, security, behavior regressions, race conditions, and error handling.';
    if (input.agent_type === 'sd0x_test_reviewer') {
      focus = 'Focus on missing tests, acceptance coverage, flaky assumptions, and verification gaps.';
    } else if (input.agent_type === 'sd0x_codex_primary_reviewer') {
      focus = 'Perform the full primary implementation and test review with gpt-5.6-sol xhigh.';
    } else if (input.agent_type === 'sd0x_claude_primary_reviewer') {
      focus = 'Call the Claude MCP exactly once for the supplied root and fingerprint, then validate and relay its structured result.';
    }
    emit(contextOutput(eventName,
      `Stay read-only and review only the current worktree changes. ${focus} Return concrete actionable findings with file and line references; say explicitly when no findings remain.`));
    return;
  }

  if (eventName === 'PreToolUse' && input.tool_name === CLAUDE_REVIEW_TOOL) {
    recordExternalReviewStart(cwd, {
      input_fingerprint: input.tool_input?.fingerprint,
      input_root: input.tool_input?.cwd,
      session_id: sessionId,
      tool_use_id: input.tool_use_id
    });
    emit(contextOutput(eventName,
      `Bound Claude review start to the current runtime epoch for fingerprint ${input.tool_input?.fingerprint}.`));
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
      emit({
        continue: true,
        systemMessage: [
          'sd0x completion advisory (non-blocking).',
          pendingMessage(state, sessionId),
          'Use the user request, actual task completeness, change risk, and evidence reliability to decide whether to continue reviewing or verifying.',
          'Do not claim an sd0x gate passed unless the runtime recorded it for this exact fingerprint.'
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
        reason: 'sd0x could not validate the current completion gates. Run `$sd0x-dev-flow-codex:doctor`; if runtime state is corrupt, ask the user before running `$sd0x-dev-flow-codex:reset`, which quarantines the corrupt bytes and requires a new SessionStart.'
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
