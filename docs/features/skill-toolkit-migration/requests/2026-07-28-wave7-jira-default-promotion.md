# Wave 7 Jira Default Core Promotion

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-07-28
> **Implementation Base SHA**: `6bbdfbcf1294fb8cacd4efaa712ed3c51dfabc20`
> **Status**: Completed
> **Priority**: P0
> **Depends On**: [R4 — Alias Registry Capability](./2026-07-28-formal-plugin-delivery-model.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

`jira` source behavior is assigned to the canonical `jira/default` owner. This ticket owns that exact promotion unit and its Codex-native delivery evidence.

## Requirements

- Preserve the bounded Jira issue inspection and one explicitly requested issue, branch-metadata, or transition workflow. workflow while replacing source-runtime assumptions with Codex-native tools, authority, and evidence contracts.
- Keep `jira/default` as the only positive owner for its exact prompt contract.

## Scope

| Scope | Description |
|---|---|
| In | Audit and promote the `jira/default` payload, routing contract, and durable completion evidence. |
| Out | Other wave units, compatibility entrypoints, and external service authentication |

## Related Files

| File | Action | Description |
|---|---|---|
| `migration/staging/jira/` | Read | Canonical source evidence |
| `migration/candidates/jira/` | New | Audited Codex-native candidate |
| `plugin/sd0x-dev-flow-codex/skills/jira/` | Update | Final distributable plugin payload |
| `test/jira-default-routing.test.js` | New | Trusted routing contract |
| `migration/source-disposition.json` | Update | Unit ownership and delivery evidence |

## Acceptance Criteria

- [x] Candidate preserves the complete Jira issue inspection and one explicitly requested issue, branch-metadata, or transition workflow. workflow and its meaningful failure boundaries.
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
| Development | Complete | Formal-plugin candidate payload `a67f286d681b4329a2b10700dc7235c931c4ac6553b5bd0ff5824c07dfbded54` preserves the accepted predecessor behavior and package boundary. |
| Testing | Complete | Routing, semantic, and static checks passed. Preflight `511b392ccc0006f8e8361fad307b410abc8ead87549118aa2a104d5272e3b5d8`. Final audit `469f86665855b2b7488196434950eed44df785e3c42524b4f537dd6b9cfea992` passed. |
| Acceptance | Complete | Runtime-owned R3 closure and promotion evidence bind this Completed owner. |

## References

- Tech Spec: [Skill Toolkit Migration](../2-tech-spec.md)
