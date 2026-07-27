# Wave 4 Doc Review Default Pack Readiness

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-07-25
> **Implementation Base SHA**: `2631aaff15b4a829f54ac34c2365887b0cb3e0e1`
> **Status**: Completed
> **Priority**: P0
> **Depends On**: [R4 — Alias Registry Capability](./2026-07-10-skill-alias-capability-r4.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

`codex-review-doc` and `doc-review` source behavior is assigned to the canonical `doc-review/default` owner. This ticket owns that exact promotion unit and its Codex-native delivery evidence.

## Requirements

- Preserve the bounded documentation accuracy and completeness review workflow while replacing source-runtime assumptions with Codex-native tools, authority, and evidence contracts.
- Keep `doc-review/default` as the only positive owner for its exact prompt contract.
- Keep `codex-review-doc` mapping-only without discovered compatibility entrypoints.

## Scope

| Scope | Description |
|---|---|
| In | Audit and prepare the `doc-review/default` payload, routing contract, and durable completion evidence. |
| Out | Other wave units, compatibility entrypoints, and publication of separate pack repositories |

## Related Files

| File | Action | Description |
|---|---|---|
| `migration/staging/codex-review-doc/` | Read | Canonical source evidence |
| `migration/candidates/doc-review/` | New | Audited Codex-native candidate |
| `migration/packs/quality-pack/doc-review/` | New | Final quality-pack payload |
| `test/doc-review-default-routing.test.js` | New | Trusted routing contract |
| `migration/source-disposition.json` | Update | Unit ownership and delivery evidence |

## Acceptance Criteria

- [x] Candidate preserves the complete documentation accuracy and completeness review workflow and its meaningful failure boundaries.
- [x] Contract binds every assigned source name to this single canonical promotion unit.
- [x] Compatibility aliases remain mapping-only and add no discovered skill entrypoints.
- [x] Trusted routing tests distinguish positive prompts from adjacent skill boundaries.
- [x] Candidate preflight binds exact payload and behavioral-test identity.
- [x] Final pack destination and move-window comparison are fixed for the accepted candidate bytes.
- [x] R3 closure inputs identify this exact request, promotion unit, evidence kind, and final-fingerprint fields.

## Progress

| Phase | Status | Note |
|---|---|---|
| Analysis | Complete | Source ownership, mode boundary, and target package are fixed by the migration registry. |
| Development | Complete | Candidate payload `e657290665baba76891145d61cf09a63a4d4bbb78e764e048d3b956a0524d7a0` and its closed behavior contract are complete. |
| Testing | Complete | Preflight `3b58b081c8b28a109d09bd2d95594b04ebf8c7770777faeed95173a224243f15` binds the candidate payload, routing tests, and disposition rows. Final pack audit `e6eb5f6f9033ab53cd39a19f95c4e470ab58ac2e69447aefafa65445bca96256` passed. |
| Acceptance | Complete | Independent AC verification, subject-bound review, deterministic verification, and final pack audit passed. The runtime-owned R3 closure and pack-ready evidence bind this exact Completed request. |

## References

- Tech Spec: [Skill Toolkit Migration](../2-tech-spec.md)
