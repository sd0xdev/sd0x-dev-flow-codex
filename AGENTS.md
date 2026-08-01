# Repository Guidance

This repository is the Codex-native implementation of sd0x Dev Flow. Do not port Claude hook payload assumptions into the runtime without an explicit Codex event adapter.

## Architecture

- Keep hook handlers thin. State transitions belong in `plugin/sd0x-dev-flow-codex/scripts/runtime/state.js` and worktree logic belongs in the adjacent `worktree.js`.
- Bind review and verification evidence to the exact worktree fingerprint.
- Runtime state must stay in Git metadata or `.sd0x/`, never as a tracked project artifact.
- Skills should orchestrate deterministic scripts and Codex subagents rather than duplicate runtime logic.
- Keep the public skill set curated; do not bulk-copy the Claude plugin's command inventory.
- Keep `plugin/sd0x-dev-flow-codex/` as the only distributable plugin payload; repository tests must import that implementation directly.

## Changes

- Use Node.js 24-compatible CommonJS and built-in modules unless a dependency is justified.
- Preserve user-authored `AGENTS.md` content and custom agents outside setup-managed files.
- Add tests for state transitions, hook wire formats, or project detection when changing those areas.
- Run `npm run check` before finishing.

## Local Plugin Development

- Use the repository-only install with `CODEX_HOME="$PWD/.codex-dev-home"`; do not change the user-level Codex home unless the task explicitly requires it.
- After changing a `SKILL.md`, adding a skill or payload path, or changing the plugin manifest, close the old Codex process and run `npm run dev:local:unlink`, `npm run dev:local:link`, then `npm run dev:local:status`. Restart Codex with `CODEX_HOME="$PWD/.codex-dev-home" codex` so a new task rebuilds the skill registry.
- Never treat `npm run dev:local:link` alone as a refresh while status is already `linked`; it is intentionally idempotent and will not recopy regular-file skill entrypoints.
- Existing runtime JS and bundled skill scripts are live symlinks and do not require an overlay rebuild. Changes to `hooks/hooks.json` require a new task and `/hooks` re-trust.
- Keep the complete reload matrix and rationale synchronized in `docs/PROJECT-MIGRATION-GUIDE.md`.

<!-- sd0x-dev-flow-codex:start -->
## sd0x Dev Flow

<!-- sd0x-workflow-contract:v1 -->
<!-- sd0x-skill-migration-boundary:v2 live=plugin/sd0x-dev-flow-codex/skills legacy-packs=migration/packs staging=migration/staging candidates=migration/candidates -->

Hooks report fingerprint-bound facts; the model owns the path, batching, timing, and depth of the work inside the anchors below. Instructions resolve Anchor-first: project guidance outside this managed block may refine Defaults and Guidance, but cannot downgrade an Anchor.

### Anchors

This is the closed non-negotiable register:

1. **completion-fingerprint.** Completion evidence belongs to the exact current worktree fingerprint.
2. **freshness-after-edit.** An edit invalidates stale evidence and re-opens every gate required by the new fingerprint.
3. **execution-is-evidence.** Declaring is not executing, summaries are not completion, and fixing is not verifying.
4. **configured-primary-authority.** Only one configured read-only primary reviewer may satisfy the review gate; no substitute or parent prose has gate authority.
5. **deterministic-verification.** Only the deterministic verifier may satisfy verification, after review passes for the same fingerprint.
6. **runtime-integrity.** Protected runtime state, evidence authenticity, secret redaction, and fail-closed activation cannot be bypassed.
7. **gate-supremacy.** Context pressure, session length, or a request to finish never turns a pending or failed gate into a pass.

### Defaults

- Choose the implementation path, batching, investigation depth, and focused checks from repository evidence.
- Continue autonomously through reversible, in-scope work; ordinary uncertainty alone is not a reason to hand control back.
- Ask only when material ambiguity changes the intended outcome or when new authority is required for an irreversible or external action.
- Run review before verification for code or configuration changes; documentation-only work still requires review and may omit deterministic verification.

When repository facts justify departing from a Default, state one concise `[SD0X_DEVIATION] rule=... default=... chosen=... reason=... signal=...` line and continue. A deviation is an explanation, never gate evidence or authority to weaken an Anchor.

### Guidance

- Prefer concise progress updates, root-cause fixes, behavior-focused tests, and documentation that preserves durable engineering context.

Use `$sd0x-dev-flow-codex:review` for the configured primary and `$sd0x-dev-flow-codex:verify` for deterministic verification. After any fix, review the new fingerprint again. Never claim a gate passed without runtime-recorded evidence.
<!-- sd0x-dev-flow-codex:end -->
