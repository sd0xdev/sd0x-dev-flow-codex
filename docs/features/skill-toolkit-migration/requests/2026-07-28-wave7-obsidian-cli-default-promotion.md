# Wave 7 Obsidian Cli Default Core Promotion

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-07-28
> **Implementation Base SHA**: `6bbdfbcf1294fb8cacd4efaa712ed3c51dfabc20`
> **Status**: Completed
> **Priority**: P0
> **Depends On**: [R4 — Alias Registry Capability](./2026-07-28-formal-plugin-delivery-model.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

`obsidian-cli` source behavior is assigned to the canonical `obsidian-cli/default` owner. This ticket owns that exact promotion unit and its Codex-native delivery evidence.

## Requirements

- Preserve the bounded Obsidian vault search and one explicitly requested note or task update through the official CLI. workflow while replacing source-runtime assumptions with Codex-native tools, authority, and evidence contracts.
- Keep `obsidian-cli/default` as the only positive owner for its exact prompt contract.

## Scope

| Scope | Description |
|---|---|
| In | Audit and promote the `obsidian-cli/default` payload, routing contract, and durable completion evidence. |
| Out | Other wave units, compatibility entrypoints, and external service authentication |

## Related Files

| File | Action | Description |
|---|---|---|
| `migration/staging/obsidian-cli/` | Read | Canonical source evidence |
| `migration/candidates/obsidian-cli/` | New | Audited Codex-native candidate |
| `plugin/sd0x-dev-flow-codex/skills/obsidian-cli/` | Update | Final distributable plugin payload |
| `test/obsidian-cli-default-routing.test.js` | New | Trusted routing contract |
| `migration/source-disposition.json` | Update | Unit ownership and delivery evidence |

## Acceptance Criteria

- [x] Candidate preserves the complete Obsidian vault search and one explicitly requested note or task update through the official CLI. workflow and its meaningful failure boundaries.
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
| Development | Complete | Formal-plugin candidate payload `bc00033f52493eff5b919f5b58cfc2ce2af964ba429ba77e1e47288691c71492` preserves the accepted predecessor behavior and package boundary. |
| Testing | Complete | Routing, semantic, and static checks passed. Preflight `3a260f433ff05104d89001f3e57e1d7e172d85969633a853c55ceab8391fb152`. Final audit `9e10f0faee646303f6bec1d1dad0bbae9e3119ebf9d57e73e3174ba663cdec41` passed. |
| Acceptance | Complete | Runtime-owned R3 closure and promotion evidence bind this Completed owner. |

## References

- Tech Spec: [Skill Toolkit Migration](../2-tech-spec.md)
