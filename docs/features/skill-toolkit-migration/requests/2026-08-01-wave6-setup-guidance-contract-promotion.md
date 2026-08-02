# Wave 6 Setup Guidance Contract Promotion

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-08-01
> **Implementation Base SHA**: `22a5334631f1ebb786553d8956aa58d1d2d3c23d`
> **Status**: Completed
> **Priority**: P0
> **Depends On**: [Wave 6 Setup Guidance Core Promotion](./2026-07-28-wave6-setup-guidance-promotion.md), [Wave 6 Setup Default Contract Promotion](./2026-08-01-wave6-setup-default-contract-promotion.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

The canonical `setup/guidance` mode must refresh only managed `AGENTS.md` bytes with the same model-trusting, Anchor-first contract used by default setup.

## Requirements

- Preserve all user-authored guidance outside the managed markers.
- Replace stale managed bytes deterministically from the canonical contract.
- Keep ordinary uncertainty and reversible execution choices with the model.

## Scope

| Scope | Description |
|---|---|
| In | Re-promote `setup/guidance` with versioned managed guidance. |
| Out | Project config, reviewer files, and gate-state mutation |

## Related Files

| File | Action | Description |
|---|---|---|
| `migration/candidates/setup/` | New | Shared exact candidate revision |
| `plugin/sd0x-dev-flow-codex/skills/setup/` | Update | Final distributable owner |
| `scripts/runtime/workflow-contract.js` | New | Renderer and drift contract |
| `migration/source-disposition.json` | Update | Successor promotion owner |

## Acceptance Criteria

- [x] Guidance mode changes only the managed `AGENTS.md` surface.
- [x] User-authored content is preserved byte-for-byte outside managed markers.
- [x] The block declares a closed seven-item Anchor register.
- [x] Defaults explicitly trust autonomous reversible work and fact-based deviations.
- [x] Repeated setup is idempotent and malformed boundaries fail closed.
- [x] Focused behavior, routing, and migration preflight checks bind the candidate.
- [x] R3 closure inputs identify this exact request, promotion unit, evidence kind, and final-fingerprint fields.

## Progress

| Phase | Status | Note |
|---|---|---|
| Analysis | Complete | Managed ownership and Anchor-first precedence are fixed. |
| Development | Complete | Formal-plugin candidate payload `8223afe30385e63c6fe2a3bc4225b18edbf8f8d619047a56cd80863d9af832f2` preserves user guidance and installs the versioned contract. |
| Testing | Complete | Routing, semantic, and static checks passed. Preflight `387d8900272e9c023cd79a8cbf545d91efafb7858efc26a3847a2fe2ed86aad9`. Final audit `551dc069f45dc49b2c513694094cce612f0dbd25780ead4ea6e2da6e3ad8a51e` passed. |
| Acceptance | Complete | Runtime-owned R3 closure and promotion evidence bind this Completed owner. |

## References

- [Prior promotion](./2026-07-28-wave6-setup-guidance-promotion.md)
- Adaptation design: `docs/features/contract-driven-autonomy/2-tech-spec.md`
