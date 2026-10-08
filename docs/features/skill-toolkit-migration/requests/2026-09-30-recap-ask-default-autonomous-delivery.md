# Autonomous Delivery — recap-ask/default

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-09-30
> **Implementation Base SHA**: `6782d7f0e3c38bc48b60b7002dd2343796ef0374`
> **Status**: Completed
> **Priority**: P1
> **Depends On**: [Previous durable owner](./2026-09-06-model-trust-recap-ask-default-revision.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

The user requested autonomous progress through recoverable context and delivery gaps. This replacement owns only `recap-ask/default`; its previous owner and durable evidence remain historical records. Routine choices should produce a supported deliverable while actual authority, containment, and evidence boundaries remain intact.

## Acceptance Criteria

- [x] Resolve ordinary recap references from context and continue an already-requested outside-scope portion through the relevant read-only workflow without making the user repeat the question.
- [x] Keep recap claims distinct from newly gathered evidence, preserve an explicit recap-only boundary, and grant no mutation authority or access to unavailable evidence through the handoff.

## Related Files and Validation

- `plugin/sd0x-dev-flow-codex/skills/recap-ask/SKILL.md`
- `test/recap-ask-default-routing.test.js`
- `test/recap-ask-default-workflow.test.js`

Inspect the unit-specific changed instructions and preserved boundaries. Canonical preflight runs this unit's registered routing and supplemental tests. Contract regression files, where listed, exercise the shared resolver retry and rejection boundaries. These checks support Candidate Complete; independent AC acceptance and fingerprint-bound review and verification are recorded separately through the runtime.

## Progress

| Phase | Status | Note |
|---|---|---|
| Development | Complete | Native payload `c4ad6895cb983fc9a76f8e90ac7fbebf76f84a39832eb0eb54aa7b616fab599e`. |
| Testing | Complete | Routing and static checks passed. Preflight `1841cc20e7d00fc59f039435c99049fcd60a4df180e4dc54d25405fb40e60f3c`. Final audit `6cfe5690b11e8e035ce3c69fbc69843a006155d6e85d62648a4b061df1d974c1` passed. |
| Acceptance | Complete | Independent AC verification and runtime-owned durable closure bind this owner. |
