# Wave 1 Create-Request Formal Promotion

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-07-14
> **Implementation Base SHA**: `8e3efb425e3848cb537beda2101d16014114fe3d`
> **Status**: In Progress
> **Priority**: P0
> **Depends On**: [R4 — Alias Registry Capability](./2026-07-10-skill-alias-capability-r4.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

`create-request` exists as a user-authorized live bootstrap but has no formal Wave 1 provenance or promotion record. This ticket is the sole gate owner for `create-request/default` and must perform the first real closure-to-promotion E2E.

## Requirements

- Reconcile the live bootstrap with the pinned source and canonical lifecycle contract without losing its hardened closure behavior.
- Complete formal candidate、closure、promotion and reload evidence for exactly `create-request/default`.

## Scope

| Scope | Description |
|---|---|
| In | Bootstrap reconciliation、candidate audit、formal promotion、R3 E2E evidence |
| Out | New request lifecycle features、other Wave 1 units、user-level installation |

## Related Files

| File | Action | Description |
|---|---|---|
| `migration/staging/create-request/` | Read | Pinned source payload |
| `migration/candidates/create-request/` | New | Formal audited candidate |
| `plugin/sd0x-dev-flow-codex/skills/create-request/` | Update | Existing bootstrap final payload |
| `test/create-request-default-routing.test.js` | New | Trusted routing harness |
| `migration/source-disposition.json` | Update | Formal promotion state and owner |
| `docs/PROJECT-MIGRATION-GUIDE.md` | Update | Reload and completion scope |

## Acceptance Criteria

- [x] Candidate reconciliation preserves query-only resolution、Candidate Complete ceiling and runtime-owned durable closure semantics.
- [x] Candidate contract closes source provenance、routing、capabilities and operations without inheriting Claude tool or hook assumptions.
- [x] Routing tests distinguish create/update/status/verify-AC requests from requirements and technical-design ownership.
- [x] Candidate preflight validates exact formal payload despite the existing live bootstrap.
- [ ] Final live re-audit、independent review and deterministic verification pass after replacing/reconciling bootstrap bytes.
- [ ] R3 transaction inputs are ready so this request's closure hash can be consumed by the first real durable `promotion` record after docs review and fresh deterministic verification on the resulting Completed-request fingerprint.
- [ ] Disposition changes from planned bootstrap to promoted and `audit-source` replays the delivered unit evidence.
- [ ] Repository-only unlink/link/status reload confirms the formally promoted skill and keeps user `CODEX_HOME` untouched.

## Progress

| Phase | Status | Note |
|---|---|---|
| Analysis | Complete | Pinned source、Codex-native bootstrap、query-only resolver、Candidate Complete ceiling and runtime closure owner reconciled. |
| Development | Complete | The live bootstrap was restored before each preflight, the adapted payload was completed under `migration/candidates/create-request/`, and exact bytes moved to live only after candidate acceptance. Current payload tree: `85d1518e4609f0557310be0687daf96dac958d2efefd2ee25ec3d8ffb90e3e00`; preflight: `300ef799ee97ecc1b07125e39e9e0837ebdfd90b069cf9c85f346a7428af553e`. |
| Testing | In Progress | Candidate-loaded behavior/routing passes 31/31, including external、internal and dangling feature-directory symlinks、hostile ambient Git selectors、caller-selected Git `PATH` and a 26,000-commit ancestry history beyond the old synchronous output limit. Git environment provider shadowing、benign string data、branch and `require.main` validator regressions pass their focused suites. Final move-after tests、exact-fingerprint review、verify and live re-audit remain pending. |
| Acceptance | Pending | |

## References

- [Tech Spec](../2-tech-spec.md)
- [Wave 1 Tech-Spec Deep Core Promotion](./2026-07-14-wave1-tech-spec-deep-promotion.md)
