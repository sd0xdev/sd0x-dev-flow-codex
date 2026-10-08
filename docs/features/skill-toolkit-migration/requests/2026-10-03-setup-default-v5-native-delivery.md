# Native v5 Delivery — setup/default

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-10-03
> **Implementation Base SHA**: `6782d7f0e3c38bc48b60b7002dd2343796ef0374`
> **Status**: Completed
> **Priority**: P1
> **Depends On**: [Previous durable owner](./2026-09-30-local-runner-setup-default-revision.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

The user requested the complete applicable upstream v5 native migration. This replacement owns only `setup/default`; its previous owner and durable evidence remain historical records. Routine choices should produce a supported deliverable while actual authority, containment, and evidence boundaries remain intact.

## Acceptance Criteria

- [x] Provide native Git hook init/sync/doctor/removal with default commit-msg, explicit pre-push opt-in, real routing and persistent installed/pending/declined state, alongside absent-only policy scaffolding.
- [x] Preserve foreign files and user Husky bytes/ref stdin; distinguish written from active, refuse malformed boundaries, retain user configuration and all inherited setup/authority safeguards.

## Related Files and Validation

- `plugin/sd0x-dev-flow-codex/skills/setup/SKILL.md`
- `test/setup-default-routing.test.js`
- `test/setup-default-workflow.test.js`
- `test/v5-git-hooks.test.js`

Inspect the unit-specific changed instructions and preserved boundaries. Canonical preflight runs this unit's registered routing and supplemental tests. Contract regression files, where listed, exercise the shared resolver retry and rejection boundaries. These checks support Candidate Complete; independent AC acceptance and fingerprint-bound review and verification are recorded separately through the runtime.

## Progress

| Phase | Status | Note |
|---|---|---|
| Development | Complete | Native payload `a172767b85d54ef09dc938525dccaf1ff99bf3f78d17d1ae1fa041714829dd71`. |
| Testing | Complete | Routing and static checks passed. Preflight `95026d81516d7e4ddf9f9510f13e025f4e6e53d4c1e0c309c56f0f265b6ed2cd`. Final audit `dbfc2c937ea036ed229a436c8c7038ad8fc8efa6c2963cec46c7f0507a49be10` passed. |
| Acceptance | Complete | Independent AC verification and runtime-owned durable closure bind this owner. |
