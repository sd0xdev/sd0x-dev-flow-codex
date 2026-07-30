# Wave 6 Doctor Claude Core Promotion

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-07-28
> **Implementation Base SHA**: `6bbdfbcf1294fb8cacd4efaa712ed3c51dfabc20`
> **Status**: Completed
> **Priority**: P0
> **Depends On**: [R4 — Alias Registry Capability](./2026-07-28-formal-plugin-delivery-model.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

`claude-health` source behavior is assigned to the canonical `doctor/claude` owner. This ticket owns that exact promotion unit and its Codex-native delivery evidence.

## Requirements

- Preserve the bounded Diagnose plugin installation, runtime state, reviewer configuration, and project guidance without changing them. workflow while replacing source-runtime assumptions with Codex-native tools, authority, and evidence contracts.
- Keep `doctor/claude` as the only positive owner for its exact prompt contract.
- Keep `claude-health` mapping-only without discovered compatibility entrypoints.

## Scope

| Scope | Description |
|---|---|
| In | Audit and promote the `doctor/claude` payload, routing contract, and durable completion evidence. |
| Out | Other wave units, compatibility entrypoints, and external service authentication |

## Related Files

| File | Action | Description |
|---|---|---|
| `migration/staging/claude-health/` | Read | Canonical source evidence |
| `migration/candidates/doctor/` | New | Audited Codex-native candidate |
| `plugin/sd0x-dev-flow-codex/skills/doctor/` | Update | Final distributable plugin payload |
| `test/doctor-claude-routing.test.js` | New | Trusted routing contract |
| `migration/source-disposition.json` | Update | Unit ownership and delivery evidence |

## Acceptance Criteria

- [x] Candidate preserves the complete Diagnose plugin installation, runtime state, reviewer configuration, and project guidance without changing them. workflow and its meaningful failure boundaries.
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
| Development | Complete | Formal-plugin candidate payload `e0209886f561f816d2e037677ff3e0f16aa9ef2e9757976d2fe3a1fbdfad61fb` preserves the accepted predecessor behavior and package boundary. |
| Testing | Complete | Routing, semantic, and static checks passed. Preflight `78fe5f73c16555e04146bffafbd2befe150b4cec4f779c5def70af4033261693`. Final audit `e7d4c4ece3dda185e7a407b1401e92dad7d34454368b8dc5bb2dbdfa5de2cc9d` passed. |
| Acceptance | Complete | Runtime-owned R3 closure and promotion evidence bind this Completed owner. |

## References

- Tech Spec: [Skill Toolkit Migration](../2-tech-spec.md)
