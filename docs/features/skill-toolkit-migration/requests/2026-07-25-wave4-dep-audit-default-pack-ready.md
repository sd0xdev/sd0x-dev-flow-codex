# Wave 4 Dep Audit Default Pack Readiness

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-07-25
> **Implementation Base SHA**: `2631aaff15b4a829f54ac34c2365887b0cb3e0e1`
> **Status**: Completed
> **Priority**: P0
> **Depends On**: [R4 — Alias Registry Capability](./2026-07-10-skill-alias-capability-r4.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

`dep-audit` source behavior is assigned to the canonical `dep-audit/default` owner. This ticket owns that exact promotion unit and its Codex-native delivery evidence.

## Requirements

- Preserve the bounded dependency inventory and advisory audit workflow while replacing source-runtime assumptions with Codex-native tools, authority, and evidence contracts.
- Keep `dep-audit/default` as the only positive owner for its exact prompt contract.

## Scope

| Scope | Description |
|---|---|
| In | Audit and prepare the `dep-audit/default` payload, routing contract, and durable completion evidence. |
| Out | Other wave units, compatibility entrypoints, and publication of separate pack repositories |

## Related Files

| File | Action | Description |
|---|---|---|
| `migration/staging/dep-audit/` | Read | Canonical source evidence |
| `migration/candidates/dep-audit/` | New | Audited Codex-native candidate |
| `migration/packs/quality-pack/dep-audit/` | New | Final quality-pack payload |
| `test/dep-audit-default-routing.test.js` | New | Trusted routing contract |
| `migration/source-disposition.json` | Update | Unit ownership and delivery evidence |

## Acceptance Criteria

- [x] Candidate preserves the complete dependency inventory and advisory audit workflow and its meaningful failure boundaries.
- [x] Contract binds every assigned source name to this single canonical promotion unit.
- [x] Compatibility aliases remain mapping-only and add no discovered skill entrypoints.
- [x] Trusted routing tests distinguish positive prompts from adjacent skill boundaries.
- [x] Candidate preflight binds exact payload and behavioral-test identity.
- [x] Final pack destination and move-window comparison are fixed for the accepted candidate bytes.
- [x] R3 closure inputs identify this exact request, promotion unit, evidence kind, and final-fingerprint fields.

## Progress

| Phase | Status | Note |
|---|---|---|
| Analysis | Complete | Source ownership, mode boundary, and target package are fixed by the migration registry. |
| Development | Complete | Candidate payload `eadc40e26c8c3957960845094732fb16d57761ec7e31e3df368aa77b61c7991a` and its closed behavior contract are complete. |
| Testing | Complete | Preflight `f3fdadd39dfa4d8b0294bbac3ea3dcf83880c4fed55e6eb42c631dcc3d2d12b5` binds the candidate payload, routing tests, and disposition rows. Final pack audit `304d5665eb65df6fca53dad40ea1655cd0a749b5178a36c60f1bae19a8cf6de8` passed. |
| Acceptance | Complete | Independent AC verification, subject-bound review, deterministic verification, and final pack audit passed. The runtime-owned R3 closure and pack-ready evidence bind this exact Completed request. |

## References

- Tech Spec: [Skill Toolkit Migration](../2-tech-spec.md)
