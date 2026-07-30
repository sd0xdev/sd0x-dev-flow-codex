# Wave 7 Feature Verify Default Core Promotion

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-07-28
> **Implementation Base SHA**: `6bbdfbcf1294fb8cacd4efaa712ed3c51dfabc20`
> **Status**: Completed
> **Priority**: P0
> **Depends On**: [R4 — Alias Registry Capability](./2026-07-28-formal-plugin-delivery-model.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

`feature-verify` source behavior is assigned to the canonical `feature-verify/default` owner. This ticket owns that exact promotion unit and its Codex-native delivery evidence.

## Requirements

- Preserve the bounded Verify deployed feature behavior through bounded, read-only runtime probes and evidence. workflow while replacing source-runtime assumptions with Codex-native tools, authority, and evidence contracts.
- Keep `feature-verify/default` as the only positive owner for its exact prompt contract.

## Scope

| Scope | Description |
|---|---|
| In | Audit and promote the `feature-verify/default` payload, routing contract, and durable completion evidence. |
| Out | Other wave units, compatibility entrypoints, and external service authentication |

## Related Files

| File | Action | Description |
|---|---|---|
| `migration/staging/feature-verify/` | Read | Canonical source evidence |
| `migration/candidates/feature-verify/` | New | Audited Codex-native candidate |
| `plugin/sd0x-dev-flow-codex/skills/feature-verify/` | Update | Final distributable plugin payload |
| `test/feature-verify-default-routing.test.js` | New | Trusted routing contract |
| `migration/source-disposition.json` | Update | Unit ownership and delivery evidence |

## Acceptance Criteria

- [x] Candidate preserves the complete Verify deployed feature behavior through bounded, read-only runtime probes and evidence. workflow and its meaningful failure boundaries.
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
| Development | Complete | Formal-plugin candidate payload `310270b8bfa6b665e4f89b6b2ec033dcf1f8352c3a7bcb9c1663090ddca842ab` preserves the accepted predecessor behavior and package boundary. |
| Testing | Complete | Routing, semantic, and static checks passed. Preflight `f01357f4d407d1ba6e82da41dbfc6bb15e80a4ff59cbbc3396e5a395d8ae3b7a`. Final audit `668441bf4eafb488549f40d971dac9accc8a5f752b414be38e85ebee891bcbee` passed. |
| Acceptance | Complete | Runtime-owned R3 closure and promotion evidence bind this Completed owner. |

## References

- Tech Spec: [Skill Toolkit Migration](../2-tech-spec.md)
