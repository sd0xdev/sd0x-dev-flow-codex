# Wave 3 Bug-Fix Core Promotion

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-07-15
> **Implementation Base SHA**: `2ff44f74eed09ab5fb8cde12b3d7cb5c223d0aed`
> **Status**: In Progress
> **Priority**: P0
> **Depends On**: [R4 — Alias Registry Capability](./2026-07-10-skill-alias-capability-r4.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

The existing Codex-native `bug-fix` workflow must become the audited canonical owner of `bug-fix/default` without regressing its scoped diagnosis, minimal correction, or regression-proof verification discipline.

## Requirements

- Promote one exact, provenance-bound core payload for `bug-fix/default`.
- Preserve Codex-native authority boundaries and the repository review/verification gates.

## Scope

| Scope | Description |
|---|---|
| In | Audit and promote the existing core `bug-fix/default` payload and routing contract. |
| Out | Other Wave 3 units, unrelated runtime changes, and external publication |

## Related Files

| File | Action | Description |
|---|---|---|
| `migration/staging/bug-fix/` | Read | Pinned source payload |
| `migration/candidates/bug-fix/` | New | Audited promotion candidate |
| `plugin/sd0x-dev-flow-codex/skills/bug-fix/` | Update | Canonical core target |
| `test/bug-fix-default-routing.test.js` | New | Trusted routing contract |
| `migration/source-disposition.json` | Update | Unit ownership and delivery evidence |

## Acceptance Criteria

- [x] Candidate preserves bounded reproduction, root-cause correction, regression coverage, and gate behavior.
- [x] Contract records the exact `bug-fix/default` provenance, routing cases, capabilities, operations, and authority boundary.
- [x] Trusted routing tests prove positive ownership and exclusions from feature development and review-only work.
- [x] Candidate preflight binds exact payload and behavioral-test identity before promotion.
- [ ] Final core payload passes source audit and remains the only discovered owner of `bug-fix/default`.
- [ ] Runtime closure binds the Completed request and promotion evidence to the final fingerprint.

## Progress

| Phase | Status | Note |
|---|---|---|
| Analysis | Complete | Existing core and pinned source boundaries reconciled. |
| Development | Complete | Candidate payload and schema-v1 contract prepared; payload `a4d4e8963e26f89953d6b19318374f1f04d29f8745a772da80ccca0dace044a9`. |
| Testing | Complete | Preflight `d9c9650522e047ec40833de6c8148c28dc74efe1cd2e9707f26ace06c60d5140`; routing 6/6 passed. |
| Acceptance | Pending | |

## References

- Tech Spec: [Skill Toolkit Migration](../2-tech-spec.md)
