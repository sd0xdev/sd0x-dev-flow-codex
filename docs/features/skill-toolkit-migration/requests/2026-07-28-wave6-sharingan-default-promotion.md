# Wave 6 Sharingan Default Core Promotion

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-07-28
> **Implementation Base SHA**: `6bbdfbcf1294fb8cacd4efaa712ed3c51dfabc20`
> **Status**: Completed
> **Priority**: P0
> **Depends On**: [R4 — Alias Registry Capability](./2026-07-28-formal-plugin-delivery-model.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

`sharingan` source behavior is assigned to the canonical `sharingan/default` owner. This ticket owns that exact promotion unit and its Codex-native delivery evidence.

## Requirements

- Preserve the bounded Adapt a bounded source workflow into a Codex-native skill with provenance and validation. workflow while replacing source-runtime assumptions with Codex-native tools, authority, and evidence contracts.
- Keep `sharingan/default` as the only positive owner for its exact prompt contract.

## Scope

| Scope | Description |
|---|---|
| In | Audit and promote the `sharingan/default` payload, routing contract, and durable completion evidence. |
| Out | Other wave units, compatibility entrypoints, and external service authentication |

## Related Files

| File | Action | Description |
|---|---|---|
| `migration/staging/sharingan/` | Read | Canonical source evidence |
| `migration/candidates/sharingan/` | New | Audited Codex-native candidate |
| `plugin/sd0x-dev-flow-codex/skills/sharingan/` | Update | Final distributable plugin payload |
| `test/sharingan-default-routing.test.js` | New | Trusted routing contract |
| `migration/source-disposition.json` | Update | Unit ownership and delivery evidence |

## Acceptance Criteria

- [x] Candidate preserves the complete Adapt a bounded source workflow into a Codex-native skill with provenance and validation. workflow and its meaningful failure boundaries.
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
| Development | Complete | Formal-plugin candidate payload `41d77d51747a849e7ab6769f58d16e0022a873570b76a22486b0a2ad381e92df` preserves the accepted predecessor behavior and package boundary. |
| Testing | Complete | Routing, semantic, and static checks passed. Preflight `39c0d794281a8305b06049f6196f1e5f97f806f226d9845f4ff0d30de211e2a9`. Final audit `421fbe53590ee32b304e952a99941627b1c1e2d614b32e7cce24216e7bf88ee9` passed. |
| Acceptance | Complete | Runtime-owned R3 closure and promotion evidence bind this Completed owner. |

## References

- Tech Spec: [Skill Toolkit Migration](../2-tech-spec.md)
