# Native v5 Delivery — issue-analyze/default

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-10-03
> **Implementation Base SHA**: `6782d7f0e3c38bc48b60b7002dd2343796ef0374`
> **Status**: Completed
> **Priority**: P1
> **Depends On**: [Previous durable owner](./2026-09-06-model-trust-issue-analyze-default-revision.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

The user requested the complete applicable upstream v5 native migration. This replacement owns only `issue-analyze/default`; its previous owner and durable evidence remain historical records. Routine choices should produce a supported deliverable while actual authority, containment, and evidence boundaries remain intact.

## Acceptance Criteria

- [x] Classify issue evidence provisionally and use a requested fresh independent read-only assessment with neutral evidence, preserving observed confidence and supported policy mapping when it actually executes.
- [x] When independent assessment cannot execute, report UNAVAILABLE with the observed reason, omit confidence and mark policy mapping unavailable; continue supported diagnosis without inventing a verdict, dismissing P0/P1, or changing files, external state or gates.

## Related Files and Validation

- `plugin/sd0x-dev-flow-codex/skills/issue-analyze/SKILL.md`
- `test/issue-analyze-default-routing.test.js`

Inspect the unit-specific changed instructions and preserved boundaries. Canonical preflight runs this unit's registered routing and supplemental tests. Contract regression files, where listed, exercise the shared resolver retry and rejection boundaries. These checks support Candidate Complete; independent AC acceptance and fingerprint-bound review and verification are recorded separately through the runtime.

## Progress

| Phase | Status | Note |
|---|---|---|
| Development | Complete | Native payload `e6ff667c645d870b1cfb81e18cba5220f485daa98f9d2ed1cfb6377fe226ddd7`. |
| Testing | Complete | Routing and static checks passed. Preflight `d1a9f80c5a0155c45dbf17778da9f51525e70395c3bedd70241ae232e039466a`. Final audit `ed951f076cd8809e7edc75cde09797ba2dbe0a634a94780b1bd01eadc0cac00c` passed. |
| Acceptance | Complete | Independent AC verification and runtime-owned durable closure bind this owner. |
