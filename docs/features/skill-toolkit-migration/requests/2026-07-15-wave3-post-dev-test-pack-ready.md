# Wave 3 Post-Dev-Test Development-Pack Handoff

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-07-15
> **Implementation Base SHA**: `2ff44f74eed09ab5fb8cde12b3d7cb5c223d0aed`
> **Status**: Candidate Complete
> **Priority**: P0
> **Depends On**: [R4 — Alias Registry Capability](./2026-07-10-skill-alias-capability-r4.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

The source `post-dev-test` workflow needs a bounded development-pack owner for selecting and running repository tests after implementation without duplicating the core verification gate.

## Requirements

- Detect project test commands, run focused checks first, and report failures with reproducible evidence.
- Preserve the distinction between developer feedback and the authoritative `verify` gate.

## Scope

| Scope | Description |
|---|---|
| In | Build and audit the `post-dev-test/default` development-pack handoff. |
| Out | Gate attestation, test generation, production edits, core discovery, and publication |

## Related Files

| File | Action | Description |
|---|---|---|
| `migration/staging/post-dev-test/` | Read | Pinned source payload |
| `migration/candidates/post-dev-test/` | New | Codex-native candidate |
| `migration/packs/development-pack/post-dev-test/` | New | Pack-ready target |
| `test/post-dev-test-default-routing.test.js` | New | Trusted routing contract |
| `migration/source-disposition.json` | Update | Unit ownership and pack-ready state |

## Acceptance Criteria

- [x] Candidate selects and runs appropriate repository tests with exact command and exit evidence.
- [x] Contract closes provenance, routing, capabilities, operations, and non-authoritative test boundaries.
- [x] Trusted routing tests distinguish post-change execution from test generation and formal verification.
- [x] Candidate preflight binds exact payload and behavioral-test identity.
- [x] Accepted bytes move only to `migration/packs/development-pack/post-dev-test/` and pass final pack audit.
- [x] R3 transaction inputs are ready to bind the Completed request and exact pack-ready evidence for `post-dev-test/default` after docs review and fresh deterministic verification.

## Progress

| Phase | Status | Note |
|---|---|---|
| Analysis | Complete | Pinned test workflow and formal-verify boundary inspected. |
| Development | Complete | Exact accepted bytes moved from `migration/candidates/` to `migration/packs/development-pack/post-dev-test/`; payload `1b5bc220a0c9efecbd48d8087096bb19d8ac533b3ae2e2cdb80a9b8379b80635`. |
| Testing | Complete | Preflight `e2413dce13307c61a6788b7a0dce07735ee595a2242640f6d98586f3edfa83e1`; routing 6/6 passed. Final pack audit `eb49cea3b9e0136a15692877da57ce8fa42e66646fd6f204df76725e5f9a2bf6` passed. |
| Acceptance | Candidate Complete | Final pack audit and subject gates passed; runtime-owned R3 closure and pack-ready evidence remain pending. |

## References

- Tech Spec: [Skill Toolkit Migration](../2-tech-spec.md)
