# Wave 4 Review Branch Runtime Re-promotion

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-07-26
> **Implementation Base SHA**: `2631aaff15b4a829f54ac34c2365887b0cb3e0e1`
> **Status**: Candidate Complete
> **Priority**: P0
> **Depends On**: [Wave 4 Review branch Core Promotion](./2026-07-25-wave4-review-branch-promotion.md), [R4 — Alias Registry Capability](./2026-07-10-skill-alias-capability-r4.md), [Wave 4 Review Default Core Promotion](./2026-07-25-wave4-review-default-promotion.md), [Wave 4 Review Default Runtime Re-promotion](./2026-07-26-wave4-review-default-runtime-repromotion.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

`codex-review-branch` source behavior is assigned to the canonical `review/branch` owner. This ticket owns that exact promotion unit and its Codex-native delivery evidence.

## Requirements

- Preserve the bounded fingerprint-bound code review workflow while replacing source-runtime assumptions with Codex-native tools, authority, and evidence contracts.
- Keep `review/branch` as the only positive owner for its exact prompt contract.
- Keep `codex-review-branch` mapping-only without discovered compatibility entrypoints.

## Scope

| Scope | Description |
|---|---|
| In | Audit and promote the `review/branch` payload, routing contract, and durable completion evidence. |
| Out | Other wave units, compatibility entrypoints, and publication of separate pack repositories |

## Related Files

| File | Action | Description |
|---|---|---|
| `migration/staging/codex-review-branch/` | Read | Canonical source evidence |
| `migration/candidates/review/` | New | Audited Codex-native candidate |
| `plugin/sd0x-dev-flow-codex/skills/review/` | Update | Final core payload |
| `test/review-branch-routing.test.js` | New | Trusted routing contract |
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
| Development | Complete | Candidate payload `2b4b5ea243348b17acadec7042b78950de2a9193cc91992c8e4818916a6bbd42` and its closed behavior contract are complete. |
| Testing | Complete | Preflight `23fb93ecdffb6695c946a4f8c6387c77523e3ff82be4f5648d1c1e5aee83117f` binds the candidate payload, routing tests, and disposition rows. |
| Acceptance | Candidate Complete | Candidate evidence is complete; final audit and durable R3 closure remain pending. |

## References

- Tech Spec: [Skill Toolkit Migration](../2-tech-spec.md)
