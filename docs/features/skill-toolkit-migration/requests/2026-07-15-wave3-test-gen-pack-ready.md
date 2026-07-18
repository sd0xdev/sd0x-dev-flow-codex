# Wave 3 Test-Gen Development-Pack Handoff

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-07-15
> **Implementation Base SHA**: `2ff44f74eed09ab5fb8cde12b3d7cb5c223d0aed`
> **Status**: In Progress
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
- [ ] Accepted bytes move only to `migration/packs/development-pack/test-gen/` and pass final pack audit.
- [ ] Runtime closure records exact pack-ready evidence for `test-gen/default`.

## Progress

| Phase | Status | Note |
|---|---|---|
| Analysis | Complete | Pinned alias behavior and repository-native test-generation boundary inspected. |
| Development | Complete | Codex-native candidate prepared; payload `59a5c44f5704e5fcb8c2d7df082996dcc77007aec7b73eae43da9171b4653164`. |
| Testing | Complete | Preflight `3cdb52e01a933535fee4ab41d57827fbfb386aa5c3fb01f60ad1aa6dc12d3d27`; routing 6/6 passed. |
| Acceptance | Pending | |

## References

- Tech Spec: [Skill Toolkit Migration](../2-tech-spec.md)
