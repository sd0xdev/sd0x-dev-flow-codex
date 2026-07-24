# Alias Capability Refresh for Codex 0.144.4

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-07-14
> **Implementation Base SHA**: `526d7227abbb4d172c79153007235f2aa33ba0a6`
> **Status**: Candidate Complete
> **Priority**: P0
> **Depends On**: [R4 — Alias Registry Capability](./2026-07-10-skill-alias-capability-r4.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

<!-- sd0x-alias-capability-owner:v1 {"codex_version":"codex-cli 0.144.4","decision":"mapping-only","decision_sha256":"a43f805b790f3e62922608328d4b6d7eea113e8999f583a2be027cb98524a1f2","registry_mechanism":null,"tested_at":"2026-07-14T21:38:33+08:00"} -->

## Background

Codex changed from `0.144.1` to `0.144.4`. The completed R4 request is immutable historical evidence for the earlier CLI version, so the version-bound registry probe needs a separate refresh transaction before current migration audits can rely on it.

## Requirements

- Re-run the repository-only alias capability probe against Codex `0.144.4`.
- Preserve the mapping-only decision unless an inspectable registry exclusion mechanism is proven.
- Bind the refreshed decision to this request so future version or timestamp drift requires a new capability request.

## Scope

| Scope | Description |
|---|---|
| In | Version-bound probe dump、decision metadata、disposition/docs synchronization、owner-request regression |
| Out | Rewriting the completed R4 ticket、creating live aliases、changing the core allowlist |

## Related Files

| File | Action | Description |
|---|---|---|
| `migration/alias-capability.json` | Update | Bind Codex version、dump hash、timestamp and owner request |
| `migration/evidence/alias-registry-dump.json` | Update | Store normalized Codex 0.144.4 probe output |
| `migration/source-disposition.json` | Update | Synchronize the mapping-only version decision |
| `scripts/skill-migration-audit.js` | Update | Reject missing or stale capability owner requests |
| `test/skill-migration.test.js` | Update | Lock request/version/timestamp synchronization |
| `test/skill-manifest.test.js` | Update | Lock the initialized decision version |
| `docs/PROJECT-MIGRATION-GUIDE.md` | Update | Document the current repository-only CLI evidence |
| `docs/features/skill-toolkit-migration/2-tech-spec.md` | Update | Record the refresh transaction and current decision |

## Acceptance Criteria

- [x] Repository-only probe records exact Codex `0.144.4` output and reproduces the committed normalized dump byte-for-byte.
- [x] Refreshed evidence still proves explicit invocation while exposing no automatic-candidate exclusion mechanism.
- [x] Decision、dump、disposition、initializer、tests and migration docs agree on `codex-cli 0.144.4`.
- [x] `migration/alias-capability.json` points to this acceptance-ready request and records the exact probe timestamp.
- [x] Source audit rejects a missing owner request or a request whose Codex version/tested-at differs from the decision.
- [x] The completed Codex 0.144.1 R4 ticket remains unchanged as historical evidence.

## Progress

| Phase | Status | Note |
|---|---|---|
| Analysis | Done | A CLI version change requires a new capability transaction under the tech-spec deferred path |
| Development | Done | Decision and audit now bind the refresh owner request |
| Testing | Done | Probe、manifest and migration regressions pass against the refreshed evidence |
| Acceptance | Candidate Complete | Codex version: `codex-cli 0.144.4`; Tested at: `2026-07-14T21:38:33+08:00`; Alias decision: `mapping-only`; Registry mechanism: `null`; awaiting fresh review/verify closure |

## References

- [Tech Spec](../2-tech-spec.md)
- [R4 — Alias Registry Capability](./2026-07-10-skill-alias-capability-r4.md)
