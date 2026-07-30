# Wave 2 Code Explore Default Formal Plugin Promotion

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-07-28
> **Implementation Base SHA**: `6bbdfbcf1294fb8cacd4efaa712ed3c51dfabc20`
> **Status**: Completed
> **Priority**: P0
> **Depends On**: [Code Explore Default Pack-Ready Completion](./2026-07-15-wave2-code-explore-pack-ready.md), [Formal Plugin Delivery Model](./2026-07-28-formal-plugin-delivery-model.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

The canonical `code-explore/default` payload completed the legacy repository-only `research-pack` handoff. This replacement owner promotes those audited bytes into the distributable plugin without rewriting historical evidence.

## Requirements

- Preserve the accepted behavior and routing boundary for `code-explore/default`.
- Rebind the candidate contract and routing evidence to the formal plugin package.
- Keep the prior pack-ready payload, request, and evidence immutable.

## Scope

| Scope | Description |
|---|---|
| In | Upgrade and promote only `code-explore/default` into the distributable plugin. |
| Out | Other promotion units、external service authentication、compatibility alias entrypoints |

## Related Files

| File | Action | Description |
|---|---|---|
| `migration/packs/research-pack/code-explore/` | Read | Immutable accepted predecessor payload |
| `migration/candidates/code-explore/` | New | Formal plugin candidate revision |
| `plugin/sd0x-dev-flow-codex/skills/code-explore/` | New | Distributable canonical target |
| `test/code-explore-default-routing.test.js`, `test/code-explore-default-semantics.test.js` | Update | Formal-package routing and semantic contracts |
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
| Development | Complete | Formal-plugin candidate payload `39f88fe97b88310bcaea762272045ad8dd7d44ff5ca6d95d8c0e21b2d2d5af8e` preserves the accepted predecessor behavior and package boundary. |
| Testing | Complete | Routing, semantic, and static checks passed. Preflight `3a143fe4b3b2838a4a4176de52a076ddfc20600d6f78d5d863c65c0ee124c64c`. Final audit `2d7df44119fe32822c9a9b98f3156d1f89047d26778da485078d67761c38fed7` passed. |
| Acceptance | Complete | Runtime-owned R3 closure and promotion evidence bind this Completed owner. |

## References

- Tech Spec: [Skill Toolkit Migration](../2-tech-spec.md)
