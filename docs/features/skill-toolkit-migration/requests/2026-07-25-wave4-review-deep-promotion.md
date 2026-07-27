# Wave 4 Review Deep Core Promotion

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-07-25
> **Implementation Base SHA**: `2631aaff15b4a829f54ac34c2365887b0cb3e0e1`
> **Status**: Completed
> **Priority**: P0
> **Depends On**: [R4 — Alias Registry Capability](./2026-07-10-skill-alias-capability-r4.md), [Wave 4 Review Default Core Promotion](./2026-07-25-wave4-review-default-promotion.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

`codex-cli-review` source behavior is assigned to the canonical `review/deep` owner. This ticket owns that exact promotion unit and its Codex-native delivery evidence.

## Requirements

- Preserve the bounded fingerprint-bound code review workflow while replacing source-runtime assumptions with Codex-native tools, authority, and evidence contracts.
- Keep `review/deep` as the only positive owner for its exact prompt contract.
- Keep `codex-cli-review` mapping-only without discovered compatibility entrypoints.

## Scope

| Scope | Description |
|---|---|
| In | Audit and promote the `review/deep` payload, routing contract, and durable completion evidence. |
| Out | Other wave units, compatibility entrypoints, and publication of separate pack repositories |

## Related Files

| File | Action | Description |
|---|---|---|
| `migration/staging/codex-cli-review/` | Read | Canonical source evidence |
| `migration/candidates/review/` | New | Audited Codex-native candidate |
| `plugin/sd0x-dev-flow-codex/skills/review/` | Update | Final core payload |
| `test/review-deep-routing.test.js` | New | Trusted routing contract |
| `migration/source-disposition.json` | Update | Unit ownership and delivery evidence |

## Acceptance Criteria

- [x] Candidate preserves the complete fingerprint-bound code review workflow and its meaningful failure boundaries.
- [x] Contract binds every assigned source name to this single canonical promotion unit.
- [x] Compatibility aliases remain mapping-only and add no discovered skill entrypoints.
- [x] Trusted routing tests distinguish positive prompts from adjacent skill boundaries.
- [x] Candidate preflight binds exact payload and behavioral-test identity.
- [x] Final core destination and move-window comparison are fixed for the accepted candidate bytes.
- [x] R3 closure inputs identify this exact request, promotion unit, evidence kind, and final-fingerprint fields.

## Progress

| Phase | Status | Note |
|---|---|---|
| Analysis | Complete | Source ownership, mode boundary, and target package are fixed by the migration registry. |
| Development | Complete | Candidate payload `0819aac5d91e9a0683dd82a5a0becc0a8dcb75cbe4c9ceb93858cb3cf8dc476f` and its closed behavior contract are complete. |
| Testing | Complete | Preflight `6f3b8becd793aaf131d0eaf0cf4b4164bc8c09038d824996247b7e218cbb087c` binds the candidate payload, routing tests, and disposition rows. Final audit `600d001a1c95dd4266d7a49188cc51c62c7ecf4feb1a2df7867707d7daee660c` passed. |
| Acceptance | Complete | Independent AC verification, subject-bound review, deterministic verification, and final core audit passed. The runtime-owned R3 closure and promotion evidence bind this exact Completed request. |

## References

- Tech Spec: [Skill Toolkit Migration](../2-tech-spec.md)
