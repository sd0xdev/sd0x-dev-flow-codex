# Wave 6 Setup Default Core Promotion

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-07-28
> **Implementation Base SHA**: `6bbdfbcf1294fb8cacd4efaa712ed3c51dfabc20`
> **Status**: Completed
> **Priority**: P0
> **Depends On**: [R4 — Alias Registry Capability](./2026-07-28-formal-plugin-delivery-model.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

`codex-setup` and `project-setup` source behavior is assigned to the canonical `setup/default` owner. This ticket owns that exact promotion unit and its Codex-native delivery evidence.

## Requirements

- Preserve the bounded Install or refresh setup-managed project guidance and reviewer definitions while preserving user-authored content. workflow while replacing source-runtime assumptions with Codex-native tools, authority, and evidence contracts.
- Keep `setup/default` as the only positive owner for its exact prompt contract.
- Keep `codex-setup`, `project-setup` mapping-only without discovered compatibility entrypoints.

## Scope

| Scope | Description |
|---|---|
| In | Audit and promote the `setup/default` payload, routing contract, and durable completion evidence. |
| Out | Other wave units, compatibility entrypoints, and external service authentication |

## Related Files

| File | Action | Description |
|---|---|---|
| `migration/staging/codex-setup/` | Read | Canonical source evidence |
| `migration/candidates/setup/` | New | Audited Codex-native candidate |
| `plugin/sd0x-dev-flow-codex/skills/setup/` | Update | Final distributable plugin payload |
| `test/setup-default-routing.test.js` | New | Trusted routing contract |
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
| Testing | Complete | Routing, semantic, and static checks passed. Preflight `3fb984c1c792b50307d365bd1af61f56a53d6730407b2ce93087e7566af4c9d4`. Final audit `03038eacd4e441ab7211bcc07dd1ff69fc0ca5ce54ce2de50b8f4efee0e907d7` passed. |
| Acceptance | Complete | Runtime-owned R3 closure and promotion evidence bind this Completed owner. |

## References

- Tech Spec: [Skill Toolkit Migration](../2-tech-spec.md)
