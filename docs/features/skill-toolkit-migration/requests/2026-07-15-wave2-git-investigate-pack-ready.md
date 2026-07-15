# Wave 2 Git Investigate Research-Pack Handoff

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-07-15
> **Implementation Base SHA**: `a8af4196c453319f647d945c6c0f351775e71641`
> **Status**: Candidate Complete
> **Priority**: P0
> **Depends On**: [R4 — Alias Registry Capability](./2026-07-10-skill-alias-capability-r4.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

Source `git-investigate` belongs in the separate research pack, not the curated core. This ticket solely owns the `git-investigate/default` pack-ready handoff.

## Requirements

- Codex-native Git archaeology.
- Produce transferable pack-ready evidence without adding a core skill entrypoint.

## Scope

| Scope | Description |
|---|---|
| In | Read-only blame/log/diff history tracing with evidence. |
| Out | Separate-repository release, core manifest changes, other Wave 2 units, production or external-system mutation |

## Related Files

| File | Action | Description |
|---|---|---|
| `migration/staging/git-investigate/` | Read | Pinned source payload |
| `migration/candidates/git-investigate/` | New | Audited candidate |
| `migration/packs/research-pack/git-investigate/` | New | Pack-ready payload |
| `test/git-investigate-default-routing.test.js` | New | Trusted routing harness |
| `migration/source-disposition.json` | Update | Capabilities, operations, state, and owner |
| `docs/PROJECT-MIGRATION-GUIDE.md` | Update | Pack boundary and completion scope |

## Acceptance Criteria

- [x] Candidate preserves the bounded `git-investigate` behavior while replacing unsupported source-runtime assumptions with Codex-native orchestration.
- [x] Candidate contract closes provenance, boundaries, capabilities, and operations for `git-investigate/default`.
- [x] Trusted positive and negative prompt cases prove one unambiguous owner and adjacent-workflow exclusions.
- [x] Candidate preflight audit passes with exact payload and test identity.
- [x] Final payload moves only to `migration/packs/research-pack/git-investigate/` and remains absent from core manifest and discovery.
- [x] R3 transaction inputs are ready to bind the final payload, specification, disposition, and AC evidence after docs review and fresh deterministic verification on the resulting Completed-request fingerprint.
- [x] Research-pack handoff text is sufficient for a later separate-plugin repository without implying publication.

## Progress

| Phase | Status | Note |
|---|---|---|
| Analysis | Complete | Pinned source, research-pack boundary, unsupported assumptions, and behavioral contract inspected. |
| Development | Complete | Exact accepted bytes moved from `migration/candidates/` to `migration/packs/research-pack/`; the candidate directory is empty. |
| Testing | Complete | 12/12 preflights, 125/125 focused tests, six named fixtures, and adversarial probes passed. Payload `a2b70ad723aab04519fcda3d8e1b40a52cebace1b68ef47d8f3a6304cfea1f8f`; preflight `3563712f401aea71efefb12acfcc50a6f6a9a036ded150948b9c9dfb5ab0c36b`. |
| Acceptance | Candidate Complete | Independent create-request AC verifier returned terminal PASS; fresh final-fingerprint review, verification, and R3 durable closure remain. |

## References

- [Tech Spec](../2-tech-spec.md)
- [R4 — Alias Registry Capability](./2026-07-10-skill-alias-capability-r4.md)
