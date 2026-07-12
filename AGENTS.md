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

- Use Node.js 18-compatible CommonJS and built-in modules unless a dependency is justified.
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

<!-- sd0x-skill-migration-boundary:v1 core=bug-fix,create-request,doctor,feature-dev,remind,req-analyze,review,setup,tech-spec,verify non-core=migration/packs staging=migration/staging candidates=migration/candidates -->

- Treat the current worktree fingerprint as the unit of review and verification.
- Before completing code or configuration changes, run `$sd0x-dev-flow-codex:review`, then `$sd0x-dev-flow-codex:verify`.
- For documentation-only changes, review is required but deterministic verification is optional.
- After any fix, rerun review because the previous gate belongs to the previous fingerprint.
- Run the configured `sd0x_codex_primary_reviewer` or `sd0x_claude_primary_reviewer` plus `sd0x_reviewer` and `sd0x_test_reviewer` in parallel; keep every perspective independent and read-only.
- Never claim a gate passed without recording evidence through the plugin runtime.
<!-- sd0x-dev-flow-codex:end -->
