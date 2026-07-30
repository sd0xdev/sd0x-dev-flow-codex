# Wave 5 Verify Fast Core Promotion

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-07-28
> **Implementation Base SHA**: `6bbdfbcf1294fb8cacd4efaa712ed3c51dfabc20`
> **Status**: Completed
> **Priority**: P0
> **Depends On**: [R4 — Alias Registry Capability](./2026-07-28-formal-plugin-delivery-model.md), [Wave 5 Verify Default Core Promotion](./2026-07-28-wave5-verify-default-promotion.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

`precommit-fast` source behavior is assigned to the canonical `verify/fast` owner. This ticket owns that exact promotion unit and its Codex-native delivery evidence.

## Requirements

- Preserve the bounded Deterministic repository checks and verification evidence for the exact reviewed fingerprint. workflow while replacing source-runtime assumptions with Codex-native tools, authority, and evidence contracts.
- Keep `verify/fast` as the only positive owner for its exact prompt contract.
- Keep `precommit-fast` mapping-only without discovered compatibility entrypoints.

## Scope

| Scope | Description |
|---|---|
| In | Audit and promote the `verify/fast` payload, routing contract, and durable completion evidence. |
| Out | Other wave units, compatibility entrypoints, and external service authentication |

## Related Files

| File | Action | Description |
|---|---|---|
| `migration/staging/precommit-fast/` | Read | Canonical source evidence |
| `migration/candidates/verify/` | New | Audited Codex-native candidate |
| `plugin/sd0x-dev-flow-codex/skills/verify/` | Update | Final distributable plugin payload |
| `test/verify-fast-routing.test.js` | New | Trusted routing contract |
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
| Testing | Complete | Routing, semantic, and static checks passed. Preflight `3144d7a82854b49837433e2ac0182670a59df67eff0218a4f67cb931a81c1652`. Final audit `3f064850d0af12985359f285749e81c9383076d5a061537e6aea38e8fe4d6675` passed. |
| Acceptance | Complete | Runtime-owned R3 closure and promotion evidence bind this Completed owner. |

## References

- Tech Spec: [Skill Toolkit Migration](../2-tech-spec.md)
