# Wave 1 Necessity-Audit Planning-Pack Handoff

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-07-14
> **Implementation Base SHA**: `8e3efb425e3848cb537beda2101d16014114fe3d`
> **Status**: In Progress
> **Priority**: P0
> **Depends On**: [R4 — Alias Registry Capability](./2026-07-10-skill-alias-capability-r4.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

Necessity evaluation challenges whether work should exist before feasibility or design. It belongs in the planning pack and this ticket solely owns `necessity-audit/default`.

## Requirements

- Adapt the source challenge workflow with explicit evidence、alternatives and stop criteria.
- Deliver a non-core pack-ready payload and durable handoff evidence.

## Scope

| Scope | Description |
|---|---|
| In | Candidate、routing、pack handoff、closure and evidence |
| Out | Feasibility scoring、architecture、implementation and core discovery |

## Related Files

| File | Action | Description |
|---|---|---|
| `migration/staging/necessity-audit/` | Read | Pinned source payload |
| `migration/candidates/necessity-audit/` | New | Codex-native candidate |
| `migration/packs/planning-pack/necessity-audit/` | New | Pack-ready payload |
| `test/necessity-audit-default-routing.test.js` | New | Trusted routing harness |
| `migration/source-disposition.json` | Update | Unit contract and owner |

## Acceptance Criteria

- [x] Workflow tests problem necessity、status quo and cheaper alternatives without silently becoming feasibility or design review.
- [x] Candidate contract closes provenance、routing、capabilities and operations and contains no Claude-only tool assumptions.
- [x] Routing tests uniquely select necessity prompts and exclude feasibility、plan review and implementation.
- [x] Candidate preflight audit passes with exact payload and routing evidence.
- [x] Final payload is confined to the planning pack and rejected from core manifest/discovery.
- [ ] R3 transaction inputs are ready to bind final bytes and disposition in `pack-ready` evidence after docs review and fresh deterministic verification on the resulting Completed-request fingerprint.
- [ ] Handoff documentation records dependencies、limitations and separate-plugin release work.

## Progress

| Phase | Status | Note |
|---|---|---|
| Analysis | Complete | Pinned seven-phase script/debate workflow、necessity dimensions、feasibility/plan-review boundaries and Claude-only assumptions reviewed. |
| Development | Complete | Codex-native response-only necessity challenge、explicit verdict template、pack handoff contract and deterministic routing harness implemented. Preflight `c8d81199f0e5a80469a7e388a5abe72441254c1cbebe53ed8dccf07894ff2f3b` passed for payload `c8f46ae7ef60bea4dc667b4f1b0ac93c75b6ccec9a3c4e6675f9f15ddbf25f08`, then exact bytes moved only to the planning-pack path. |
| Testing | Pending | |
| Acceptance | Pending | |

## References

- [Tech Spec](../2-tech-spec.md)
- [R4 — Alias Registry Capability](./2026-07-10-skill-alias-capability-r4.md)
