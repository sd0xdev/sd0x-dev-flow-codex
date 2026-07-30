# Wave 5 Smart Rebase Default Core Promotion

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-07-28
> **Implementation Base SHA**: `6bbdfbcf1294fb8cacd4efaa712ed3c51dfabc20`
> **Status**: Completed
> **Priority**: P0
> **Depends On**: [R4 — Alias Registry Capability](./2026-07-28-formal-plugin-delivery-model.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

`smart-rebase` source behavior is assigned to the canonical `smart-rebase/default` owner. This ticket owns that exact promotion unit and its Codex-native delivery evidence.

## Requirements

- Preserve the bounded Squash-merge history analysis and one bounded rebase plan with recovery evidence. workflow while replacing source-runtime assumptions with Codex-native tools, authority, and evidence contracts.
- Keep `smart-rebase/default` as the only positive owner for its exact prompt contract.

## Scope

| Scope | Description |
|---|---|
| In | Audit and promote the `smart-rebase/default` payload, routing contract, and durable completion evidence. |
| Out | Other wave units, compatibility entrypoints, and external service authentication |

## Related Files

| File | Action | Description |
|---|---|---|
| `migration/staging/smart-rebase/` | Read | Canonical source evidence |
| `migration/candidates/smart-rebase/` | New | Audited Codex-native candidate |
| `plugin/sd0x-dev-flow-codex/skills/smart-rebase/` | Update | Final distributable plugin payload |
| `test/smart-rebase-default-routing.test.js` | New | Trusted routing contract |
| `migration/source-disposition.json` | Update | Unit ownership and delivery evidence |

## Acceptance Criteria

- [x] Candidate preserves the complete Squash-merge history analysis and one bounded rebase plan with recovery evidence. workflow and its meaningful failure boundaries.
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
| Development | Complete | Formal-plugin candidate payload `d8b4804efc5fdd82ebe8fbe0321d8bd08834db1295bda59282df5d1320aa6aad` preserves the accepted predecessor behavior and package boundary. |
| Testing | Complete | Routing, semantic, and static checks passed. Preflight `d7b81ebd498a10ff23b5eb81b3c2f0b5932810603eb8e3cf29e8caeca3657760`. Final audit `677e841782ea8dd3f1eda4fccb135f50484167ff694507b507908c30b554e929` passed. |
| Acceptance | Complete | Runtime-owned R3 closure and promotion evidence bind this Completed owner. |

## References

- Tech Spec: [Skill Toolkit Migration](../2-tech-spec.md)
