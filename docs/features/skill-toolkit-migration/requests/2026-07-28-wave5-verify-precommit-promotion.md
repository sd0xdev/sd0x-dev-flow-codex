# Wave 5 Verify Precommit Core Promotion

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-07-28
> **Implementation Base SHA**: `6bbdfbcf1294fb8cacd4efaa712ed3c51dfabc20`
> **Status**: Completed
> **Priority**: P0
> **Depends On**: [R4 — Alias Registry Capability](./2026-07-28-formal-plugin-delivery-model.md), [Wave 5 Verify Default Core Promotion](./2026-07-28-wave5-verify-default-promotion.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

`precommit` source behavior is assigned to the canonical `verify/precommit` owner. This ticket owns that exact promotion unit and its Codex-native delivery evidence.

## Requirements

- Preserve the bounded Deterministic repository checks and verification evidence for the exact reviewed fingerprint. workflow while replacing source-runtime assumptions with Codex-native tools, authority, and evidence contracts.
- Keep `verify/precommit` as the only positive owner for its exact prompt contract.
- Keep `precommit` mapping-only without discovered compatibility entrypoints.

## Scope

| Scope | Description |
|---|---|
| In | Audit and promote the `verify/precommit` payload, routing contract, and durable completion evidence. |
| Out | Other wave units, compatibility entrypoints, and external service authentication |

## Related Files

| File | Action | Description |
|---|---|---|
| `migration/staging/precommit/` | Read | Canonical source evidence |
| `migration/candidates/verify/` | New | Audited Codex-native candidate |
| `plugin/sd0x-dev-flow-codex/skills/verify/` | Update | Final distributable plugin payload |
| `test/verify-precommit-routing.test.js` | New | Trusted routing contract |
| `migration/source-disposition.json` | Update | Unit ownership and delivery evidence |

## Acceptance Criteria

- [x] Candidate preserves the complete Deterministic repository checks and verification evidence for the exact reviewed fingerprint. workflow and its meaningful failure boundaries.
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
| Development | Complete | Formal-plugin candidate payload `7cc8944cefc7403c8b6ddb5897c5c65477f467a1b057950798332bfcbbab5baa` preserves the accepted predecessor behavior and package boundary. |
| Testing | Complete | Routing, semantic, and static checks passed. Preflight `c46ffd5abccb9a62d92b5e7e1395e0dffe3daa27e397fe279da5bf0f0ff8e3f7`. Final audit `548e6f5665239dfcae20a42023d0e5e97da92100feb82e6897f8eb4dc82abf16` passed. |
| Acceptance | Complete | Runtime-owned R3 closure and promotion evidence bind this Completed owner. |

## References

- Tech Spec: [Skill Toolkit Migration](../2-tech-spec.md)
