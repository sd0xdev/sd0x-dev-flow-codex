# Wave 3 Debug Development-Pack Handoff

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-07-15
> **Implementation Base SHA**: `2ff44f74eed09ab5fb8cde12b3d7cb5c223d0aed`
> **Status**: Candidate Complete
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
- [x] Accepted bytes move only to `migration/packs/development-pack/debug/` and pass final pack audit.
- [x] R3 transaction inputs are ready to bind the Completed request and exact pack-ready evidence for `debug/default` after docs review and fresh deterministic verification.

## Progress

| Phase | Status | Note |
|---|---|---|
| Analysis | Complete | Pinned diagnostic workflow and read-only mutation boundary inspected. |
| Development | Complete | Exact accepted bytes moved from `migration/candidates/` to `migration/packs/development-pack/debug/`; payload `3be8e58dee32838dd3cce7afbae0d4948ba7e4a124c8581d5eed15a3627e922f`. |
| Testing | Complete | Preflight `1b304a17e569db55ae45a0b1185bae1ea3cde4b6774928423baeb4dc15638a12`; routing 6/6 and probe-policy 16/16 passed. Final pack audit `b63c7eb16503dcbeb7ab2697919f34075e677abc35067988774cddd94197ae73` passed. |
| Acceptance | Candidate Complete | Final pack audit and subject gates passed; runtime-owned R3 closure and pack-ready evidence remain pending. |

## References

- Tech Spec: [Skill Toolkit Migration](../2-tech-spec.md)
