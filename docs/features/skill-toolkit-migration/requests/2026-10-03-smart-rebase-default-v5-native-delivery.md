# Native v5 Delivery — smart-rebase/default

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-10-03
> **Implementation Base SHA**: `6782d7f0e3c38bc48b60b7002dd2343796ef0374`
> **Status**: Completed
> **Priority**: P1
> **Depends On**: [Previous durable owner](./2026-09-06-model-trust-smart-rebase-default-revision.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

The user requested the complete applicable upstream v5 native migration. This replacement owns only `smart-rebase/default`; its previous owner and durable evidence remain historical records. Routine choices should produce a supported deliverable while actual authority, containment, and evidence boundaries remain intact.

## Acceptance Criteria

- [x] Apply native Git authorization/policy, additive protection and attribution constraints to smart-rebase/default, preserving exact operation scope and observations.
- [x] Keep policy/offer/eligibility distinct from user authority, refresh OIDs for repeated invocations and reject stale, expired or model-origin goal commit authority.

## Related Files and Validation

- `plugin/sd0x-dev-flow-codex/skills/smart-rebase/SKILL.md`
- `test/smart-rebase-default-routing.test.js`
- `test/smart-rebase-default-workflow.test.js`

Inspect the unit-specific changed instructions and preserved boundaries. Canonical preflight runs this unit's registered routing and supplemental tests. Contract regression files, where listed, exercise the shared resolver retry and rejection boundaries. These checks support Candidate Complete; independent AC acceptance and fingerprint-bound review and verification are recorded separately through the runtime.

## Progress

| Phase | Status | Note |
|---|---|---|
| Development | Complete | Native payload `2263238fe423de8e7a666a02b036c7a8e0056db74540a5c553eb8f4fd3c3386e`. |
| Testing | Complete | Routing and static checks passed. Preflight `682edb7b546a2138a4756bdb5f755f727a7074138c72effdbbbca561c9a4bc45`. Final audit `415e3e38a610cf8ccafb0d6ccc5fe2e4ef60369257a5f17323dda953036ea4ec` passed. |
| Acceptance | Complete | Independent AC verification and runtime-owned durable closure bind this owner. |
