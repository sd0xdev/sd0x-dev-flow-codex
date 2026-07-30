# Wave 6 Post Dev Recap Default Core Promotion

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-07-28
> **Implementation Base SHA**: `6bbdfbcf1294fb8cacd4efaa712ed3c51dfabc20`
> **Status**: Completed
> **Priority**: P0
> **Depends On**: [R4 — Alias Registry Capability](./2026-07-28-formal-plugin-delivery-model.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

`post-dev-recap` source behavior is assigned to the canonical `post-dev-recap/default` owner. This ticket owns that exact promotion unit and its Codex-native delivery evidence.

## Requirements

- Preserve the bounded Create a guided implementation recap and hand off bounded follow-up questions. workflow while replacing source-runtime assumptions with Codex-native tools, authority, and evidence contracts.
- Keep `post-dev-recap/default` as the only positive owner for its exact prompt contract.

## Scope

| Scope | Description |
|---|---|
| In | Audit and promote the `post-dev-recap/default` payload, routing contract, and durable completion evidence. |
| Out | Other wave units, compatibility entrypoints, and external service authentication |

## Related Files

| File | Action | Description |
|---|---|---|
| `migration/staging/post-dev-recap/` | Read | Canonical source evidence |
| `migration/candidates/post-dev-recap/` | New | Audited Codex-native candidate |
| `plugin/sd0x-dev-flow-codex/skills/post-dev-recap/` | Update | Final distributable plugin payload |
| `test/post-dev-recap-default-routing.test.js` | New | Trusted routing contract |
| `migration/source-disposition.json` | Update | Unit ownership and delivery evidence |

## Acceptance Criteria

- [x] Candidate preserves the complete Create a guided implementation recap and hand off bounded follow-up questions. workflow and its meaningful failure boundaries.
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
| Development | Complete | Formal-plugin candidate payload `131c11bbf5afe41a31c2b7e96395e8e21287deb35b3738bb4fdd73d686080bb9` preserves the accepted predecessor behavior and package boundary. |
| Testing | Complete | Routing, semantic, and static checks passed. Preflight `a0ab27150f34f616336883ac16422c56f905d4611d6a9f99d5f0a89e1d8972af`. Final audit `c1b0e56ee8d6d775f8e22891007f600f2584070b12750cdadbaa2f9829f4267f` passed. |
| Acceptance | Complete | Runtime-owned R3 closure and promotion evidence bind this Completed owner. |

## References

- Tech Spec: [Skill Toolkit Migration](../2-tech-spec.md)
