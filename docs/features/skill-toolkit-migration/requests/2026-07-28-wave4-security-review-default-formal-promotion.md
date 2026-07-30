# Wave 4 Security Review Default Formal Plugin Promotion

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-07-28
> **Implementation Base SHA**: `6bbdfbcf1294fb8cacd4efaa712ed3c51dfabc20`
> **Status**: Completed
> **Priority**: P0
> **Depends On**: [Security Review Default Pack-Ready Completion](./2026-07-25-wave4-security-review-default-pack-ready.md), [Formal Plugin Delivery Model](./2026-07-28-formal-plugin-delivery-model.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

The canonical `security-review/default` payload completed the legacy repository-only `quality-pack` handoff. This replacement owner promotes those audited bytes into the distributable plugin without rewriting historical evidence.

## Requirements

- Preserve the accepted behavior and routing boundary for `security-review/default`.
- Rebind the candidate contract and routing evidence to the formal plugin package.
- Keep the prior pack-ready payload, request, and evidence immutable.

## Scope

| Scope | Description |
|---|---|
| In | Upgrade and promote only `security-review/default` into the distributable plugin. |
| Out | Other promotion units、external service authentication、compatibility alias entrypoints |

## Related Files

| File | Action | Description |
|---|---|---|
| `migration/packs/quality-pack/security-review/` | Read | Immutable accepted predecessor payload |
| `migration/candidates/security-review/` | New | Formal plugin candidate revision |
| `plugin/sd0x-dev-flow-codex/skills/security-review/` | New | Distributable canonical target |
| `test/security-review-default-routing.test.js` | Update | Formal-package routing and semantic contracts |
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
| Development | Complete | Formal-plugin candidate payload `d0fda86ac5d1e32e83dc3bb2e697e4245f6dbc7ab8b2a1ac03f61b0ca5619422` preserves the accepted predecessor behavior and package boundary. |
| Testing | Complete | Routing, semantic, and static checks passed. Preflight `0ed23182cde6c3d33ee289da3c4ba2cce752764c227413e368bb3e0968c54892`. Final audit `74d4f018bffb597e3f14918070f42b81c497aa3baea37300114cd4986f8f60aa` passed. |
| Acceptance | Complete | Runtime-owned R3 closure and promotion evidence bind this Completed owner. |

## References

- Tech Spec: [Skill Toolkit Migration](../2-tech-spec.md)
