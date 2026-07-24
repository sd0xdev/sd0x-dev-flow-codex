# Wave 3 Test-Gen Development-Pack Handoff

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-07-15
> **Implementation Base SHA**: `2ff44f74eed09ab5fb8cde12b3d7cb5c223d0aed`
> **Status**: Completed
> **Priority**: P0
> **Depends On**: [R4 — Alias Registry Capability](./2026-07-10-skill-alias-capability-r4.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

The `codex-test-gen` source behavior needs a canonical, pack-scoped `test-gen/default` owner without exposing the compatibility alias as a public entrypoint.

## Requirements

- Adapt test generation to repository-native discovery, focused coverage, and executable evidence.
- Produce a transferable development-pack payload while keeping `codex-test-gen` mapping-only.

## Scope

| Scope | Description |
|---|---|
| In | Build and audit the `test-gen/default` development-pack handoff. |
| Out | Running a full post-development suite, core discovery, and separate-pack publication |

## Related Files

| File | Action | Description |
|---|---|---|
| `migration/staging/codex-test-gen/` | Read | Pinned source payload |
| `migration/candidates/test-gen/` | New | Codex-native candidate |
| `migration/packs/development-pack/test-gen/` | New | Pack-ready target |
| `test/test-gen-default-routing.test.js` | New | Trusted routing contract |
| `migration/source-disposition.json` | Update | Unit ownership and pack-ready state |

## Acceptance Criteria

- [x] Candidate generates focused tests from repository behavior and existing conventions without source-runtime assumptions.
- [x] Contract closes provenance, routing, capabilities, operations, and non-core authority boundaries.
- [x] `codex-test-gen` remains mapping-only and absent from core discovery.
- [x] Trusted routing tests distinguish test creation from implementation, debugging, and suite execution.
- [x] Candidate preflight binds exact payload and behavioral-test identity.
- [x] Accepted bytes move only to `migration/packs/development-pack/test-gen/` and pass final pack audit.
- [x] R3 transaction inputs are ready to bind the Completed request and exact pack-ready evidence for `test-gen/default` after docs review and fresh deterministic verification.

## Progress

| Phase | Status | Note |
|---|---|---|
| Analysis | Complete | Pinned alias behavior and repository-native test-generation boundary inspected. |
| Development | Complete | Exact accepted bytes moved from `migration/candidates/` to `migration/packs/development-pack/test-gen/`; payload `e29d598c2210f145885acc71bb2f5d9d7b5962a13e53483cc566f24579e22b4f`. |
| Testing | Complete | Preflight `e1e1546e894bee7dd48c5ca3ce189e89d6013d6f075bb2f7c19e70cacd244649`; routing 6/6 passed. Final pack audit `f074ae767db8ae772b082409b7208b942bc608674d72e0a64e337f8f97e02693` passed. |
| Acceptance | Complete | Independent AC verification, subject-bound review, deterministic verification, and final pack audit passed. The runtime-owned R3 closure and pack-ready evidence bind this exact Completed request. |

## References

- Tech Spec: [Skill Toolkit Migration](../2-tech-spec.md)
