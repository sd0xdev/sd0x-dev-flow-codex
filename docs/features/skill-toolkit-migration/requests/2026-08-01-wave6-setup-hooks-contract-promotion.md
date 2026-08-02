# Wave 6 Setup Hooks Contract Promotion

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-08-01
> **Implementation Base SHA**: `22a5334631f1ebb786553d8956aa58d1d2d3c23d`
> **Status**: Completed
> **Priority**: P0
> **Depends On**: [Wave 6 Setup Hooks Core Promotion](./2026-07-28-wave6-setup-hooks-promotion.md), [Wave 6 Setup Default Contract Promotion](./2026-08-01-wave6-setup-default-contract-promotion.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

The canonical `setup/hooks` mode remains config-only while sharing the upgraded setup payload and single-primary contract.

## Requirements

- Preserve the closed config-only mutation boundary.
- Preserve custom configuration while removing obsolete loop limits.
- Keep hook activation and configured-primary authority unchanged.

## Scope

| Scope | Description |
|---|---|
| In | Re-promote `setup/hooks` as part of the shared setup payload. |
| Out | Managed guidance writes, reviewer profile writes, and hook definition changes |

## Related Files

| File | Action | Description |
|---|---|---|
| `migration/candidates/setup/` | New | Shared exact candidate revision |
| `plugin/sd0x-dev-flow-codex/skills/setup/` | Update | Final distributable owner |
| `migration/source-disposition.json` | Update | Successor promotion owner |

## Acceptance Criteria

- [x] Hooks mode writes only `.codex/sd0x-dev-flow.json`.
- [x] Codex remains the default configured primary provider.
- [x] Existing custom configuration and explicit Claude provider selection are preserved.
- [x] Obsolete loop limits remain removed rather than becoming hidden authority.
- [x] Activation deferral semantics remain unchanged.
- [x] Focused behavior, routing, and migration preflight checks bind the candidate.
- [x] R3 closure inputs identify this exact request, promotion unit, evidence kind, and final-fingerprint fields.

## Progress

| Phase | Status | Note |
|---|---|---|
| Analysis | Complete | Config-only ownership and provider authority are unchanged. |
| Development | Complete | Formal-plugin candidate payload `8223afe30385e63c6fe2a3bc4225b18edbf8f8d619047a56cd80863d9af832f2` preserves the hooks-mode boundary. |
| Testing | Complete | Routing, semantic, and static checks passed. Preflight `2d6be4e91bf4fcfea7d85f6fcf6d0edc52ec469751ce4ed1206cef4cc9c1dff2`. Final audit `c697504bb3617c2a0d061c0b3ed9d076bffb52ef5a78c1a01abec675de61f19c` passed. |
| Acceptance | Complete | Runtime-owned R3 closure and promotion evidence bind this Completed owner. |

## References

- [Prior promotion](./2026-07-28-wave6-setup-hooks-promotion.md)
- Adaptation design: `docs/features/contract-driven-autonomy/2-tech-spec.md`
