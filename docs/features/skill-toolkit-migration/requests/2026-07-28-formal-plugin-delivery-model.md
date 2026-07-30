# Formal Plugin Delivery Model

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-07-28
> **Implementation Base SHA**: `6bbdfbcf1294fb8cacd4efaa712ed3c51dfabc20`
> **Status**: In Progress
> **Priority**: P0
> **Depends On**: [Feature-Dev Single-Primary Re-promotion](./2026-07-26-feature-dev-single-primary-repromotion.md), [Codex 0.145.0 Alias Capability Refresh](./2026-07-23-alias-capability-codex-0-145-0-refresh.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

The migration originally treated repository-only packs and one retirement as valid
final outcomes. The approved delivery goal now requires every source workflow to be
available through the single distributable plugin, while preserving canonical
routing, immutable historical evidence, and per-unit promotion gates.

## Requirements

- Make `core` the authoritative package for every current canonical unit.
- Upgrade legacy pack-ready units through replacement-owner promotion revisions.
- Replace the statusline retirement with a safe, capability-aware live target.
- Generate per-unit promotion plans without weakening exact-fingerprint evidence.

## Scope

| Scope | Description |
|---|---|
| In | Delivery schema、disposition derivation、candidate/promotion tooling、manifest/distribution audit、wave plan generation、migration guidance and focused tests |
| Out | Individual skill content adaptation、external service authentication、release publication |

## Related Files

| File | Action | Description |
|---|---|---|
| `docs/features/skill-toolkit-migration/2-tech-spec.md` | Update | Authoritative formal-plugin architecture and rollout contract |
| `migration/source-disposition.json` | Update | Current package、statusline target and delivery ownership model |
| `scripts/skill-migration-audit.js` | Update | Global distribution and historical-pack upgrade validation |
| `scripts/prepare-skill-wave.js` | Update | Generate plugin-bound candidate plans and replacement owners |
| `scripts/promote-skill-wave.js` | Update | Move every accepted unit to the distributable plugin |
| `scripts/skill-wave-plans.json` | Update | Declare formal-plugin wave plans and dependencies |
| `test/skill-migration.test.js` | Update | Lock schema、routing、distribution and upgrade regressions |
| `docs/PROJECT-MIGRATION-GUIDE.md` | Update | Document delivery boundary and reload requirements |

## Acceptance Criteria

- [ ] Source audit derives `target_package=core` for every current canonical unit and rejects new pack-ready or retired final states.
- [ ] Historical pack-ready evidence remains replayable and immutable while a replacement owner can advance the same unit to promotion.
- [ ] Candidate and promotion tools resolve all final payloads under `plugin/sd0x-dev-flow-codex/skills/` and never discover staging or legacy packs.
- [ ] `statusline-config/default` is a canonical read-only capability unit that cannot write Claude configuration or claim unsupported Codex mutation.
- [ ] Wave planning deterministically covers every not-yet-promoted canonical unit exactly once with valid dependency lineage.
- [ ] Global audit rejects missing, duplicate, alias-owned, undiscovered, or non-evidenced plugin targets.
- [ ] Focused migration tests cover pack upgrade, direct planned promotion, statusline fallback, routing ownership, and historical evidence tamper cases.
- [ ] Node.js 24 LTS focused checks and repository guidance agree on the formal-plugin and reload model.

## Progress

| Phase | Status | Note |
|---|---|---|
| Analysis | Complete | The prior core/pack/retirement rules and the 33 historical pack-ready units were mapped against the new delivery goal. |
| Development | In Progress | Updating the schema, validators, planning tools and migration contract before individual payload promotions. |
| Testing | Pending | |
| Acceptance | Pending | |

## References

- Tech Spec: [Skill Toolkit Migration](../2-tech-spec.md)
