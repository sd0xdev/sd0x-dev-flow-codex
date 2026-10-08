# Autonomous Delivery — obsidian-cli/default

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-09-30
> **Implementation Base SHA**: `6782d7f0e3c38bc48b60b7002dd2343796ef0374`
> **Status**: Completed
> **Priority**: P1
> **Depends On**: [Previous durable owner](./2026-09-06-model-trust-obsidian-cli-default-revision.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

The user requested autonomous progress through recoverable context and delivery gaps. This replacement owns only `obsidian-cli/default`; its previous owner and durable evidence remain historical records. Routine choices should produce a supported deliverable while actual authority, containment, and evidence boundaries remain intact.

## Acceptance Criteria

- [x] Select the vault from an explicit selector, established task context, or the sole available vault, and complete independent capability diagnostics before asking about materially different remaining vaults.
- [x] Reject unavailable vaults, unsupported CLI versions, and invalid explicit selectors; never execute mutation against a guessed vault or widen the requested operation.

## Related Files and Validation

- `plugin/sd0x-dev-flow-codex/skills/obsidian-cli/SKILL.md`
- `test/obsidian-cli-default-routing.test.js`
- `test/obsidian-cli-default-workflow.test.js`

Inspect the unit-specific changed instructions and preserved boundaries. Canonical preflight runs this unit's registered routing and supplemental tests. Contract regression files, where listed, exercise the shared resolver retry and rejection boundaries. These checks support Candidate Complete; independent AC acceptance and fingerprint-bound review and verification are recorded separately through the runtime.

## Progress

| Phase | Status | Note |
|---|---|---|
| Development | Complete | Native payload `d2c8289303198a23892a418e2c41e0bde1eecf5e09cceedeeb17179995dce888`. |
| Testing | Complete | Routing and static checks passed. Preflight `6dc0ed5923076fa89592a52677a4a821e1fa81b253ce8ad9ede3796da3067a25`. Final audit `57da983f05636fa0f1902ef0d07500782149e84fca706f91c7bc614b6176a969` passed. |
| Acceptance | Complete | Independent AC verification and runtime-owned durable closure bind this owner. |
