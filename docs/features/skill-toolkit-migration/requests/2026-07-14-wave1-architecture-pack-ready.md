# Wave 1 Architecture Planning-Pack Handoff

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-07-14
> **Implementation Base SHA**: `8e3efb425e3848cb537beda2101d16014114fe3d`
> **Status**: In Progress
> **Priority**: P0
> **Depends On**: [R4 — Alias Registry Capability](./2026-07-10-skill-alias-capability-r4.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

Source `architecture` belongs in the separate planning pack, not the curated core. This ticket solely owns the `architecture/default` pack-ready handoff.

## Requirements

- Port the pinned architecture workflow into a Codex-native planning-pack candidate.
- Produce transferable pack-ready evidence without adding a core skill entrypoint.

## Scope

| Scope | Description |
|---|---|
| In | Candidate、routing、pack specification、pack-ready closure and evidence |
| Out | Separate-repository release、core manifest changes、other planning units |

## Related Files

| File | Action | Description |
|---|---|---|
| `migration/staging/architecture/` | Read | Pinned source payload |
| `migration/candidates/architecture/` | New | Audited candidate |
| `migration/packs/planning-pack/architecture/` | New | Pack-ready payload |
| `test/architecture-default-routing.test.js` | New | Trusted routing harness |
| `migration/source-disposition.json` | Update | Capabilities、operations、state and owner |
| `docs/PROJECT-MIGRATION-GUIDE.md` | Update | Pack boundary and completion scope |

## Acceptance Criteria

- [x] Candidate preserves bounded architecture planning and excludes implementation、requirements and mutation authority.
- [x] Candidate contract closes provenance、routing、capabilities and operations for `architecture/default`.
- [x] Trusted routing tests prove unique positive prompts and negative lifecycle/implementation boundaries.
- [x] Candidate preflight audit passes with exact payload and test identity.
- [x] Final payload moves only to `migration/packs/planning-pack/architecture/` and remains absent from core manifest/discovery.
- [ ] R3 transaction inputs are ready to bind the final payload、spec and disposition in a durable `pack-ready` record after docs review and fresh deterministic verification on the resulting Completed-request fingerprint.
- [ ] Planning-pack dependency/spec and migration guide are sufficient for a later separate-plugin repository handoff.

## Progress

| Phase | Status | Note |
|---|---|---|
| Analysis | Complete | Pinned source、planning-pack boundary、Claude/MCP assumptions and artifact ownership reviewed. |
| Development | Complete | Codex-native bounded architecture workflow、pack handoff specification、closed contract and deterministic routing harness implemented. Preflight `1210c392ae37316e2cf79d543fb083ab8db0425453e642c06d3a455812f1757f` passed for payload `3f387bee80432cfb95c55f4e222526fcfb727807f7941ab9ea62671978f481d0`, then exact bytes moved only to the planning-pack path. |
| Testing | Pending | |
| Acceptance | Pending | |

## References

- [Tech Spec](../2-tech-spec.md)
- [R4 — Alias Registry Capability](./2026-07-10-skill-alias-capability-r4.md)
