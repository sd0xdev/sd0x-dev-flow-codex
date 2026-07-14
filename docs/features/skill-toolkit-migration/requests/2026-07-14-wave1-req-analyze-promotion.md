# Wave 1 Req-Analyze Core Promotion

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-07-14
> **Implementation Base SHA**: `8e3efb425e3848cb537beda2101d16014114fe3d`
> **Status**: Candidate Complete
> **Priority**: P0
> **Depends On**: [R4 — Alias Registry Capability](./2026-07-10-skill-alias-capability-r4.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

Wave 1 needs the problem-space lifecycle entrypoint before solution design and execution tickets can be formally promoted. This ticket is the sole gate owner for `req-analyze/default` and source skill `req-analyze`.

## Requirements

- Adapt the pinned source workflow into a Codex-native `req-analyze` core skill without solution-design or request-tracking responsibilities.
- Complete the candidate-to-live promotion and durable evidence transaction for exactly `req-analyze/default`.

## Scope

| Scope | Description |
|---|---|
| In | Candidate adaptation、routing contract、core promotion、closure and promotion evidence |
| Out | `tech-spec` implementation、planning-pack skills、later waves |

## Related Files

| File | Action | Description |
|---|---|---|
| `migration/staging/req-analyze/` | Read | Pinned source payload |
| `migration/candidates/req-analyze/` | New | Audited Codex-native candidate |
| `plugin/sd0x-dev-flow-codex/skills/req-analyze/` | New | Final core payload |
| `test/req-analyze-default-routing.test.js` | New | Trusted routing harness |
| `migration/source-disposition.json` | Update | Capabilities、operations、state and gate owner |
| `docs/PROJECT-MIGRATION-GUIDE.md` | Update | Wave and reload evidence |

## Acceptance Criteria

- [x] Candidate preserves problem-space analysis and 5-Why/stakeholder/FR-NFR behavior while excluding architecture and per-task tracking.
- [x] `migration-contract.json` closes provenance、routing、capabilities and operations for `req-analyze/default` with no Claude-only runtime assumptions.
- [x] Generated routing tests prove positive lifecycle triggers and negative `tech-spec`/`create-request` boundaries.
- [x] Candidate preflight audit passes and binds the exact payload tree and trusted behavior test.
- [x] Final core payload and disposition state pass move-after-preflight global audit、review and deterministic verification.
- [x] R3 transaction inputs are ready: AC evidence、exact final payload/disposition and current subject gates can be bound by closure, then by a durable `promotion` record after docs review and fresh deterministic verification on the resulting Completed-request fingerprint.
- [x] Repository-only plugin reload/status confirms the promoted skill is discoverable without changing user-level `CODEX_HOME`.

## Progress

| Phase | Status | Note |
|---|---|---|
| Analysis | Complete | Pinned source、candidate contract and Codex-native adaptation boundaries reviewed |
| Development | Complete | Revised candidate preflight `fd7189b3…145da34` passed after review fixes; exact payload moved to final core path without reload |
| Testing | Complete | Full `npm run check` passes 319/319 and review/verify gates passed on fingerprint `2938ad3e…10ad` after closure-drift and R3 gate-sequence regressions were added |
| Acceptance | Candidate Complete | Fresh isolated verifier returned all seven ACs Complete, but AC 6 and the overall verdict were Medium confidence；R3 closure remains intentionally blocked until every AC is High confidence |

## References

- [Tech Spec](../2-tech-spec.md)
- [R4 — Alias Registry Capability](./2026-07-10-skill-alias-capability-r4.md)
