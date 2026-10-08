# Native v5 Delivery — recap-ask/default

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-10-03
> **Implementation Base SHA**: `6782d7f0e3c38bc48b60b7002dd2343796ef0374`
> **Status**: Completed
> **Priority**: P1
> **Depends On**: [Previous durable owner](./2026-09-30-recap-ask-default-autonomous-delivery.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

The user requested the complete applicable upstream v5 native migration. This replacement owns only `recap-ask/default`; its previous owner and durable evidence remain historical records. Routine choices should produce a supported deliverable while actual authority, containment, and evidence boundaries remain intact.

## Acceptance Criteria

- [x] In recap-ask/default, consume complete authority-aware feature context with exact intent identity, corpus completeness and role-specific document obligations while preserving the existing mode's outcome.
- [x] Distinguish failed reads and ambiguity from absence; preserve user-owned intent and dated records, resolve routine gaps autonomously, and retain all previously accepted authorization and gate boundaries.

## Related Files and Validation

- `plugin/sd0x-dev-flow-codex/skills/recap-ask/SKILL.md`
- `test/recap-ask-default-routing.test.js`
- `test/recap-ask-default-workflow.test.js`

Inspect the unit-specific changed instructions and preserved boundaries. Canonical preflight runs this unit's registered routing and supplemental tests. Contract regression files, where listed, exercise the shared resolver retry and rejection boundaries. These checks support Candidate Complete; independent AC acceptance and fingerprint-bound review and verification are recorded separately through the runtime.

## Progress

| Phase | Status | Note |
|---|---|---|
| Development | Complete | Native payload `809dcfcbe04b0883c702af65cb8ebe1983f27d12edc02950fc26c7f54a86d2da`. |
| Testing | Complete | Routing and static checks passed. Preflight `80fdbf0f36f5102a5c6d9f958c212e765167b8beee8a84842e0146ba9802098b`. Final audit `b555d3093a7e907b62b391f356429f2001383bd026c4bf269a871fac218b7125` passed. |
| Acceptance | Complete | Independent AC verification and runtime-owned durable closure bind this owner. |
