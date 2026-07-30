# Wave 2 Ask Default Formal Plugin Promotion

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-07-28
> **Implementation Base SHA**: `6bbdfbcf1294fb8cacd4efaa712ed3c51dfabc20`
> **Status**: Completed
> **Priority**: P0
> **Depends On**: [Ask Default Pack-Ready Completion](./2026-07-15-wave2-ask-pack-ready.md), [Formal Plugin Delivery Model](./2026-07-28-formal-plugin-delivery-model.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

The canonical `ask/default` payload completed the legacy repository-only `research-pack` handoff. This replacement owner promotes those audited bytes into the distributable plugin without rewriting historical evidence.

## Requirements

- Preserve the accepted behavior and routing boundary for `ask/default`.
- Rebind the candidate contract and routing evidence to the formal plugin package.
- Keep the prior pack-ready payload, request, and evidence immutable.

## Scope

| Scope | Description |
|---|---|
| In | Upgrade and promote only `ask/default` into the distributable plugin. |
| Out | Other promotion units、external service authentication、compatibility alias entrypoints |

## Related Files

| File | Action | Description |
|---|---|---|
| `migration/packs/research-pack/ask/` | Read | Immutable accepted predecessor payload |
| `migration/candidates/ask/` | New | Formal plugin candidate revision |
| `plugin/sd0x-dev-flow-codex/skills/ask/` | New | Distributable canonical target |
| `test/ask-default-routing.test.js`, `test/ask-default-semantics.test.js` | Update | Formal-package routing and semantic contracts |
| `migration/source-disposition.json` | Update | Current package、owner and delivery transition |

## Acceptance Criteria

- [x] Candidate bytes preserve the complete accepted workflow and meaningful failure boundaries.
- [x] Contract binds all assigned source names to one canonical promotion unit.
- [x] Legacy pack payload, Completed request, and durable pack-ready evidence remain unchanged.
- [x] Routing and semantic tests bind the formal plugin package and canonical owner.
- [x] Candidate preflight binds exact payload, disposition, and trusted test identity.
- [x] Final plugin destination matches the accepted candidate bytes.
- [x] R3 closure inputs identify this exact request, promotion unit, evidence kind, and final-fingerprint fields.

## Progress

| Phase | Status | Note |
|---|---|---|
| Analysis | Complete | The immutable pack-ready predecessor and current canonical owner were resolved. |
| Development | Complete | Formal-plugin candidate payload `3f67252f58e4442bef47acbce981b16a15a9ccd7e5aeadd70d28f3079db32cdf` preserves the accepted predecessor behavior and package boundary. |
| Testing | Complete | Routing, semantic, and static checks passed. Preflight `5506d0419a4af79863f51527513455ed3c877d94f01a072fb2187ae37fa27871`. Final audit `025c5507e4173c056675642a0668b4c775c51e1cd7f585d59ec5d49efbf6b9dc` passed. |
| Acceptance | Complete | Runtime-owned R3 closure and promotion evidence bind this Completed owner. |

## References

- Tech Spec: [Skill Toolkit Migration](../2-tech-spec.md)
