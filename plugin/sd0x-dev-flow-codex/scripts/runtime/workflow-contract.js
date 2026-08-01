'use strict';

const crypto = require('node:crypto');

const CONTRACT_SCHEMA_VERSION = 1;
const STATE_SIGNAL_SCHEMA_VERSION = 1;
const STATE_SIGNAL_PREFIX = '[SD0X_STATE]';
const START = '<!-- sd0x-dev-flow-codex:start -->';
const END = '<!-- sd0x-dev-flow-codex:end -->';

const ANCHORS = Object.freeze([
  Object.freeze({
    id: 'completion-fingerprint',
    text: 'Completion evidence belongs to the exact current worktree fingerprint.'
  }),
  Object.freeze({
    id: 'freshness-after-edit',
    text: 'An edit invalidates stale evidence and re-opens every gate required by the new fingerprint.'
  }),
  Object.freeze({
    id: 'execution-is-evidence',
    text: 'Declaring is not executing, summaries are not completion, and fixing is not verifying.'
  }),
  Object.freeze({
    id: 'configured-primary-authority',
    text: 'Only one configured read-only primary reviewer may satisfy the review gate; no substitute or parent prose has gate authority.'
  }),
  Object.freeze({
    id: 'deterministic-verification',
    text: 'Only the deterministic verifier may satisfy verification, after review passes for the same fingerprint.'
  }),
  Object.freeze({
    id: 'runtime-integrity',
    text: 'Protected runtime state, evidence authenticity, secret redaction, and fail-closed activation cannot be bypassed.'
  }),
  Object.freeze({
    id: 'gate-supremacy',
    text: 'Context pressure, session length, or a request to finish never turns a pending or failed gate into a pass.'
  })
]);

const DEFAULTS = Object.freeze([
  'Choose the implementation path, batching, investigation depth, and focused checks from repository evidence.',
  'Continue autonomously through reversible, in-scope work; ordinary uncertainty alone is not a reason to hand control back.',
  'Ask only when material ambiguity changes the intended outcome or when new authority is required for an irreversible or external action.',
  'Run review before verification for code or configuration changes; documentation-only work still requires review and may omit deterministic verification.'
]);

const GUIDANCE = Object.freeze([
  'Prefer concise progress updates, root-cause fixes, behavior-focused tests, and documentation that preserves durable engineering context.'
]);

function contractMarker() {
  return `<!-- sd0x-workflow-contract:v${CONTRACT_SCHEMA_VERSION} -->`;
}

function renderManagedBlock() {
  const anchors = ANCHORS.map((anchor, index) =>
    `${index + 1}. **${anchor.id}.** ${anchor.text}`
  ).join('\n');
  const defaults = DEFAULTS.map((item) => `- ${item}`).join('\n');
  const guidance = GUIDANCE.map((item) => `- ${item}`).join('\n');
  return `${START}
## sd0x Dev Flow

${contractMarker()}
<!-- sd0x-skill-migration-boundary:v2 live=plugin/sd0x-dev-flow-codex/skills legacy-packs=migration/packs staging=migration/staging candidates=migration/candidates -->

Hooks report fingerprint-bound facts; the model owns the path, batching, timing, and depth of the work inside the anchors below. Instructions resolve Anchor-first: project guidance outside this managed block may refine Defaults and Guidance, but cannot downgrade an Anchor.

### Anchors

This is the closed non-negotiable register:

${anchors}

### Defaults

${defaults}

When repository facts justify departing from a Default, state one concise \`[SD0X_DEVIATION] rule=... default=... chosen=... reason=... signal=...\` line and continue. A deviation is an explanation, never gate evidence or authority to weaken an Anchor.

### Guidance

${guidance}

Use \`$sd0x-dev-flow-codex:review\` for the configured primary and \`$sd0x-dev-flow-codex:verify\` for deterministic verification. After any fix, review the new fingerprint again. Never claim a gate passed without runtime-recorded evidence.
${END}`;
}

const MANAGED_BLOCK = renderManagedBlock();
const MANAGED_BLOCK_SHA256 = crypto.createHash('sha256')
  .update(MANAGED_BLOCK)
  .digest('hex');

function inspectManagedGuidance(content) {
  if (typeof content !== 'string') {
    return { status: 'missing', contract_version: null, sha256: null };
  }
  const start = content.indexOf(START);
  const end = content.indexOf(END);
  if (start < 0 && end < 0) {
    return { status: 'missing', contract_version: null, sha256: null };
  }
  if (start < 0 || end < start || content.indexOf(START, start + START.length) >= 0 ||
      content.indexOf(END, end + END.length) >= 0) {
    return { status: 'malformed', contract_version: null, sha256: null };
  }
  const block = content.slice(start, end + END.length);
  const versionMatch = /<!-- sd0x-workflow-contract:v(\d+) -->/.exec(block);
  const sha256 = crypto.createHash('sha256').update(block).digest('hex');
  return {
    status: block === MANAGED_BLOCK ? 'current' : 'stale',
    contract_version: versionMatch ? Number(versionMatch[1]) : null,
    sha256
  };
}

function changeClass(summary) {
  if (!summary.requires_review) return 'clean';
  return summary.requires_verify ? 'code-or-config' : 'documentation';
}

function stateEnvelope(eventName, summary) {
  return {
    schema_version: STATE_SIGNAL_SCHEMA_VERSION,
    contract_version: CONTRACT_SCHEMA_VERSION,
    event: eventName,
    fingerprint: summary.fingerprint,
    change_class: summary.change_class || changeClass(summary),
    file_count: Array.isArray(summary.files) ? summary.files.length : 0,
    requires_review: summary.requires_review,
    requires_verify: summary.requires_verify,
    review_provider: summary.review_provider,
    reviewer_authority: 'configured-primary-only',
    review: summary.review,
    verify: summary.verify,
    next_action: summary.next_action,
    reason: summary.reason
  };
}

function formatStateSignal(eventName, summary) {
  return `${STATE_SIGNAL_PREFIX} ${JSON.stringify(stateEnvelope(eventName, summary))}`;
}

module.exports = {
  ANCHORS,
  CONTRACT_SCHEMA_VERSION,
  DEFAULTS,
  END,
  GUIDANCE,
  MANAGED_BLOCK,
  MANAGED_BLOCK_SHA256,
  START,
  STATE_SIGNAL_PREFIX,
  STATE_SIGNAL_SCHEMA_VERSION,
  changeClass,
  contractMarker,
  formatStateSignal,
  inspectManagedGuidance,
  renderManagedBlock,
  stateEnvelope
};
