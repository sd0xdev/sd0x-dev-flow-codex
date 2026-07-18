# Wave 3 Debug Development-Pack Handoff

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-07-15
> **Implementation Base SHA**: `2ff44f74eed09ab5fb8cde12b3d7cb5c223d0aed`
> **Status**: In Progress
> **Priority**: P0
> **Depends On**: [R4 — Alias Registry Capability](./2026-07-10-skill-alias-capability-r4.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

The source `debug` workflow needs a Codex-native diagnostic owner in the development pack, separate from the core bug-fix workflow that is authorized to implement corrections.

## Requirements

- Preserve evidence-led analysis, optional fixed read-only probes, execution-path tracing, and root-cause reporting.
- Keep diagnosis read-only unless the user separately authorizes a fix workflow.

## Scope

| Scope | Description |
|---|---|
| In | Build and audit the `debug/default` development-pack handoff. |
| Out | Production fixes, unrelated feature work, core discovery, and external publication |

## Related Files

| File | Action | Description |
|---|---|---|
| `migration/staging/debug/` | Read | Pinned source payload |
| `migration/candidates/debug/` | New | Codex-native candidate |
| `migration/packs/development-pack/debug/` | New | Pack-ready target |
| `test/debug-default-routing.test.js` | New | Trusted routing contract |
| `test/debug-probe-policy.test.js` | New | Probe default-deny, limits, and redaction regressions |
| `migration/source-disposition.json` | Update | Unit ownership and pack-ready state |

## Acceptance Criteria

- [x] Candidate analyzes supplied or safely probed evidence without silently implementing a fix.
- [x] Contract closes provenance, routing, capabilities, operations, and read-only authority boundaries.
- [x] Trusted routing tests distinguish diagnosis from bug fixing, feature implementation, and review.
- [x] Candidate preflight binds exact payload, generated routing test, and supplemental probe-harness identity.
- [ ] Accepted bytes move only to `migration/packs/development-pack/debug/` and pass final pack audit.
- [ ] Runtime closure records exact pack-ready evidence for `debug/default`.

## Progress

| Phase | Status | Note |
|---|---|---|
| Analysis | Complete | Pinned diagnostic workflow and read-only mutation boundary inspected. |
| Development | Complete | Codex-native schema-v3 candidate and trusted-bound default-deny probe runner prepared; payload `41c2bb8a18e6b2efdfb2242d1753f7176682470567f19030c9395f4024f82794`. |
| Testing | Complete | Preflight `a3db7a58e6cab0a602372d97184185593e35dc93080dd2155a356e1335d01264`; routing 6/6 and probe-policy 15/15 passed. |
| Acceptance | Pending | |

## References

- Tech Spec: [Skill Toolkit Migration](../2-tech-spec.md)
