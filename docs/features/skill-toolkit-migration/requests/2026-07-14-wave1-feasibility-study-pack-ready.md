# Wave 1 Feasibility-Study Planning-Pack Handoff

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-07-14
> **Implementation Base SHA**: `8e3efb425e3848cb537beda2101d16014114fe3d`
> **Status**: In Progress
> **Priority**: P0
> **Depends On**: [R4 — Alias Registry Capability](./2026-07-10-skill-alias-capability-r4.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

Feasibility analysis is a planning-pack decision workflow rather than a core lifecycle primitive. This ticket solely owns `feasibility-study/default`.

## Requirements

- Adapt the pinned feasibility workflow to Codex-native evidence collection and bounded conclusions.
- Close a non-core pack-ready handoff with no implicit external writes.

## Scope

| Scope | Description |
|---|---|
| In | Candidate、routing、pack handoff、closure and pack-ready evidence |
| Out | Architecture implementation、external connector setup、core admission |

## Related Files

| File | Action | Description |
|---|---|---|
| `migration/staging/feasibility-study/` | Read | Pinned source payload |
| `migration/candidates/feasibility-study/` | New | Codex-native candidate |
| `migration/packs/planning-pack/feasibility-study/` | New | Pack-ready payload |
| `test/feasibility-study-default-routing.test.js` | New | Trusted routing harness |
| `migration/source-disposition.json` | Update | Unit contract and owner |

## Acceptance Criteria

- [x] Workflow produces evidence-backed feasibility dimensions、constraints and explicit uncertainty without deciding necessity or architecture.
- [x] Candidate contract closes provenance、routing、capabilities and operations with external content treated as untrusted data.
- [x] Routing tests separate feasibility from necessity、architecture and technical-spec prompts.
- [x] Candidate preflight audit passes with exact resources and trusted test bytes.
- [x] Final pack path is non-core、contained and absent from core discovery.
- [ ] R3 transaction inputs are ready to bind the final payload and disposition in durable `pack-ready` evidence after docs review and fresh deterministic verification on the resulting Completed-request fingerprint.
- [ ] Pack handoff documentation records dependencies and later live-release requirements.

## Progress

| Phase | Status | Note |
|---|---|---|
| Analysis | Complete | Pinned feasibility dimensions、necessity/architecture boundary、Codex/MCP assumptions and external-evidence risks reviewed. |
| Development | Complete | Codex-native bounded study、uncertainty-aware template、pack handoff contract and deterministic routing harness implemented. Preflight `ea29962a22e209cdd3f7374327e4c7f85e5e7b04b7592dcca31b25e682faccc2` passed for payload `b512fad7c72d024c36926581b7b452c19ea4705f65d2785fb33ca66e7c85c066`, then exact bytes moved only to the planning-pack path. |
| Testing | Pending | |
| Acceptance | Pending | |

## References

- [Tech Spec](../2-tech-spec.md)
- [R4 — Alias Registry Capability](./2026-07-10-skill-alias-capability-r4.md)
