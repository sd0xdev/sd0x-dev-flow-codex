# Whole-worktree Commit Grouping — smart-commit/default

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-10-03
> **Implementation Base SHA**: `6782d7f0e3c38bc48b60b7002dd2343796ef0374`
> **Status**: Completed
> **Priority**: P1
> **Depends On**: [Previous durable owner](./2026-10-03-smart-commit-default-v5-native-delivery.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

The user requested smart-commit to inspect all uncommitted work and create a coherent sequence of commits, including staging when execution is authorized. This replacement owns only `smart-commit/default`; its previous owner and durable evidence remain historical records. Routine choices should produce a supported deliverable while actual authority, containment, and evidence boundaries remain intact.

## Acceptance Criteria

- [x] Inspect all staged, unstaged and non-ignored untracked changes and derive dependency-ordered coherent commit groups; an empty index is not a completion or a human checkpoint, and one coherent change remains one commit.
- [x] On explicit execute, stage or repartition only bound groups while preserving staged-only content and working bytes, create and audit one exact commit at a time with hooks/signing intact, and stop on drift/failure with completed commits and remaining work reported.

## Related Files and Validation

- `plugin/sd0x-dev-flow-codex/skills/smart-commit/SKILL.md`
- `scripts/skill-migration-audit.js`
- `scripts/skill-discovery-catalog.json`
- `migration/source-disposition.json`
- `test/smart-commit-default-routing.test.js`
- `test/smart-commit-default-workflow.test.js`
- `test/skill-migration.test.js`

Inspect the unit-specific changed instructions and preserved boundaries. Canonical preflight runs this unit's registered routing and supplemental tests. Contract regression files, where listed, exercise the shared resolver retry and rejection boundaries. These checks support Candidate Complete; independent AC acceptance and fingerprint-bound review and verification are recorded separately through the runtime.

## Progress

| Phase | Status | Note |
|---|---|---|
| Development | Complete | Native payload `505adc0ba5853e8a71b781bf1b3aa85e9844881a0d48a50a1d649291b860c513`. |
| Testing | Complete | Routing and static checks passed. Preflight `35a70fb35a3ef1a9fb73a7d4e2339f381eb54e586c8f27b0a6c8f8f810a2fc1d`. Final audit `036e428312daeb5edda3cfb86697aae2f8cbea0e453cacd19cfdfb7f72c9577c` passed. |
| Acceptance | Complete | Independent AC verification and runtime-owned durable closure bind this owner. |
