# Wave 7 Op Session Default Core Promotion

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-07-28
> **Implementation Base SHA**: `6bbdfbcf1294fb8cacd4efaa712ed3c51dfabc20`
> **Status**: Completed
> **Priority**: P0
> **Depends On**: [R4 — Alias Registry Capability](./2026-07-28-formal-plugin-delivery-model.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

`op-session` source behavior is assigned to the canonical `op-session/default` owner. This ticket owns that exact promotion unit and its Codex-native delivery evidence.

## Requirements

- Preserve the bounded Diagnose 1Password CLI session readiness and explain the supported session setup without exposing secrets. workflow while replacing source-runtime assumptions with Codex-native tools, authority, and evidence contracts.
- Keep `op-session/default` as the only positive owner for its exact prompt contract.

## Scope

| Scope | Description |
|---|---|
| In | Audit and promote the `op-session/default` payload, routing contract, and durable completion evidence. |
| Out | Other wave units, compatibility entrypoints, and external service authentication |

## Related Files

| File | Action | Description |
|---|---|---|
| `migration/staging/op-session/` | Read | Canonical source evidence |
| `migration/candidates/op-session/` | New | Audited Codex-native candidate |
| `plugin/sd0x-dev-flow-codex/skills/op-session/` | Update | Final distributable plugin payload |
| `test/op-session-default-routing.test.js` | New | Trusted routing contract |
| `migration/source-disposition.json` | Update | Unit ownership and delivery evidence |

## Acceptance Criteria

- [x] Candidate preserves the complete Diagnose 1Password CLI session readiness and explain the supported session setup without exposing secrets. workflow and its meaningful failure boundaries.
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
| Development | Complete | Formal-plugin candidate payload `e919baaa6c9e7649ec67040de19b8b0fdf51b66ae1676842b9cea15168a173de` preserves the accepted predecessor behavior and package boundary. |
| Testing | Complete | Routing, semantic, and static checks passed. Preflight `d3b584bcf14ff88d504a7d7fdb9d9328b54de749fbdd0ee4253b773927a1532d`. Final audit `5b1c36d41d1db9845c01da0f504f3dcaf0798e72a1dd6f0395e8251f4f9ea196` passed. |
| Acceptance | Complete | Runtime-owned R3 closure and promotion evidence bind this Completed owner. |

## References

- Tech Spec: [Skill Toolkit Migration](../2-tech-spec.md)
