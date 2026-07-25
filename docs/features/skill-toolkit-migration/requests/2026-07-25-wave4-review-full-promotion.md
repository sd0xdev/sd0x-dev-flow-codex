# Wave 4 Review Full Core Promotion

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-07-25
> **Implementation Base SHA**: `2631aaff15b4a829f54ac34c2365887b0cb3e0e1`
> **Status**: Completed
> **Priority**: P0
> **Depends On**: [R4 — Alias Registry Capability](./2026-07-10-skill-alias-capability-r4.md), [Wave 4 Review Default Core Promotion](./2026-07-25-wave4-review-default-promotion.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

`codex-review` source behavior is assigned to the canonical `review/full` owner. This ticket owns that exact promotion unit and its Codex-native delivery evidence.

## Requirements

- Preserve the bounded fingerprint-bound code review workflow while replacing source-runtime assumptions with Codex-native tools, authority, and evidence contracts.
- Keep `review/full` as the only positive owner for its exact prompt contract.
- Keep `codex-review` mapping-only without discovered compatibility entrypoints.

## Scope

| Scope | Description |
|---|---|
| In | Audit and promote the `review/full` payload, routing contract, and durable completion evidence. |
| Out | Other wave units, compatibility entrypoints, and publication of separate pack repositories |

## Related Files

| File | Action | Description |
|---|---|---|
| `migration/staging/codex-review/` | Read | Canonical source evidence |
| `migration/candidates/review/` | New | Audited Codex-native candidate |
| `plugin/sd0x-dev-flow-codex/skills/review/` | Update | Final core payload |
| `test/review-full-routing.test.js` | New | Trusted routing contract |
| `migration/source-disposition.json` | Update | Unit ownership and delivery evidence |

## Acceptance Criteria

- [x] Candidate preserves the complete fingerprint-bound code review workflow and its meaningful failure boundaries.
- [x] Contract binds every assigned source name to this single canonical promotion unit.
- [x] Compatibility aliases remain mapping-only and add no discovered skill entrypoints.
- [x] Trusted routing tests distinguish positive prompts from adjacent skill boundaries.
- [x] Candidate preflight binds exact payload and behavioral-test identity.
- [x] Final core destination and move-window comparison are fixed for the accepted candidate bytes.
- [x] R3 closure inputs identify this exact request, promotion unit, evidence kind, and final-fingerprint fields.

## Progress

| Phase | Status | Note |
|---|---|---|
| Analysis | Complete | Source ownership, mode boundary, and target package are fixed by the migration registry. |
| Development | Complete | Candidate payload `0819aac5d91e9a0683dd82a5a0becc0a8dcb75cbe4c9ceb93858cb3cf8dc476f` and its closed behavior contract are complete. |
| Testing | Complete | Preflight `250a43358961fe783b614e44a76126087a4780217888514af75ad380b120c487` binds the candidate payload, routing tests, and disposition rows. Final audit `90a0d3bb162a450be994fdbaf9f7982be08d046f4fb416968821913d13b00fa0` passed. |
| Acceptance | Complete | Independent AC verification, subject-bound review, deterministic verification, and final core audit passed. The runtime-owned R3 closure and promotion evidence bind this exact Completed request. |

## References

- Tech Spec: [Skill Toolkit Migration](../2-tech-spec.md)
