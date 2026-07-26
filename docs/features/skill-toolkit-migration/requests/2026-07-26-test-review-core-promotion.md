# Test-Review Core Promotion

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-07-26
> **Implementation Base SHA**: `2631aaff15b4a829f54ac34c2365887b0cb3e0e1`
> **Status**: Candidate Complete
> **Priority**: P0
> **Depends On**: [Wave 4 Test-Review Pack Readiness](./2026-07-25-wave4-test-review-default-pack-ready.md), [R4 — Alias Registry Capability](./2026-07-10-skill-alias-capability-r4.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

Test-quality assessment remains useful, but it must not be installed as an agent
or participate in the fingerprint-bound repository review gate. The prior
quality-pack candidate is promoted into the curated core inventory as an
independent read-only, non-gating skill.

## Requirements

- Keep `test-review/default` focused on test coverage, AC traceability, flakiness, and verification gaps.
- Keep the skill read-only and prohibit writes to runtime review or verification evidence.
- Ensure `sd0x_test_reviewer` has no installation, dispatch, or gate authority.

## Scope

| Scope | Description |
|---|---|
| In | Promote the `test-review/default` payload into core with non-gating authority. |
| Out | Test generation, deterministic verification execution, and repository review-gate satisfaction |

## Related Files

| File | Action | Description |
|---|---|---|
| `plugin/sd0x-dev-flow-codex/skills/test-review/` | New | Read-only non-gating core skill |
| `test/test-review-default-routing.test.js` | Update | Trusted routing contract |
| `migration/source-disposition.json` | Update | Core ownership and promotion revision |

## Acceptance Criteria

- [x] Candidate preserves the complete test sufficiency and quality review workflow and its meaningful failure boundaries.
- [x] Contract binds every assigned source name to this single canonical promotion unit.
- [x] Compatibility aliases remain mapping-only and add no discovered compatibility entrypoints.
- [x] Trusted routing tests distinguish positive prompts from adjacent skill boundaries.
- [x] Candidate preflight binds exact payload and behavioral-test identity.
- [x] Final core destination and move-window comparison are fixed for the accepted candidate bytes.
- [x] R3 closure inputs identify this exact request, promotion unit, evidence kind, and final-fingerprint fields.

## Progress

| Phase | Status | Note |
|---|---|---|
| Analysis | Complete | Agent authority and skill-only test assessment were separated. |
| Development | Complete | Candidate payload `90da73b370f5be8e729e9095677f93e3232a01f469af40a749bb0b50119387fb` and its closed behavior contract are complete. |
| Testing | Complete | Preflight `517ca45cc91349fa3559a512305b1926a06a39b84c17171c9c6949c55f39c562` binds the candidate payload, routing tests, and disposition rows. |
| Acceptance | Candidate Complete | Candidate evidence is complete; final audit and durable R3 closure remain pending. |

## References

- Tech Spec: [Skill Toolkit Migration](../2-tech-spec.md)
