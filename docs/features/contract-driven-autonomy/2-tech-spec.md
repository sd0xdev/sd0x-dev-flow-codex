# Contract-driven autonomy technical specification

## Design

`scripts/runtime/workflow-contract.js` is the canonical owner for contract versioning, the closed seven-item Anchor register, managed guidance rendering, drift inspection, and the factual state-envelope schema. It is static policy metadata: state transitions remain in `state.js`, worktree classification remains in `worktree.js`, and `hook.js` remains a Codex event adapter.

Setup imports the canonical rendered block instead of maintaining its own copy. User-authored `AGENTS.md` bytes outside the managed markers are preserved. Project guidance may refine Defaults and Guidance, while Anchor-first resolution prevents it from downgrading review, verification, evidence, activation, or runtime-integrity requirements.

`state.summarize()` exposes a stable change class. Hook messages serialize the summary as `[SD0X_STATE]` with explicit schema and contract versions, exact fingerprint, change class, requirement flags, provider, configured-primary-only authority, gate states, and next-action reason. Paths are represented only by a count. Natural-language text may explain a fact but does not become gate evidence.

Doctor compares the installed managed block with the canonical bytes whenever the project is enabled and reports current, stale, missing, or malformed status. The payload manifest binds the new runtime module and every updated distributable byte.

## Authority boundaries

- The model owns reversible path selection, batching, timing, investigation depth, and focused checks.
- Runtime owns fingerprints, gate state, evidence validation, activation, protected paths, and deterministic verification dispatch.
- The configured primary owns the independent review verdict.
- The user retains irreversible and external-action authority.

`[SD0X_DEVIATION]` documents a context-backed departure from a Default. It is never parsed as evidence, persisted as gate authority, or accepted for an Anchor.

## Intentional differences from the source

The Codex implementation keeps the stricter single-primary gate: P0, P1, and P2 remain blocking, no degraded pass exists, and every new fingerprint receives a fresh scan. It does not import Claude hook payloads, `.claude_review_state.json`, sentinels, fixed round caps, dual review, `HOOK_BYPASS`, or a synthetic post-compaction event. Any future event integration requires an official Codex capability and an explicit adapter with wire fixtures.

## Validation

- Contract tests lock exact Anchor identities, precedence, guidance drift states, privacy, and envelope fields.
- Setup tests prove idempotence, user-content preservation, model-trust language, and runtime entrypoint inventory.
- Hook tests assert structured facts and retain hard failures only for safety/activation/runtime-integrity cases.
- Doctor tests cover enabled-project missing/current/stale guidance.
- Release checks and the payload manifest prove distributable reachability.
