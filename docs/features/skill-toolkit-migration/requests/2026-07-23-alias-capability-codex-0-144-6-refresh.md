# Alias Capability Refresh for Codex 0.144.6

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-07-23
> **Implementation Base SHA**: `629c6f78fc1d37435051a5205ab916574517fe3f`
> **Status**: Candidate Complete
> **Priority**: P0
> **Depends On**: [Codex 0.144.4 Refresh](./2026-07-14-alias-capability-codex-0-144-4-refresh.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

<!-- sd0x-alias-capability-owner:v1 {"codex_version":"codex-cli 0.144.6","decision":"mapping-only","decision_sha256":"5e454fdaf27289e3c01c170f07ad33802af7ed976bb28fe972ff5a08d556b201","registry_mechanism":null,"tested_at":"2026-07-23T15:50:04+08:00"} -->

## Background

The repository-only Codex CLI changed from `0.144.4` to `0.144.6` while Wave 3
closure work was in progress. Alias capability evidence is intentionally
version-bound, so source and candidate audits must reject the previous dump until a
fresh isolated probe re-establishes the registry boundary.

## Requirements

- Re-run the repository-only alias capability probe against Codex `0.144.6`.
- Preserve `mapping-only` unless an inspectable exclusion mechanism is proven.
- Bind the refreshed normalized dump and decision to a new immutable owner request.

## Scope

| Scope | Description |
|---|---|
| In | Version-bound probe、normalized dump、decision metadata、disposition/initializer/docs synchronization |
| Out | Live compatibility aliases、manual-only policy、rewriting historical R4 requests |

## Related Files

| File | Action | Description |
|---|---|---|
| `migration/alias-capability.json` | Update | Bind current Codex version、dump and owner request |
| `migration/evidence/alias-registry-dump.json` | Update | Store normalized Codex 0.144.6 output |
| `migration/source-disposition.json` | Update | Synchronize the version-bound mapping-only decision |
| `scripts/initialize-skill-disposition.js` | Update | Initialize the current audited version |
| `test/skill-migration.test.js` | Update | Lock current evidence and historical fixtures |
| `docs/PROJECT-MIGRATION-GUIDE.md` | Update | Document the current repository-only CLI boundary |

## Acceptance Criteria

- [x] The repository-only probe records exact Codex `0.144.6` output.
- [x] Fresh output is identical to the prior normalized schema except for the bound CLI version.
- [x] Explicit invocation succeeds and the neutral catalog still contains the alias.
- [x] No automatic-candidate exclusion field or inspectable registry mechanism exists.
- [x] Decision、dump、disposition、initializer and current migration docs agree on `codex-cli 0.144.6`.
- [x] Historical 0.144.1 and 0.144.4 R4 requests remain unchanged.

## Progress

| Phase | Status | Note |
|---|---|---|
| Analysis | Complete | The CLI version drift correctly failed source audit and required a fresh R4 transaction. |
| Development | Complete | Normalized dump、decision artifact、owner binding and current-version documentation are synchronized. |
| Testing | Complete | Isolated read-only explicit invocation returned the exact marker; schema exclusion fields remain empty. |
| Acceptance | Candidate Complete | Codex version: `codex-cli 0.144.6`; Tested at: `2026-07-23T15:50:04+08:00`; Alias decision: `mapping-only`; Registry mechanism: `null`; awaiting review/verify closure. |

## References

- [Tech Spec](../2-tech-spec.md)
- [R4 — Alias Registry Capability](./2026-07-10-skill-alias-capability-r4.md)
