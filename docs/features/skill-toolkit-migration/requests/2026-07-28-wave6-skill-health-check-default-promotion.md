# Wave 6 Skill Health Check Default Core Promotion

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-07-28
> **Implementation Base SHA**: `6bbdfbcf1294fb8cacd4efaa712ed3c51dfabc20`
> **Status**: Completed
> **Priority**: P0
> **Depends On**: [R4 — Alias Registry Capability](./2026-07-28-formal-plugin-delivery-model.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

`skill-health-check` source behavior is assigned to the canonical `skill-health-check/default` owner. This ticket owns that exact promotion unit and its Codex-native delivery evidence.

## Requirements

- Preserve the bounded Audit skill discovery boundaries, progressive loading, resources, safety, and verification quality. workflow while replacing source-runtime assumptions with Codex-native tools, authority, and evidence contracts.
- Keep `skill-health-check/default` as the only positive owner for its exact prompt contract.

## Scope

| Scope | Description |
|---|---|
| In | Audit and promote the `skill-health-check/default` payload, routing contract, and durable completion evidence. |
| Out | Other wave units, compatibility entrypoints, and external service authentication |

## Related Files

| File | Action | Description |
|---|---|---|
| `migration/staging/skill-health-check/` | Read | Canonical source evidence |
| `migration/candidates/skill-health-check/` | New | Audited Codex-native candidate |
| `plugin/sd0x-dev-flow-codex/skills/skill-health-check/` | Update | Final distributable plugin payload |
| `test/skill-health-check-default-routing.test.js` | New | Trusted routing contract |
| `migration/source-disposition.json` | Update | Unit ownership and delivery evidence |

## Acceptance Criteria

- [x] Candidate preserves the complete Audit skill discovery boundaries, progressive loading, resources, safety, and verification quality. workflow and its meaningful failure boundaries.
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
| Development | Complete | Formal-plugin candidate payload `3f5379bda58f3b2a0cfd90d701502f47325001468c885539e9f86c066cd48e9b` preserves the accepted predecessor behavior and package boundary. |
| Testing | Complete | Routing, semantic, and static checks passed. Preflight `0f92d394445a09b3aa8b6d130591cf11ef66332c10be2ca1f36b259f44ae6d4c`. Final audit `79c4f297a1bf791fc9352764b95d3320283e18f9a15d5e45d0cb407d6a35255e` passed. |
| Acceptance | Complete | Runtime-owned R3 closure and promotion evidence bind this Completed owner. |

## References

- Tech Spec: [Skill Toolkit Migration](../2-tech-spec.md)
