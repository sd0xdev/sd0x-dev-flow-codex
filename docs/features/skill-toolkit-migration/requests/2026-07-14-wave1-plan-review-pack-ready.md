# Wave 1 Plan-Review Planning-Pack Handoff

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-07-14
> **Implementation Base SHA**: `8e3efb425e3848cb537beda2101d16014114fe3d`
> **Status**: Candidate Complete
> **Priority**: P0
> **Depends On**: [R4 — Alias Registry Capability](./2026-07-10-skill-alias-capability-r4.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

Plan review is an independent planning-quality workflow, not the implementation review gate. This ticket solely owns `plan-review/default` in planning-pack.

## Requirements

- Adapt source plan critique to Codex-native read-only evidence and actionable findings.
- Keep it distinct from fingerprint-bound code review and from `review-spec`.

## Scope

| Scope | Description |
|---|---|
| In | Candidate、routing、planning-pack handoff、closure and evidence |
| Out | Code review gate、spec conformance review、core promotion |

## Related Files

| File | Action | Description |
|---|---|---|
| `migration/staging/plan-review/` | Read | Pinned source payload |
| `migration/candidates/plan-review/` | New | Codex-native candidate |
| `migration/packs/planning-pack/plan-review/` | New | Pack-ready payload |
| `test/plan-review-default-routing.test.js` | New | Trusted routing harness |
| `migration/source-disposition.json` | Update | Unit contract and owner |

## Acceptance Criteria

- [x] Workflow evaluates completeness、ordering、risk and verification of plans without modifying implementation or recording review gates.
- [x] Candidate contract closes provenance、routing、capabilities and operations as read-only unless separately justified.
- [x] Routing tests distinguish plan critique from code review、review-spec and architecture generation.
- [x] Candidate preflight audit passes with exact payload and behavior evidence.
- [x] Final payload is contained under planning-pack and absent from core discovery.
- [x] R3 transaction inputs are ready to bind payload、spec and disposition in a `pack-ready` record after docs review and fresh deterministic verification on the resulting Completed-request fingerprint.
- [x] Pack handoff notes the separation from the core `review` runtime gate.

## Progress

| Phase | Status | Note |
|---|---|---|
| Analysis | Complete | Pinned plan-mode state loop、sentinels、Claude/MCP dependencies and core review-gate collision risks reviewed. |
| Development | Complete | Codex-native response-only plan critique、actionable-finding template、pack handoff contract and deterministic routing harness implemented. Preflight `2570963a3f20d6a7326d279371e18946641c2c430642e5ca8967a8c8c608ece6` passed for payload `9fc9b391ea0a598109ac49cc1756fe6ac4810997baeeec4882d39ca41db8d72d`, then exact bytes moved only to the planning-pack path. |
| Testing | Complete | Exact-fingerprint review、386-test deterministic verification and final pack audit `6dafa6ed26c7263288bfacfd3f78084a0b602552a256328dcdb9484af420fb19` passed; core discovery remains unchanged. |
| Acceptance | Candidate Complete | All seven ACs have direct payload、contract、routing、audit and handoff evidence. Durable request closure and `pack-ready` recording remain the next transaction. |

## References

- [Tech Spec](../2-tech-spec.md)
- [R4 — Alias Registry Capability](./2026-07-10-skill-alias-capability-r4.md)
