# Wave 3 Feature-Dev Core Promotion

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-07-15
> **Implementation Base SHA**: `2ff44f74eed09ab5fb8cde12b3d7cb5c223d0aed`
> **Status**: Candidate Complete
> **Priority**: P0
> **Depends On**: [R4 — Alias Registry Capability](./2026-07-10-skill-alias-capability-r4.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

Source behaviors from `feature-dev` and the mapping-only `codex-implement` alias converge on the existing Codex-native `feature-dev/default` owner. This ticket owns that single merged promotion unit.

## Requirements

- Preserve the end-to-end implementation workflow while merging only compatible `codex-implement` behavior.
- Keep explicit acceptance criteria, incremental edits, independent review, and deterministic verification.

## Scope

| Scope | Description |
|---|---|
| In | Audit and promote the merged `feature-dev/default` core payload and alias mapping evidence. |
| Out | Registry-visible alias entrypoints, other development-pack units, and release publication |

## Related Files

| File | Action | Description |
|---|---|---|
| `migration/staging/feature-dev/` | Read | Canonical source payload |
| `migration/staging/codex-implement/` | Read | Merged alias source payload |
| `migration/candidates/feature-dev/` | New | Audited merged candidate |
| `plugin/sd0x-dev-flow-codex/skills/feature-dev/` | Update | Canonical core target |
| `test/feature-dev-default-routing.test.js` | New | Trusted routing contract |
| `migration/source-disposition.json` | Update | Shared unit ownership and delivery evidence |

## Acceptance Criteria

- [x] Candidate preserves scoped exploration, acceptance criteria, implementation, testing, and gate orchestration.
- [x] Contract binds both source names to the single `feature-dev/default` promotion unit.
- [x] `codex-implement` remains mapping-only and does not become a discovered skill entrypoint.
- [x] Trusted routing tests distinguish implementation requests from diagnosis-only, review-only, and test-only work.
- [x] Candidate preflight binds exact payload and behavioral-test identity before promotion.
- [x] Final core payload passes source audit as the sole routing owner.
- [x] R3 transaction inputs are ready to bind the Completed request and promotion evidence to the final fingerprint after docs review and fresh deterministic verification.

## Progress

| Phase | Status | Note |
|---|---|---|
| Analysis | Complete | Existing core, canonical source, and mapping-only alias behavior reconciled. |
| Development | Complete | Exact accepted bytes moved from `migration/candidates/` to the core payload; payload `3706ae5ac13693f25c2a66701d79c66f5dc12690d90bee3cbe360062dd392908`. |
| Testing | Complete | Preflight `263166adc304f7f716d68c088773721d3b63d3a936c7f70a2f597610bc7404da`; routing 6/6 passed. Final audit `5cfbfeb042df1cb163995335be706b2640ebf27c80691d506ab97fda87ab548b` passed. |
| Acceptance | Candidate Complete | Final audit and subject gates passed; runtime-owned R3 closure and promotion evidence remain pending. |

## References

- Tech Spec: [Skill Toolkit Migration](../2-tech-spec.md)
