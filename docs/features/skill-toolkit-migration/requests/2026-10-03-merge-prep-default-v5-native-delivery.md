# Native v5 Delivery — merge-prep/default

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-10-03
> **Implementation Base SHA**: `6782d7f0e3c38bc48b60b7002dd2343796ef0374`
> **Status**: Completed
> **Priority**: P1
> **Depends On**: [Previous durable owner](./2026-09-30-merge-prep-default-autonomous-delivery.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

The user requested the complete applicable upstream v5 native migration. This replacement owns only `merge-prep/default`; its previous owner and durable evidence remain historical records. Routine choices should produce a supported deliverable while actual authority, containment, and evidence boundaries remain intact.

## Acceptance Criteria

- [x] Apply native Git authorization/policy, additive protection and attribution constraints to merge-prep/default, preserving exact operation scope and observations.
- [x] Keep policy/offer/eligibility distinct from user authority, refresh OIDs for repeated invocations and reject stale, expired or model-origin goal commit authority.

## Related Files and Validation

- `plugin/sd0x-dev-flow-codex/skills/merge-prep/SKILL.md`
- `test/merge-prep-default-routing.test.js`
- `test/merge-prep-default-workflow.test.js`

Inspect the unit-specific changed instructions and preserved boundaries. Canonical preflight runs this unit's registered routing and supplemental tests. Contract regression files, where listed, exercise the shared resolver retry and rejection boundaries. These checks support Candidate Complete; independent AC acceptance and fingerprint-bound review and verification are recorded separately through the runtime.

## Progress

| Phase | Status | Note |
|---|---|---|
| Development | Complete | Native payload `34fa54ab5dbe3faff6efe3e3eaa088625874740ca383c01398665be5fd49ca5f`. |
| Testing | Complete | Routing and static checks passed. Preflight `e3cb0ab7a17ddf3d4572f8798ef76ceee253714713530a3ff3e383c056324abb`. Final audit `08dc3fca339aad069012734ae33cfe4d2b128945760addc12a59fa6fedb107a1` passed. |
| Acceptance | Complete | Independent AC verification and runtime-owned durable closure bind this owner. |
