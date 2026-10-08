# Native v5 Delivery — review/full

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-10-03
> **Implementation Base SHA**: `6782d7f0e3c38bc48b60b7002dd2343796ef0374`
> **Status**: Completed
> **Priority**: P1
> **Depends On**: [Previous durable owner](./2026-09-30-local-runner-review-full-revision.md); [review/default](./2026-10-03-review-default-v5-native-delivery.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

The user requested the complete applicable upstream v5 native migration. This replacement owns only `review/full`; its previous owner and durable evidence remain historical records. Routine choices should produce a supported deliverable while actual authority, containment, and evidence boundaries remain intact.

## Acceptance Criteria

- [x] Load the exact installed review dispatch/scope/stall contracts before dependent review work in every selected mode.
- [x] Treat failed or wrong-version contract delivery as unresolved, preserve configured-primary-only authority and never convert advisory diagnostics or a round cap into acceptance.

## Related Files and Validation

- `plugin/sd0x-dev-flow-codex/skills/review/SKILL.md`
- `test/review-full-routing.test.js`

Inspect the unit-specific changed instructions and preserved boundaries. Canonical preflight runs this unit's registered routing and supplemental tests. Contract regression files, where listed, exercise the shared resolver retry and rejection boundaries. These checks support Candidate Complete; independent AC acceptance and fingerprint-bound review and verification are recorded separately through the runtime.

## Progress

| Phase | Status | Note |
|---|---|---|
| Development | Complete | Native payload `fdf195357612af22a36276cfe80bfb17e952b4854f5650ee90a37d84bc672cf1`. |
| Testing | Complete | Routing and static checks passed. Preflight `832421bb3f8e514682f388185c2ca39765d7782a19977ec81bba292985960187`. Final audit `9dd0858614f90d1ff76055a1b2d4e3560552debdfb37e8a9f527404f5d7d3864` passed. |
| Acceptance | Complete | Independent AC verification and runtime-owned durable closure bind this owner. |
