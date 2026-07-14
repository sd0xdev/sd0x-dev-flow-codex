# Wave 1 Request-Tracking Planning-Pack Handoff

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-07-14
> **Implementation Base SHA**: `8e3efb425e3848cb537beda2101d16014114fe3d`
> **Status**: Candidate Complete
> **Priority**: P0
> **Depends On**: [R4 — Alias Registry Capability](./2026-07-10-skill-alias-capability-r4.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

Request portfolio tracking aggregates execution tickets but must not mutate their closure state. This ticket solely owns `request-tracking/default` in planning-pack.

## Requirements

- Port the pinned tracking workflow with deterministic read-only status aggregation.
- Produce pack-ready evidence without duplicating `create-request` mutation logic.

## Scope

| Scope | Description |
|---|---|
| In | Candidate、routing、pack handoff、closure and evidence |
| Out | Request creation/update、AC verification、core promotion |

## Related Files

| File | Action | Description |
|---|---|---|
| `migration/staging/request-tracking/` | Read | Pinned source payload |
| `migration/candidates/request-tracking/` | New | Codex-native candidate |
| `migration/packs/planning-pack/request-tracking/` | New | Pack-ready payload |
| `test/request-tracking-default-routing.test.js` | New | Trusted routing harness |
| `migration/source-disposition.json` | Update | Unit contract and owner |

## Acceptance Criteria

- [x] Workflow deterministically summarizes request status、priority、age and blockers without editing tickets or evidence refs.
- [x] Candidate contract closes provenance、routing、capabilities and read-only operations.
- [x] Routing tests separate portfolio tracking from create/update/verify-AC requests and general recap prompts.
- [x] Candidate preflight audit passes with exact source/resource and test identity.
- [x] Final payload is planning-pack-only and absent from core discovery.
- [x] R3 transaction inputs are ready to bind payload、spec and disposition in `pack-ready` evidence after docs review and fresh deterministic verification on the resulting Completed-request fingerprint.
- [x] Pack handoff documents parser/error behavior and dependency on request-format contracts.

## Progress

| Phase | Status | Note |
|---|---|---|
| Analysis | Complete | Pinned request knowledge base、current request-format contract、create-request overlap and malformed-terminal/link behavior reviewed. |
| Development | Complete | Codex-native read-only portfolio aggregation、parser/error contract、pack handoff specification and deterministic routing harness implemented. Preflight `1e7c95b23804faf785ecc6c44b000616d62069254206e459a3eb05292ab0da95` passed for payload `359bf28c280057e78e0a678c2c61b8bc4d34fbf94064699a3ab1852f2064e728`, then exact bytes moved only to the planning-pack path. |
| Testing | Complete | Exact-fingerprint review、386-test deterministic verification and final pack audit `5ad5752f272b8565b2aef5ae41388ed8dd35a220a92786d510c1ccc54dd943c0` passed; core discovery remains unchanged. |
| Acceptance | Candidate Complete | All seven ACs have direct payload、contract、routing、audit and handoff evidence. Durable request closure and `pack-ready` recording remain the next transaction. |

## References

- [Tech Spec](../2-tech-spec.md)
- [R4 — Alias Registry Capability](./2026-07-10-skill-alias-capability-r4.md)
