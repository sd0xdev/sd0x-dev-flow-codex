# Wave 4 Test Review Default Pack Readiness

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-07-25
> **Implementation Base SHA**: `2631aaff15b4a829f54ac34c2365887b0cb3e0e1`
> **Status**: Completed
> **Priority**: P0
> **Depends On**: [R4 — Alias Registry Capability](./2026-07-10-skill-alias-capability-r4.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

`codex-test-review` and `test-review` source behavior is assigned to the canonical `test-review/default` owner. This ticket owns that exact promotion unit and its Codex-native delivery evidence.

## Requirements

- Preserve the bounded test sufficiency and quality review workflow while replacing source-runtime assumptions with Codex-native tools, authority, and evidence contracts.
- Keep `test-review/default` as the only positive owner for its exact prompt contract.
- Keep `codex-test-review` mapping-only without discovered compatibility entrypoints.

## Scope

| Scope | Description |
|---|---|
| In | Audit and prepare the `test-review/default` payload, routing contract, and durable completion evidence. |
| Out | Other wave units, compatibility entrypoints, and publication of separate pack repositories |

## Related Files

| File | Action | Description |
|---|---|---|
| `migration/staging/codex-test-review/` | Read | Canonical source evidence |
| `migration/candidates/test-review/` | New | Audited Codex-native candidate |
| `migration/packs/quality-pack/test-review/` | New | Final quality-pack payload |
| `test/test-review-default-routing.test.js` | New | Trusted routing contract |
| `migration/source-disposition.json` | Update | Unit ownership and delivery evidence |

## Acceptance Criteria

- [x] Candidate preserves the complete test sufficiency and quality review workflow and its meaningful failure boundaries.
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
| Development | Complete | Candidate payload `6573466d62d641da0f7a8e953739b99548c5811ad6e717d8712e563d907049e9` and its closed behavior contract are complete. |
| Testing | Complete | Preflight `c8d12656ea3fe39e9502092474f7d919afb23177fbbc1f13700884fbba981595` binds the candidate payload, routing tests, and disposition rows. Final pack audit `f65e992a2a5362b289080bc0a71a5b5743c30fd8190d03cf909f583fe5fe98eb` passed. |
| Acceptance | Complete | Independent AC verification, subject-bound review, deterministic verification, and final pack audit passed. The runtime-owned R3 closure and pack-ready evidence bind this exact Completed request. |

## References

- Tech Spec: [Skill Toolkit Migration](../2-tech-spec.md)
