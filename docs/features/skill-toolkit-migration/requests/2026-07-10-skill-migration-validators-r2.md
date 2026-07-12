# Migration Validation Harness

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-07-10
> **Implementation Base SHA**: `0b24525489ee3be9413ebf0d81e140eeadcc3fe7`
> **Status**: In Progress
> **Priority**: P0
> **Depends On**: [R1 — Source Snapshot and Manifest](./2026-07-10-skill-migration-foundation-r1.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

Pinned source fidelity and Codex promotion safety are different validations. This request builds one deterministic harness with explicit modes so the intentionally Claude-shaped shadow mirror is never judged as a live candidate.

## Requirements

- Implement `audit-source` for manifest/hash/count/license/drift checks only.
- Implement `audit-candidate migration/candidates/<skill> --target <canonical>` with a virtual live target；also support re-auditing an existing live directory while loading the composed overlay、plugin manifest and all live skill metadata.
- Keep the harness repository-only；do not duplicate live runtime state or catalog logic.
- Enforce the 10-target curated-core allowlist、derived pack destinations and guidance consistency before any Wave 1+ core promotion.

## Scope

| Scope | Description |
|---|---|
| In | Static audit modes、drift report、promotion guards、fixtures/tests |
| Out | Source acquisition、registry alias proof、skill behavior implementation |

## Related Files

| File | Action | Description |
|---|---|---|
| `scripts/skill-migration-audit.js` | New | Sole migration validator owner |
| `scripts/skill-routing-test.js` | New | Trusted generated per-unit routing harness |
| `test/skill-migration.test.js` | New | Source/candidate mode contracts and fixtures |
| `migration/source-inventory.generated.json` | Read | Immutable pinned baseline from R1 |
| `migration/source-disposition.json` | Read | Mutable promotion metadata from R1 |
| `package.json` | Modify | Put source audit and root behavior tests in `npm run check` |
| `.github/workflows/ci.yml` | Modify | Fetch complete Git history for base-SHA ancestry validation |
| `AGENTS.md`、`docs/MIGRATION.md`、`docs/PROJECT-MIGRATION-GUIDE.md` | Modify | Keep the exact core/pack boundary marker synchronized |
| `plugin/sd0x-dev-flow-codex/skills/setup/scripts/setup.js` | Modify | Install the same managed boundary marker in project guidance |

## Acceptance Criteria

- [x] `audit-source` independently validates primary 98/263/138/25、overlay acquisition + 2/3/1/0、composite 100/266/139/25、hashes、closed fields、planned target-mode catalog、license and external dependencies.
- [x] `audit-source --compare <checkout>` separates deterministic upstream Git-tree drift from local-overlay missing/hash drift；it never folds arbitrary ignored files into the pinned commit.
- [x] `audit-candidate` rejects unsupported Claude tool/event assumptions without scanning `migration/staging/` as a candidate.
- [x] Candidate audit rejects broken/orphan references、path/symlink escape and unsupported frontmatter.
- [x] Candidate audit supports virtual-target preflight and final live re-audit；tests prove moving into plugin invalidates preflight fingerprint and final promotion requires fresh global audit/review/verify evidence.
- [x] Candidate audit requires sorted closed `capabilities[]`/`operations[]`、owner contract/routing tests for each catalogued target mode、well-formed Markdown tables and rejects omitted mutations or unauthorized operations；R1 seed itself passes before mode implementation.
- [x] Distribution audit proves staging/candidates/pack-ready trees are absent from core manifest/discovery，rejects non-core rows under `plugin/`, and requires current AGENTS/MIGRATION/PROJECT-MIGRATION-GUIDE core-pack markers.
- [ ] Tests cover malicious paths、duplicate/source drift、retire units、required base SHA metadata、owner/Superseded pointers and an acyclic request DAG with no downstream AC ownership；`npm run check` plus review/verify pass.

## Progress

| Phase | Status | Note |
|---|---|---|
| Analysis | Done | Source and candidate trust boundaries are specified |
| Development | Done | Source、compare、candidate、distribution and request-DAG audit modes implemented |
| Testing | Done | 16 focused fixture tests pass，including executable exact-routing registry、candidate/live coexistence、candidate/pack symlink containment、closed filesystem/network/subprocess/module classifiers、core/pack final re-audit and final-gate TOCTOU；full repository check pending latest fingerprint |
| Acceptance | In Progress | Full check and fingerprint-bound review/verify remain |

## References

- [Tech Spec](../2-tech-spec.md)
- [R1 — Source Snapshot and Manifest](./2026-07-10-skill-migration-foundation-r1.md)
