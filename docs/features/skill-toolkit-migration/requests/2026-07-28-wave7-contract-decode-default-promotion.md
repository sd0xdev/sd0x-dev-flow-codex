# Wave 7 Contract Decode Default Core Promotion

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-07-28
> **Implementation Base SHA**: `6bbdfbcf1294fb8cacd4efaa712ed3c51dfabc20`
> **Status**: Completed
> **Priority**: P0
> **Depends On**: [R4 — Alias Registry Capability](./2026-07-28-formal-plugin-delivery-model.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

`contract-decode` source behavior is assigned to the canonical `contract-decode/default` owner. This ticket owns that exact promotion unit and its Codex-native delivery evidence.

## Requirements

- Preserve the bounded Decode EVM selectors, calldata, revert payloads, and custom errors from local ABI or authoritative lookup evidence. workflow while replacing source-runtime assumptions with Codex-native tools, authority, and evidence contracts.
- Keep `contract-decode/default` as the only positive owner for its exact prompt contract.

## Scope

| Scope | Description |
|---|---|
| In | Audit and promote the `contract-decode/default` payload, routing contract, and durable completion evidence. |
| Out | Other wave units, compatibility entrypoints, and external service authentication |

## Related Files

| File | Action | Description |
|---|---|---|
| `migration/staging/contract-decode/` | Read | Canonical source evidence |
| `migration/candidates/contract-decode/` | New | Audited Codex-native candidate |
| `plugin/sd0x-dev-flow-codex/skills/contract-decode/` | Update | Final distributable plugin payload |
| `test/contract-decode-default-routing.test.js` | New | Trusted routing contract |
| `migration/source-disposition.json` | Update | Unit ownership and delivery evidence |

## Acceptance Criteria

- [x] Candidate preserves the complete Decode EVM selectors, calldata, revert payloads, and custom errors from local ABI or authoritative lookup evidence. workflow and its meaningful failure boundaries.
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
| Development | Complete | Formal-plugin candidate payload `4bc91340e96b08e7dfef92507f711f98a0865f36839059172c74c45438fa536a` preserves the accepted predecessor behavior and package boundary. |
| Testing | Complete | Routing, semantic, and static checks passed. Preflight `b61e8110674e6b670502c4df0151b62ef780464ad4d5befecbecb395464e414d`. Final audit `53ec16c59a27e79b38067e55b0edbe366b7fc2696193c21735267462bef9ee44` passed. |
| Acceptance | Complete | Runtime-owned R3 closure and promotion evidence bind this Completed owner. |

## References

- Tech Spec: [Skill Toolkit Migration](../2-tech-spec.md)
