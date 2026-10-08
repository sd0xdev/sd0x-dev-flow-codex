# Native v5 Delivery — push-ci/default

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-10-03
> **Implementation Base SHA**: `6782d7f0e3c38bc48b60b7002dd2343796ef0374`
> **Status**: Completed
> **Priority**: P1
> **Depends On**: [Previous durable owner](./2026-09-06-model-trust-push-ci-default-revision.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

The user requested the complete applicable upstream v5 native migration. This replacement owns only `push-ci/default`; its previous owner and durable evidence remain historical records. Routine choices should produce a supported deliverable while actual authority, containment, and evidence boundaries remain intact.

## Acceptance Criteria

- [x] Apply native Git authorization/policy, additive protection and attribution constraints to push-ci/default, preserving exact operation scope and observations.
- [x] Keep policy/offer/eligibility distinct from user authority, refresh OIDs for repeated invocations and reject stale, expired or model-origin goal commit authority.

## Related Files and Validation

- `plugin/sd0x-dev-flow-codex/skills/push-ci/SKILL.md`
- `test/push-ci-default-routing.test.js`
- `test/push-ci-default-workflow.test.js`

Inspect the unit-specific changed instructions and preserved boundaries. Canonical preflight runs this unit's registered routing and supplemental tests. Contract regression files, where listed, exercise the shared resolver retry and rejection boundaries. These checks support Candidate Complete; independent AC acceptance and fingerprint-bound review and verification are recorded separately through the runtime.

## Progress

| Phase | Status | Note |
|---|---|---|
| Development | Complete | Native payload `66d4ee850f1ac2124ae66a98ca5e3553d8043470b7c7ed03c3cd78717efa9a17`. |
| Testing | Complete | Routing and static checks passed. Preflight `fe6f674bf20b3004d1cba94135b77c307d0bafb5aea5bd5565b29f6e0b37b135`. Final audit `2f16acfa57562795d56e85113f85eb01445e42b43dd4ac1fb0c966b4687f64f3` passed. |
| Acceptance | Complete | Independent AC verification and runtime-owned durable closure bind this owner. |
