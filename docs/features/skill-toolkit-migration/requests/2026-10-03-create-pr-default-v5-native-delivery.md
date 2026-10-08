# Native v5 Delivery — create-pr/default

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-10-03
> **Implementation Base SHA**: `6782d7f0e3c38bc48b60b7002dd2343796ef0374`
> **Status**: Completed
> **Priority**: P1
> **Depends On**: [Previous durable owner](./2026-09-06-model-trust-create-pr-default-revision.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

The user requested the complete applicable upstream v5 native migration. This replacement owns only `create-pr/default`; its previous owner and durable evidence remain historical records. Routine choices should produce a supported deliverable while actual authority, containment, and evidence boundaries remain intact.

## Acceptance Criteria

- [x] Add explicit report/link/push/submit stack workflow with preserved base and chain, exact OID/lease plans, per-PR payload scans and native Stack API operations.
- [x] Reject protected or ambiguous mutations, distinguish absence from unavailable API and partial publication, and preserve single-PR scope plus explicit user authority.

## Related Files and Validation

- `plugin/sd0x-dev-flow-codex/skills/create-pr/SKILL.md`
- `plugin/sd0x-dev-flow-codex/skills/create-pr/migration-contract.json`
- `test/create-pr-default-routing.test.js`
- `test/create-pr-default-workflow.test.js`

Inspect the unit-specific changed instructions and preserved boundaries. Canonical preflight runs this unit's registered routing and supplemental tests. Contract regression files, where listed, exercise the shared resolver retry and rejection boundaries. These checks support Candidate Complete; independent AC acceptance and fingerprint-bound review and verification are recorded separately through the runtime.

## Progress

| Phase | Status | Note |
|---|---|---|
| Development | Complete | Native payload `30a44805f78b060ebe60d95c7a49fd844ca388da8e6dbdb265eba6e11ac8083a`. |
| Testing | Complete | Routing and static checks passed. Preflight `e88bd15e74c0b40762a6344d30ad83998cd4068521b930057bfc967d762dc9f1`. Final audit `f446bfaca249544a958e37497f93d72b9f35b1dfea75c331b4e77c7974f99a35` passed. |
| Acceptance | Complete | Independent AC verification and runtime-owned durable closure bind this owner. |
