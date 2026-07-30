# Wave 7 Dev Security Audit Default Core Promotion

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-07-28
> **Implementation Base SHA**: `6bbdfbcf1294fb8cacd4efaa712ed3c51dfabc20`
> **Status**: Completed
> **Priority**: P0
> **Depends On**: [R4 — Alias Registry Capability](./2026-07-28-formal-plugin-delivery-model.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

`dev-security-audit` source behavior is assigned to the canonical `dev-security-audit/default` owner. This ticket owns that exact promotion unit and its Codex-native delivery evidence.

## Requirements

- Preserve the bounded A read-only developer-workstation security assessment for credentials, persistence, and supply-chain indicators. workflow while replacing source-runtime assumptions with Codex-native tools, authority, and evidence contracts.
- Keep `dev-security-audit/default` as the only positive owner for its exact prompt contract.

## Scope

| Scope | Description |
|---|---|
| In | Audit and promote the `dev-security-audit/default` payload, routing contract, and durable completion evidence. |
| Out | Other wave units, compatibility entrypoints, and external service authentication |

## Related Files

| File | Action | Description |
|---|---|---|
| `migration/staging/dev-security-audit/` | Read | Canonical source evidence |
| `migration/candidates/dev-security-audit/` | New | Audited Codex-native candidate |
| `plugin/sd0x-dev-flow-codex/skills/dev-security-audit/` | Update | Final distributable plugin payload |
| `test/dev-security-audit-default-routing.test.js` | New | Trusted routing contract |
| `migration/source-disposition.json` | Update | Unit ownership and delivery evidence |

## Acceptance Criteria

- [x] Candidate preserves the complete A read-only developer-workstation security assessment for credentials, persistence, and supply-chain indicators. workflow and its meaningful failure boundaries.
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
| Development | Complete | Formal-plugin candidate payload `df69c3b2115bbf100229dfc779dc71e7096a19cf68ef07ccfc96ad452c698651` preserves the accepted predecessor behavior and package boundary. |
| Testing | Complete | Routing, semantic, and static checks passed. Preflight `69aacdfcf3c175e7e8e7e67c486c97415f0df1fc1db01d0d46b0a92deae3b9d6`. Final audit `0bc6d7745532b03e248c66410643482bff37a48c265b2f65eff9fc173615181b` passed. |
| Acceptance | Complete | Runtime-owned R3 closure and promotion evidence bind this Completed owner. |

## References

- Tech Spec: [Skill Toolkit Migration](../2-tech-spec.md)
