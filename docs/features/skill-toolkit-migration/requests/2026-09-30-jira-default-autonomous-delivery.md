# Autonomous Delivery — jira/default

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-09-30
> **Implementation Base SHA**: `6782d7f0e3c38bc48b60b7002dd2343796ef0374`
> **Status**: Completed
> **Priority**: P1
> **Depends On**: [Previous durable owner](./2026-09-06-model-trust-jira-default-revision.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

The user requested autonomous progress through recoverable context and delivery gaps. This replacement owns only `jira/default`; its previous owner and durable evidence remain historical records. Routine choices should produce a supported deliverable while actual authority, containment, and evidence boundaries remain intact.

## Acceptance Criteria

- [x] Continue an already-authorized exact Jira transition from its preview in the same task instead of requiring a separate execution task.
- [x] Keep preview-only requests read-only and re-fetch exact issue and available transitions, rejecting drift before the single authorized connector transition.

## Related Files and Validation

- `plugin/sd0x-dev-flow-codex/skills/jira/references/transition-mapping.md`
- `test/jira-default-routing.test.js`
- `test/jira-default-workflow.test.js`

Inspect the unit-specific changed instructions and preserved boundaries. Canonical preflight runs this unit's registered routing and supplemental tests. Contract regression files, where listed, exercise the shared resolver retry and rejection boundaries. These checks support Candidate Complete; independent AC acceptance and fingerprint-bound review and verification are recorded separately through the runtime.

## Progress

| Phase | Status | Note |
|---|---|---|
| Development | Complete | Native payload `12252e9fa60a9d9894141c23abbc478f4b6972d29d26da846710d760ae7829bd`. |
| Testing | Complete | Routing and static checks passed. Preflight `7ac4adc1775d795940304306f373fd5b97af3f63db4e9b8b5fa0e8a0c031be2e`. Final audit `d1e1dac39f2965dce22b91cc9c98242adad1f2acd7ed44e71829ae428fb12a55` passed. |
| Acceptance | Complete | Independent AC verification and runtime-owned durable closure bind this owner. |
