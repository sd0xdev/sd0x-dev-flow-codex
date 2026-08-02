# Contract-driven autonomy requirements

## Status

Approved by the repository owner on 2026-08-01 for implementation and release.

## Source provenance

The bounded adaptation source is `sd0xdev/sd0x-dev-flow` release `v4.1.0`, commit `77d0e7b9181a8dd697ea80073061e64e602cc47b`, under MIT. Selected source bytes:

| Source | SHA-256 | Classification |
| --- | --- | --- |
| `rules/discretion.md` | `505fc8dea8ea2c0a3292f9db139b350e2d53d95be0bfb45c8c7eb1f172c91f51` | instruction contract |
| `rules/auto-loop.md` | `9a62c730f08848b758ed20fdaeb6aa22d2879e88ec8c28e7c45569a254be95bb` | completion semantics |
| `hooks/post-tool-review-state.sh` | `3cea3e48588cda35c336bdac46e1bc73f2c186d3e48668f32293014d567ac3b8` | Claude runtime integration reference |
| `test/rules/discretion-tiers.test.js` | `a125ffa22c73d87ecbdcfd30e6c1d8ba4824e6c710f5c68c89ab97843e1573d5` | closed-register validation reference |
| `test/hooks/auto-loop-state.test.js` | `1e1c04bfc5b69a9bb06b39211af72fa75f2aceda71bfb223faf7666beda1895e` | factual-state validation reference |

Local uncommitted source changes, Claude payload shapes, sentinel parsing, dual-review dispatch, severity-based gate weakening, fixed round caps, and hook bypasses are excluded.

## Acceptance criteria

- AC1: One versioned canonical contract defines a closed Anchor register plus Default and Guidance behavior without duplicating state transitions.
- AC2: Setup preserves user-authored `AGENTS.md` content and installs guidance that trusts the model with reversible in-scope choices while keeping gate authority non-negotiable.
- AC3: Codex hooks emit a schema-versioned `[SD0X_STATE]` factual envelope for lifecycle state without leaking changed paths or porting Claude event assumptions.
- AC4: The configured primary remains the only review authority; all P0/P1/P2 findings remain blocking and `test-review` stays non-gating.
- AC5: Doctor identifies missing, stale, malformed, and current managed guidance for enabled projects.
- AC6: Runtime/setup/hook/doctor/payload tests cover the contract, and Node.js 24 focused checks plus `npm run check` pass.
- AC7: Skill or payload changes are reloaded with `dev:local:unlink`, `dev:local:link`, and `dev:local:status` before final fingerprint review and verification.
- AC8: A new synchronized plugin version is merged to `main`, CI passes, and the GitHub release assets are publicly available.
