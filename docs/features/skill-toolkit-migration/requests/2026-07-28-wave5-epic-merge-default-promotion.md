# Wave 5 Epic Merge Default Core Promotion

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-07-28
> **Implementation Base SHA**: `6bbdfbcf1294fb8cacd4efaa712ed3c51dfabc20`
> **Status**: Completed
> **Priority**: P0
> **Depends On**: [R4 — Alias Registry Capability](./2026-07-28-formal-plugin-delivery-model.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

`epic-merge` source behavior is assigned to the canonical `epic-merge/default` owner. This ticket owns that exact promotion unit and its Codex-native delivery evidence.

## Requirements

- Preserve the bounded A dependency-ordered squash-merge workflow for one validated stacked pull-request chain. workflow while replacing source-runtime assumptions with Codex-native tools, authority, and evidence contracts.
- Keep `epic-merge/default` as the only positive owner for its exact prompt contract.

## Scope

| Scope | Description |
|---|---|
| In | Audit and promote the `epic-merge/default` payload, routing contract, and durable completion evidence. |
| Out | Other wave units, compatibility entrypoints, and external service authentication |

## Related Files

| File | Action | Description |
|---|---|---|
| `migration/staging/epic-merge/` | Read | Canonical source evidence |
| `migration/candidates/epic-merge/` | New | Audited Codex-native candidate |
| `plugin/sd0x-dev-flow-codex/skills/epic-merge/` | Update | Final distributable plugin payload |
| `test/epic-merge-default-routing.test.js` | New | Trusted routing contract |
| `migration/source-disposition.json` | Update | Unit ownership and delivery evidence |

## Acceptance Criteria

- [x] Candidate preserves the complete A dependency-ordered squash-merge workflow for one validated stacked pull-request chain. workflow and its meaningful failure boundaries.
- [x] Contract binds every assigned source name to this single canonical promotion unit.
- [x] Compatibility aliases remain mapping-only and add no discovered skill entrypoints.
- [x] Trusted routing tests distinguish positive prompts from adjacent skill boundaries.
- [x] Candidate preflight binds exact payload and behavioral-test identity.
- [x] Final plugin destination and move-window comparison are fixed for the accepted candidate bytes.
- [x] R3 closure inputs identify this exact request, promotion unit, evidence kind, and final-fingerprint fields.

## Progress

| Phase | Status | Note |
|---|---|---|
| Analysis | Complete | Source ownership, mode boundary, and target package are fixed by the migration registry. |
| Development | Complete | Formal-plugin candidate payload `9eab20bd084c7bc144731215a965d8f9bebb6c7ec5449cb98f4919fbfbbc8727` preserves the accepted predecessor behavior and package boundary. |
| Testing | Complete | Routing, semantic, and static checks passed. Preflight `6b7cdbca03a483b22fbfd9c5ca5f06837c63cb1e17606f7c1b2085c187bcc16b`. Final audit `4eb56a2ed8a28e15f26157914fbd170981cb6590192f8d6ba7a201233456136b` passed. |
| Acceptance | Complete | Runtime-owned R3 closure and promotion evidence bind this Completed owner. |

## References

- Tech Spec: [Skill Toolkit Migration](../2-tech-spec.md)
