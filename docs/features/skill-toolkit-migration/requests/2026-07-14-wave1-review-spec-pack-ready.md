# Wave 1 Review-Spec Planning-Pack Handoff

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-07-14
> **Implementation Base SHA**: `8e3efb425e3848cb537beda2101d16014114fe3d`
> **Status**: Candidate Complete
> **Priority**: P0
> **Depends On**: [R4 — Alias Registry Capability](./2026-07-10-skill-alias-capability-r4.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

Specification review checks problem/solution document conformance before implementation. It is distinct from plan review and the core code-review gate. This ticket solely owns `review-spec/default`.

## Requirements

- Adapt the source specification-review workflow to the repository lifecycle contract.
- Deliver it as a planning-pack handoff with read-only evidence semantics.

## Scope

| Scope | Description |
|---|---|
| In | Candidate、routing、pack handoff、closure and evidence |
| Out | Code review gates、plan generation、core admission |

## Related Files

| File | Action | Description |
|---|---|---|
| `migration/staging/review-spec/` | Read | Pinned source payload |
| `migration/candidates/review-spec/` | New | Codex-native candidate |
| `migration/packs/planning-pack/review-spec/` | New | Pack-ready payload |
| `test/review-spec-default-routing.test.js` | New | Trusted routing harness |
| `migration/source-disposition.json` | Update | Unit contract and owner |

## Acceptance Criteria

- [x] Workflow checks requirements/tech-spec layer boundaries、traceability、risks and testability without editing artifacts.
- [x] Candidate contract closes provenance、routing、capabilities and operations with no review-gate state mutation.
- [x] Routing tests distinguish spec review from plan review、code review and document generation.
- [x] Candidate preflight audit passes with exact payload and behavior evidence.
- [x] Final payload remains in planning-pack and outside core manifest/discovery.
- [x] R3 transaction inputs are ready to bind payload、spec and disposition in a durable `pack-ready` record after docs review and fresh deterministic verification on the resulting Completed-request fingerprint.
- [x] Pack handoff documents lifecycle dependencies and future separate-plugin release gates.

## Progress

| Phase | Status | Note |
|---|---|---|
| Analysis | Complete | Pinned spec-review dimensions、lifecycle layer boundaries、plan/code-review overlap and mutation risks reviewed. |
| Development | Complete | Codex-native read-only lifecycle-spec review、evidence-backed finding template、pack handoff contract and deterministic routing harness implemented. Preflight `98779fd97b2827a2ad318004dca52778f746873080130204bf6a52e83d75dc68` passed for payload `3cde1526283525dd7cf0104adf918b5cd580451e4fa03c6f0cf6e0b99c47a218`, then exact bytes moved only to the planning-pack path. |
| Testing | Complete | Exact-fingerprint review、386-test deterministic verification and final pack audit `efa53d5f06c61301a956226f5fcc2b29fb9b659c41dc14ac0c7b35bc2b7b7c7b` passed; core discovery remains unchanged. |
| Acceptance | Candidate Complete | All seven ACs have direct payload、contract、routing、audit and handoff evidence. Durable request closure and `pack-ready` recording remain the next transaction. |

## References

- [Tech Spec](../2-tech-spec.md)
- [R4 — Alias Registry Capability](./2026-07-10-skill-alias-capability-r4.md)
