# Wave 3 Test Gen Default Formal Plugin Promotion

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-07-28
> **Implementation Base SHA**: `6bbdfbcf1294fb8cacd4efaa712ed3c51dfabc20`
> **Status**: Completed
> **Priority**: P0
> **Depends On**: [Test Gen Default Pack-Ready Completion](./2026-07-15-wave3-test-gen-pack-ready.md), [Formal Plugin Delivery Model](./2026-07-28-formal-plugin-delivery-model.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

The canonical `test-gen/default` payload completed the legacy repository-only `development-pack` handoff. This replacement owner promotes those audited bytes into the distributable plugin without rewriting historical evidence.

## Requirements

- Preserve the accepted behavior and routing boundary for `test-gen/default`.
- Rebind the candidate contract and routing evidence to the formal plugin package.
- Keep the prior pack-ready payload, request, and evidence immutable.

## Scope

| Scope | Description |
|---|---|
| In | Upgrade and promote only `test-gen/default` into the distributable plugin. |
| Out | Other promotion units、external service authentication、compatibility alias entrypoints |

## Related Files

| File | Action | Description |
|---|---|---|
| `migration/packs/development-pack/test-gen/` | Read | Immutable accepted predecessor payload |
| `migration/candidates/test-gen/` | New | Formal plugin candidate revision |
| `plugin/sd0x-dev-flow-codex/skills/test-gen/` | New | Distributable canonical target |
| `test/test-gen-default-routing.test.js` | Update | Formal-package routing and semantic contracts |
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
| Development | Complete | Formal-plugin candidate payload `1383b76782db4aa985a18fda17cab8778de0c04ec7be7e8fbae2ea8a8daef998` preserves the accepted predecessor behavior and package boundary. |
| Testing | Complete | Routing, semantic, and static checks passed. Preflight `2bcbdc59522ac414a3c483d5dd79a29fa600c096b810024fa4b4ca150c32bc04`. Final audit `6a98653ef1a924e33630b776b552985e4c535a68932247d9120294bfd5795190` passed. |
| Acceptance | Complete | Runtime-owned R3 closure and promotion evidence bind this Completed owner. |

## References

- Tech Spec: [Skill Toolkit Migration](../2-tech-spec.md)
