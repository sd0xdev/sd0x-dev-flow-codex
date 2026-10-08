# Native v5 Delivery — ask/default

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-10-03
> **Implementation Base SHA**: `6782d7f0e3c38bc48b60b7002dd2343796ef0374`
> **Status**: Completed
> **Priority**: P1
> **Depends On**: [Previous durable owner](./2026-09-12-behavior-eval-ask-default-revision.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

The user requested the complete applicable upstream v5 native migration. This replacement owns only `ask/default`; its previous owner and durable evidence remain historical records. Routine choices should produce a supported deliverable while actual authority, containment, and evidence boundaries remain intact.

## Acceptance Criteria

- [x] In ask/default, consume complete authority-aware feature context with exact intent identity, corpus completeness and role-specific document obligations while preserving the existing mode's outcome.
- [x] Distinguish failed reads and ambiguity from absence; preserve user-owned intent and dated records, resolve routine gaps autonomously, and retain all previously accepted authorization and gate boundaries.

## Related Files and Validation

- `plugin/sd0x-dev-flow-codex/skills/ask/SKILL.md`
- `test/ask-default-behavior.test.js`
- `test/ask-default-routing.test.js`

Inspect the unit-specific changed instructions and preserved boundaries. Canonical preflight runs this unit's registered routing and supplemental tests. Contract regression files, where listed, exercise the shared resolver retry and rejection boundaries. These checks support Candidate Complete; independent AC acceptance and fingerprint-bound review and verification are recorded separately through the runtime.

## Progress

| Phase | Status | Note |
|---|---|---|
| Development | Complete | Native payload `edcd3f2da4abbfac083ce71168acb5fe817addfb0aab2f625195156534475c82`. |
| Testing | Complete | Routing and static checks passed. Preflight `d6f3ae9e425696dd930750d725f2e164b6e9aa5717303b4356c5e55a549e523d`. Final audit `51577cbe87b04624fc014720a4afd7a97f58b02852300b9ee641546141697a43` passed. |
| Acceptance | Complete | Independent AC verification and runtime-owned durable closure bind this owner. |
