# Wave 6 Setup Default Contract Promotion

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-08-01
> **Implementation Base SHA**: `22a5334631f1ebb786553d8956aa58d1d2d3c23d`
> **Status**: Completed
> **Priority**: P0
> **Depends On**: [Wave 6 Setup Default Core Promotion](./2026-07-28-wave6-setup-default-promotion.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

The canonical `setup/default` owner must install the versioned workflow contract while preserving configured reviewer setup and user-authored project guidance.

## Requirements

- Keep default setup idempotent and preserve unowned files and custom configuration.
- Install the canonical Anchor/Default/Guidance contract and configured primary profiles.
- Keep all setup aliases mapping-only.

## Scope

| Scope | Description |
|---|---|
| In | Re-promote `setup/default` with contract-driven managed guidance. |
| Out | Other skills, provider authority changes, and user-level Codex installation |

## Related Files

| File | Action | Description |
|---|---|---|
| `migration/candidates/setup/` | New | Exact candidate revision |
| `plugin/sd0x-dev-flow-codex/skills/setup/` | Update | Final distributable owner |
| `scripts/runtime/workflow-contract.js` | New | Canonical contract source |
| `migration/source-disposition.json` | Update | Successor promotion owner |

## Acceptance Criteria

- [x] Setup preserves user-authored bytes outside managed markers.
- [x] The installed managed block is rendered from one versioned canonical contract.
- [x] The closed Anchor register cannot be downgraded by project guidance.
- [x] Defaults trust the model with reversible path, batching, timing, and depth choices.
- [x] Configured primary reviewer setup remains single-authority and idempotent.
- [x] Focused behavior, routing, and migration preflight checks bind the candidate.
- [x] R3 closure inputs identify this exact request, promotion unit, evidence kind, and final-fingerprint fields.

## Progress

| Phase | Status | Note |
|---|---|---|
| Analysis | Complete | Prior owner, contract boundary, and single-primary authority are fixed. |
| Development | Complete | Formal-plugin candidate payload `8223afe30385e63c6fe2a3bc4225b18edbf8f8d619047a56cd80863d9af832f2` preserves the setup workflow and adds contract-driven guidance. |
| Testing | Complete | Routing, semantic, and static checks passed. Preflight `9bed4bef4ec9f59bcd2b93e6753bf86b770c7b59f6d877ab398bf117fe343cad`. Final audit `e17ff8b17cb79be0ec9bfae01085518d083fecf475adf56bae20878c2307a259` passed. |
| Acceptance | Complete | Runtime-owned R3 closure and promotion evidence bind this Completed owner. |

## References

- [Prior promotion](./2026-07-28-wave6-setup-default-promotion.md)
- Adaptation design: `docs/features/contract-driven-autonomy/2-tech-spec.md`
