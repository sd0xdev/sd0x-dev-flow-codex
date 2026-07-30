# Wave 4 Pre Pr Audit Default Formal Plugin Promotion

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-07-28
> **Implementation Base SHA**: `6bbdfbcf1294fb8cacd4efaa712ed3c51dfabc20`
> **Status**: Completed
> **Priority**: P0
> **Depends On**: [Pre Pr Audit Default Pack-Ready Completion](./2026-07-25-wave4-pre-pr-audit-default-pack-ready.md), [Formal Plugin Delivery Model](./2026-07-28-formal-plugin-delivery-model.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

The canonical `pre-pr-audit/default` payload completed the legacy repository-only `quality-pack` handoff. This replacement owner promotes those audited bytes into the distributable plugin without rewriting historical evidence.

## Requirements

- Preserve the accepted behavior and routing boundary for `pre-pr-audit/default`.
- Rebind the candidate contract and routing evidence to the formal plugin package.
- Keep the prior pack-ready payload, request, and evidence immutable.

## Scope

| Scope | Description |
|---|---|
| In | Upgrade and promote only `pre-pr-audit/default` into the distributable plugin. |
| Out | Other promotion units、external service authentication、compatibility alias entrypoints |

## Related Files

| File | Action | Description |
|---|---|---|
| `migration/packs/quality-pack/pre-pr-audit/` | Read | Immutable accepted predecessor payload |
| `migration/candidates/pre-pr-audit/` | New | Formal plugin candidate revision |
| `plugin/sd0x-dev-flow-codex/skills/pre-pr-audit/` | New | Distributable canonical target |
| `test/pre-pr-audit-default-routing.test.js` | Update | Formal-package routing and semantic contracts |
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
| Development | Complete | Formal-plugin candidate payload `3d7ecb4311dd6f7cb0166a8a0dfb2e44cceb5754cc98477d32048132ae3ec275` preserves the accepted predecessor behavior and package boundary. |
| Testing | Complete | Routing, semantic, and static checks passed. Preflight `666e7843ae214f7d46fd3961c63790dd022bfdbb886c8840e928ae712a750ed2`. Final audit `6fe20084d558997ae6d24964fe429944a97f43c9ca9ec8b32187117b9f29d58d` passed. |
| Acceptance | Complete | Runtime-owned R3 closure and promotion evidence bind this Completed owner. |

## References

- Tech Spec: [Skill Toolkit Migration](../2-tech-spec.md)
