# Wave 6 Setup Scripts Contract Promotion

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-08-01
> **Implementation Base SHA**: `22a5334631f1ebb786553d8956aa58d1d2d3c23d`
> **Status**: Completed
> **Priority**: P0
> **Depends On**: [Wave 6 Setup Scripts Core Promotion](./2026-07-28-wave6-setup-scripts-promotion.md), [Wave 6 Setup Default Contract Promotion](./2026-08-01-wave6-setup-default-contract-promotion.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

The canonical `setup/scripts` mode must include the new workflow contract in its closed runtime-entrypoint inventory without copying project files.

## Requirements

- Verify every required bundled runtime entrypoint.
- Add the canonical workflow contract to the closed inventory.
- Preserve the read-only scripts-mode project boundary.

## Scope

| Scope | Description |
|---|---|
| In | Re-promote `setup/scripts` with workflow-contract reachability. |
| Out | Project guidance, config, reviewer files, and runtime-state mutation |

## Related Files

| File | Action | Description |
|---|---|---|
| `migration/candidates/setup/` | New | Shared exact candidate revision |
| `plugin/sd0x-dev-flow-codex/skills/setup/` | Update | Final distributable owner |
| `scripts/runtime/workflow-contract.js` | Verify | New canonical runtime entrypoint |
| `migration/source-disposition.json` | Update | Successor promotion owner |

## Acceptance Criteria

- [x] Scripts mode remains project-read-only.
- [x] The workflow contract is included in the exact runtime inventory.
- [x] Missing runtime entrypoints fail closed.
- [x] Unrelated damaged guidance and config surfaces do not affect scripts mode.
- [x] No runtime file is copied into the target project.
- [x] Focused behavior, routing, and migration preflight checks bind the candidate.
- [x] R3 closure inputs identify this exact request, promotion unit, evidence kind, and final-fingerprint fields.

## Progress

| Phase | Status | Note |
|---|---|---|
| Analysis | Complete | Runtime reachability and read-only project scope are fixed. |
| Development | Complete | Formal-plugin candidate payload `8223afe30385e63c6fe2a3bc4225b18edbf8f8d619047a56cd80863d9af832f2` includes workflow-contract reachability. |
| Testing | Complete | Routing, semantic, and static checks passed. Preflight `cd43812e19fdb7e3285a70f758b6ffdaf8c9ee8a8f540991643b1d0a283d83f0`. Final audit `a15b936b825d9b9334ba4ad61dea253a6bddffe10c92478bd2620c94f30dc5f3` passed. |
| Acceptance | Complete | Runtime-owned R3 closure and promotion evidence bind this Completed owner. |

## References

- [Prior promotion](./2026-07-28-wave6-setup-scripts-promotion.md)
- Adaptation design: `docs/features/contract-driven-autonomy/2-tech-spec.md`
