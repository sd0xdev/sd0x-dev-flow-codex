# Wave 5 Merge Prep Default Core Promotion

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-07-28
> **Implementation Base SHA**: `6bbdfbcf1294fb8cacd4efaa712ed3c51dfabc20`
> **Status**: Completed
> **Priority**: P0
> **Depends On**: [R4 — Alias Registry Capability](./2026-07-28-formal-plugin-delivery-model.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

`merge-prep` source behavior is assigned to the canonical `merge-prep/default` owner. This ticket owns that exact promotion unit and its Codex-native delivery evidence.

## Requirements

- Preserve the bounded Analyze source and target branches for commits, conflicts, and merge risk without merging. workflow while replacing source-runtime assumptions with Codex-native tools, authority, and evidence contracts.
- Keep `merge-prep/default` as the only positive owner for its exact prompt contract.

## Scope

| Scope | Description |
|---|---|
| In | Audit and promote the `merge-prep/default` payload, routing contract, and durable completion evidence. |
| Out | Other wave units, compatibility entrypoints, and external service authentication |

## Related Files

| File | Action | Description |
|---|---|---|
| `migration/staging/merge-prep/` | Read | Canonical source evidence |
| `migration/candidates/merge-prep/` | New | Audited Codex-native candidate |
| `plugin/sd0x-dev-flow-codex/skills/merge-prep/` | Update | Final distributable plugin payload |
| `test/merge-prep-default-routing.test.js` | New | Trusted routing contract |
| `migration/source-disposition.json` | Update | Unit ownership and delivery evidence |

## Acceptance Criteria

- [x] Candidate preserves the complete Analyze source and target branches for commits, conflicts, and merge risk without merging. workflow and its meaningful failure boundaries.
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
| Development | Complete | Formal-plugin candidate payload `ae7b0a1e6585c703431f90b996d932e6809045bf11a8d729c5d506b29f911a56` preserves the accepted predecessor behavior and package boundary. |
| Testing | Complete | Routing, semantic, and static checks passed. Preflight `710316bb08b5c1f7c3d954d43702e2dc6597f6596a913b2a2c5121a345b09d3f`. Final audit `50832b4b10c30ae3a547100b1e0e63b162b92e0dd4a2715e01dc8946fd8bdf4b` passed. |
| Acceptance | Complete | Runtime-owned R3 closure and promotion evidence bind this Completed owner. |

## References

- Tech Spec: [Skill Toolkit Migration](../2-tech-spec.md)
