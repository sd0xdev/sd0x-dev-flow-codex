# Wave 2 Architecture Advice Research-Pack Handoff

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-07-15
> **Implementation Base SHA**: `a8af4196c453319f647d945c6c0f351775e71641`
> **Status**: Candidate Complete
> **Priority**: P0
> **Depends On**: [R4 — Alias Registry Capability](./2026-07-10-skill-alias-capability-r4.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

Source `codex-architect` belongs in the separate research pack, not the curated core. This ticket solely owns the `architecture-advice/default` pack-ready handoff.

## Requirements

- Codex-native architecture second opinion.
- Produce transferable pack-ready evidence without adding a core skill entrypoint.

## Scope

| Scope | Description |
|---|---|
| In | Answer-only architecture options and tradeoffs; no lifecycle document or implementation. |
| Out | Separate-repository release, core manifest changes, other Wave 2 units, production or external-system mutation |

## Related Files

| File | Action | Description |
|---|---|---|
| `migration/staging/codex-architect/` | Read | Pinned source payload |
| `migration/candidates/architecture-advice/` | New | Audited candidate |
| `migration/packs/research-pack/architecture-advice/` | New | Pack-ready payload |
| `test/architecture-advice-default-routing.test.js` | New | Trusted routing harness |
| `migration/source-disposition.json` | Update | Capabilities, operations, state, and owner |
| `docs/PROJECT-MIGRATION-GUIDE.md` | Update | Pack boundary and completion scope |

## Acceptance Criteria

- [x] Candidate preserves the bounded `codex-architect` behavior while replacing unsupported source-runtime assumptions with Codex-native orchestration.
- [x] Candidate contract closes provenance, boundaries, capabilities, and operations for `architecture-advice/default`.
- [x] Trusted positive and negative prompt cases prove one unambiguous owner and adjacent-workflow exclusions.
- [x] Candidate preflight audit passes with exact payload and test identity.
- [x] Final payload moves only to `migration/packs/research-pack/architecture-advice/` and remains absent from core manifest and discovery.
- [x] R3 transaction inputs are ready to bind the final payload, specification, disposition, and AC evidence after docs review and fresh deterministic verification on the resulting Completed-request fingerprint.
- [x] Research-pack handoff text is sufficient for a later separate-plugin repository without implying publication.

## Progress

| Phase | Status | Note |
|---|---|---|
| Analysis | Complete | Pinned source, research-pack boundary, unsupported assumptions, and behavioral contract inspected. |
| Development | Complete | Exact accepted bytes moved from `migration/candidates/` to `migration/packs/research-pack/`; the candidate directory is empty. |
| Testing | Complete | 12/12 preflights, 125/125 focused tests, six named fixtures, and adversarial probes passed. Payload `983cc643c5e161b139089f9e470eeb2a09100fc637cf72e86188326870092357`; preflight `c9f3ad76a06def5c78007167b2119170f3cd83cc3d6ad50f8f1e20602e0c124e`. |
| Acceptance | Candidate Complete | Independent create-request AC verifier returned terminal PASS; fresh final-fingerprint review, verification, and R3 durable closure remain. |

## References

- [Tech Spec](../2-tech-spec.md)
- [R4 — Alias Registry Capability](./2026-07-10-skill-alias-capability-r4.md)
