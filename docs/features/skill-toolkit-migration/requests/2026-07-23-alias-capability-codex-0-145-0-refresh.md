# Alias Capability Refresh for Codex 0.145.0

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-07-23
> **Implementation Base SHA**: `629c6f78fc1d37435051a5205ab916574517fe3f`
> **Status**: Candidate Complete
> **Priority**: P0
> **Depends On**: [Codex 0.144.6 Refresh](./2026-07-23-alias-capability-codex-0-144-6-refresh.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

<!-- sd0x-alias-capability-owner:v1 {"codex_version":"codex-cli 0.145.0","decision":"mapping-only","decision_sha256":"7716e1ab942cc937c5658b1e352b0aff50084f5126df24e7f09f9eea60dd71d1","registry_mechanism":null,"tested_at":"2026-07-23T17:08:50+08:00"} -->

## Background

The repository-only Codex CLI changed from `0.144.6` to `0.145.0` during the
deterministic Wave 3 verification gate. Alias capability evidence is intentionally
version-bound, so verification correctly stopped until a fresh isolated probe
re-established the registry boundary.

## Requirements

- Re-run the repository-only alias capability probe against Codex `0.145.0`.
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
| `migration/evidence/alias-registry-dump.json` | Update | Store normalized Codex 0.145.0 output |
| `migration/source-disposition.json` | Update | Synchronize the version-bound mapping-only decision |
| `scripts/initialize-skill-disposition.js` | Update | Initialize the current audited version |
| `test/skill-migration.test.js` | Update | Lock current evidence and historical fixtures |
| `docs/PROJECT-MIGRATION-GUIDE.md` | Update | Document the current repository-only CLI boundary |

## Acceptance Criteria

- [x] The repository-only probe records exact Codex `0.145.0` output.
- [x] Fresh output is identical to the prior normalized schema except for the bound CLI version.
- [x] Explicit invocation succeeds and the neutral catalog still contains the alias.
- [x] No automatic-candidate exclusion field or inspectable registry mechanism exists.
- [x] Decision、dump、disposition、initializer and current migration docs agree on `codex-cli 0.145.0`.
- [x] Historical 0.144.1、0.144.4 and 0.144.6 R4 requests remain unchanged.
- [x] Decision evidence hash-binds the complete historical owner chain and each refresh depends on its immediate predecessor.

## Progress

| Phase | Status | Note |
|---|---|---|
| Analysis | Complete | The CLI version drift correctly failed deterministic verification and required a fresh R4 transaction. |
| Development | Complete | Normalized dump、decision artifact、owner binding and current-version documentation are synchronized. |
| Testing | Complete | Isolated read-only explicit invocation returned the exact marker; schema exclusion fields remain empty. |
| Acceptance | Candidate Complete | Codex version: `codex-cli 0.145.0`; Tested at: `2026-07-23T17:08:50+08:00`; Alias decision: `mapping-only`; Registry mechanism: `null`; awaiting review/verify closure. |

## References

- [Tech Spec](../2-tech-spec.md)
- [Codex 0.144.6 Refresh](./2026-07-23-alias-capability-codex-0-144-6-refresh.md)
