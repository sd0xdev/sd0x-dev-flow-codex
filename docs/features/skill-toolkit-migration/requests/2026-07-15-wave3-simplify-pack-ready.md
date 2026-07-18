# Wave 3 Simplify Development-Pack Handoff

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-07-15
> **Implementation Base SHA**: `2ff44f74eed09ab5fb8cde12b3d7cb5c223d0aed`
> **Status**: In Progress
> **Priority**: P0
> **Depends On**: [R4 — Alias Registry Capability](./2026-07-10-skill-alias-capability-r4.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

The source `simplify` workflow needs a development-pack owner for reducing unnecessary complexity without changing intended behavior or expanding scope.

## Requirements

- Remove incidental complexity through small, reviewable edits.
- Preserve behavior and reject speculative or unrelated cleanup.

## Scope

| Scope | Description |
|---|---|
| In | Build and audit the `simplify/default` development-pack handoff. |
| Out | Architectural redesign, new features, broad refactors, core discovery, and publication |

## Related Files

| File | Action | Description |
|---|---|---|
| `migration/staging/simplify/` | Read | Pinned source payload |
| `migration/candidates/simplify/` | New | Codex-native candidate |
| `migration/packs/development-pack/simplify/` | New | Pack-ready target |
| `test/simplify-default-routing.test.js` | New | Trusted routing contract |
| `migration/source-disposition.json` | Update | Unit ownership and pack-ready state |

## Acceptance Criteria

- [x] Candidate reduces a named complexity while preserving behavior and keeping edits minimal.
- [x] Contract closes provenance, routing, capabilities, operations, and mutation boundaries.
- [x] Trusted routing tests distinguish simplification from refactoring, feature work, and architecture design.
- [x] Candidate preflight binds exact payload and behavioral-test identity.
- [ ] Accepted bytes move only to `migration/packs/development-pack/simplify/` and pass final pack audit.
- [ ] Runtime closure records exact pack-ready evidence for `simplify/default`.

## Progress

| Phase | Status | Note |
|---|---|---|
| Analysis | Complete | Pinned simplification behavior and behavior-preservation boundary inspected. |
| Development | Complete | Codex-native candidate prepared; payload `633e9504406a8c47eb203cca12cafacac7b2e2e1a0c709aff19f0cf6961e7e08`. |
| Testing | Complete | Preflight `94ba3c124c5ec22c2a269527d52898f538cab502629aa5114a06cfa2eae85bc7`; routing 6/6 passed. |
| Acceptance | Pending | |

## References

- Tech Spec: [Skill Toolkit Migration](../2-tech-spec.md)
