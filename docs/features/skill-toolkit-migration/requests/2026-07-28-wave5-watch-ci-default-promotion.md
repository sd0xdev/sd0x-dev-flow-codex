# Wave 5 Watch Ci Default Core Promotion

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-07-28
> **Implementation Base SHA**: `6bbdfbcf1294fb8cacd4efaa712ed3c51dfabc20`
> **Status**: Completed
> **Priority**: P0
> **Depends On**: [R4 — Alias Registry Capability](./2026-07-28-formal-plugin-delivery-model.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

`watch-ci` source behavior is assigned to the canonical `watch-ci/default` owner. This ticket owns that exact promotion unit and its Codex-native delivery evidence.

## Requirements

- Preserve the bounded Monitor GitHub Actions runs for one exact commit until pass, fail, or timeout. workflow while replacing source-runtime assumptions with Codex-native tools, authority, and evidence contracts.
- Keep `watch-ci/default` as the only positive owner for its exact prompt contract.

## Scope

| Scope | Description |
|---|---|
| In | Audit and promote the `watch-ci/default` payload, routing contract, and durable completion evidence. |
| Out | Other wave units, compatibility entrypoints, and external service authentication |

## Related Files

| File | Action | Description |
|---|---|---|
| `migration/staging/watch-ci/` | Read | Canonical source evidence |
| `migration/candidates/watch-ci/` | New | Audited Codex-native candidate |
| `plugin/sd0x-dev-flow-codex/skills/watch-ci/` | Update | Final distributable plugin payload |
| `test/watch-ci-default-routing.test.js` | New | Trusted routing contract |
| `migration/source-disposition.json` | Update | Unit ownership and delivery evidence |

## Acceptance Criteria

- [x] Candidate preserves the complete Monitor GitHub Actions runs for one exact commit until pass, fail, or timeout. workflow and its meaningful failure boundaries.
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
| Development | Complete | Formal-plugin candidate payload `2e0aae350a3fa393cd6fd6afd2dd5464e5ddc62f53a6903177fe7370f8e544cd` preserves the accepted predecessor behavior and package boundary. |
| Testing | Complete | Routing, semantic, and static checks passed. Preflight `36b937ac2b5b300431b658f9feeb09d03b3ad935fd038196379eb94a1706e203`. Final audit `207b9ee418a7f01e44a70a7528fb61a23d71fc55ad4e185252c50e5e899c89bc` passed. |
| Acceptance | Complete | Runtime-owned R3 closure and promotion evidence bind this Completed owner. |

## References

- Tech Spec: [Skill Toolkit Migration](../2-tech-spec.md)
