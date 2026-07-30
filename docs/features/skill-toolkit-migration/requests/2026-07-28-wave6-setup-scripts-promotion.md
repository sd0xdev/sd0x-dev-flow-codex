# Wave 6 Setup Scripts Core Promotion

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-07-28
> **Implementation Base SHA**: `6bbdfbcf1294fb8cacd4efaa712ed3c51dfabc20`
> **Status**: Completed
> **Priority**: P0
> **Depends On**: [R4 — Alias Registry Capability](./2026-07-28-formal-plugin-delivery-model.md), [Wave 6 Setup Default Core Promotion](./2026-07-28-wave6-setup-default-promotion.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

`install-scripts` source behavior is assigned to the canonical `setup/scripts` owner. This ticket owns that exact promotion unit and its Codex-native delivery evidence.

## Requirements

- Preserve the bounded Install or refresh setup-managed project guidance and reviewer definitions while preserving user-authored content. workflow while replacing source-runtime assumptions with Codex-native tools, authority, and evidence contracts.
- Keep `setup/scripts` as the only positive owner for its exact prompt contract.
- Keep `install-scripts` mapping-only without discovered compatibility entrypoints.

## Scope

| Scope | Description |
|---|---|
| In | Audit and promote the `setup/scripts` payload, routing contract, and durable completion evidence. |
| Out | Other wave units, compatibility entrypoints, and external service authentication |

## Related Files

| File | Action | Description |
|---|---|---|
| `migration/staging/install-scripts/` | Read | Canonical source evidence |
| `migration/candidates/setup/` | New | Audited Codex-native candidate |
| `plugin/sd0x-dev-flow-codex/skills/setup/` | Update | Final distributable plugin payload |
| `test/setup-scripts-routing.test.js` | New | Trusted routing contract |
| `migration/source-disposition.json` | Update | Unit ownership and delivery evidence |

## Acceptance Criteria

- [x] Candidate preserves the complete Install or refresh setup-managed project guidance and reviewer definitions while preserving user-authored content. workflow and its meaningful failure boundaries.
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
| Development | Complete | Formal-plugin candidate payload `e6f9448fb729a7bf9f190ae28a794fe863b565d90805452784a1db04b0d49bca` preserves the accepted predecessor behavior and package boundary. |
| Testing | Complete | Routing, semantic, and static checks passed. Preflight `f1dbc9989d202a2cc91f280735a9f165e62e94c7296c75f8592191ecf3b3cec9`. Final audit `a5cedcc3c8954c4afad3ef8794abb6af79f5499f8b2787109dc823c25cb936e5` passed. |
| Acceptance | Complete | Runtime-owned R3 closure and promotion evidence bind this Completed owner. |

## References

- Tech Spec: [Skill Toolkit Migration](../2-tech-spec.md)
