# Create-Request Recovery Re-promotion

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-07-23
> **Implementation Base SHA**: `629c6f78fc1d37435051a5205ab916574517fe3f`
> **Status**: Candidate Complete
> **Priority**: P0
> **Depends On**: [Wave 1 Create-Request Formal Promotion](./2026-07-14-wave1-create-request-promotion.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

Wave 3 closure review exposed that a successful `closure apply` removes its apply
journal before the required docs review. If that review rejects the exact Completed
bytes, the runtime previously had no authorized way to restore the persisted prior
request. The recovery fix changes the shipped create-request operator contract, so
the already-promoted payload requires a new auditable promotion revision.

## Requirements

- Preserve the immutable Wave 1 readiness checkpoint while moving current payload
  authority to the ordinary candidate、closure and promotion ledger.
- Re-promote the hardened create-request payload without weakening exact-byte、
  lifecycle or no-overwrite recovery invariants.

## Scope

| Scope | Description |
|---|---|
| In | Successful-apply recovery exception、rollback crash safety、finalized-pending guard、readiness checkpoint semantics、create-request re-promotion |
| Out | New request lifecycle states、other Wave 1 payload revisions、user-level installation |

## Related Files

| File | Action | Description |
|---|---|---|
| `plugin/sd0x-dev-flow-codex/scripts/runtime/state.js` | Update | Enforce recovery lifecycle and rollback invariants |
| `plugin/sd0x-dev-flow-codex/skills/create-request/references/request-format.md` | Update | Document the explicit recovery contract |
| `scripts/skill-migration-audit.js` | Update | Keep Wave 1 readiness immutable while current delivery uses ledger evidence |
| `test/evidence-ledger.test.js` | Update | Cover authorization、finalization、restart and atomic-save races |
| `test/skill-migration.test.js` | Update | Protect readiness and operator-document contracts |
| `migration/source-disposition.json` | Update | Route the unit through a new candidate-to-promotion revision |

## Acceptance Criteria

- [x] Exact successful-apply recovery requires both pending proposal bytes and the operator-inspected hash before synthesizing a journal.
- [x] Prior、unknown and atomic-save replacement bytes fail closed or remain installed without overwrite.
- [x] Rollback-link crash recovery resumes to a consistent operator-recoverable state.
- [x] Finalized or promoted pending records reject recovery without changing request、journal or evidence bytes.
- [x] The immutable Wave 1 checkpoint remains bound to its original reviewed subject while current candidate/delivered payloads use active audit and promotion evidence.
- [x] Runtime、operator reference and authoritative migration documents describe the same exception and terminal boundary.
- [x] Focused recovery and documentation regressions pass before the full repository gate.
- [x] Current create-request payload and routing contract are ready for preflight、review、verify、closure and promotion revision.

## Progress

| Phase | Status | Note |
|---|---|---|
| Analysis | Complete | The rejected Wave 3 docs proposal exposed the post-success recovery gap and the immutable-readiness/current-delivery authority split. |
| Development | Complete | Runtime recovery、operator documentation、lifecycle guard、rollback restart handling and readiness checkpoint semantics are implemented. payload `a20dff0482ef497d1214a075b38e03e57b7ec948819acb1968f154eb5955b780`. |
| Testing | Complete | Focused evidence-ledger recovery tests and the documentation synchronization contract pass. Preflight `c52d321ac0be8ff45dc5232c162eb59b0b60065fc5c70521af9487902056c8fe`. |
| Acceptance | Complete | All eight ACs have implementation and regression evidence; independent AC verification、full review、deterministic verification and promotion transactions remain. |

## References

- [Tech Spec](../2-tech-spec.md)
- [Wave 3 Bug-Fix Promotion](./2026-07-15-wave3-bug-fix-promotion.md)
