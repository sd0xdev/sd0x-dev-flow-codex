# Wave 3 Test-Deep Development-Pack Handoff

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-07-15
> **Implementation Base SHA**: `2ff44f74eed09ab5fb8cde12b3d7cb5c223d0aed`
> **Status**: Candidate Complete
> **Priority**: P0
> **Depends On**: [R4 — Alias Registry Capability](./2026-07-10-skill-alias-capability-r4.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

The source `test-deep` workflow needs a development-pack owner for risk-led, broad test analysis and execution that remains distinct from focused post-development testing and formal verification.

## Requirements

- Build a risk map, expand coverage deliberately, and preserve exact failure evidence.
- Keep deep test investigation separate from implementation and gate attestation.

## Scope

| Scope | Description |
|---|---|
| In | Build and audit the `test-deep/default` development-pack handoff. |
| Out | Production edits, test generation as the primary task, core verification attestation, and publication |

## Related Files

| File | Action | Description |
|---|---|---|
| `migration/staging/test-deep/` | Read | Pinned source payload |
| `migration/candidates/test-deep/` | New | Codex-native candidate |
| `migration/packs/development-pack/test-deep/` | New | Pack-ready target |
| `test/test-deep-default-routing.test.js` | New | Trusted routing contract |
| `migration/source-disposition.json` | Update | Unit ownership and pack-ready state |

## Acceptance Criteria

- [x] Candidate derives a risk-led test matrix and reports exact commands, exits, and unresolved gaps.
- [x] Contract closes provenance, routing, capabilities, operations, and non-authoritative test boundaries.
- [x] Trusted routing tests distinguish deep testing from focused post-development tests, test generation, and formal verification.
- [x] Candidate preflight binds exact payload and behavioral-test identity.
- [x] Accepted bytes move only to `migration/packs/development-pack/test-deep/` and pass final pack audit.
- [x] R3 transaction inputs are ready to bind the Completed request and exact pack-ready evidence for `test-deep/default` after docs review and fresh deterministic verification.

## Progress

| Phase | Status | Note |
|---|---|---|
| Analysis | Complete | Pinned orchestration workflow reduced to risk-led, non-authoritative testing. |
| Development | Complete | Exact accepted bytes moved from `migration/candidates/` to `migration/packs/development-pack/test-deep/`; payload `9fa729dffbf8d7efd1552b701f994c8627563306b2b33ab89203632ba8bb1a7c`. |
| Testing | Complete | Preflight `2cdc9d4198c3b99660303f351275d72e15605536ce5e789863bff3d376908d40`; routing 6/6 passed. Final pack audit `9757f30385369cf7b11c57ba7327ec467b685fa75c6b482c398c294da97fd80f` passed. |
| Acceptance | Candidate Complete | Final pack audit and subject gates passed; runtime-owned R3 closure and pack-ready evidence remain pending. |

## References

- Tech Spec: [Skill Toolkit Migration](../2-tech-spec.md)
