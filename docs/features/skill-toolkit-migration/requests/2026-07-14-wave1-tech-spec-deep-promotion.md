# Wave 1 Tech-Spec Deep Core Promotion

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-07-14
> **Implementation Base SHA**: `8e3efb425e3848cb537beda2101d16014114fe3d`
> **Status**: Candidate Complete
> **Priority**: P0
> **Depends On**: [Wave 1 Tech-Spec Core Promotion](./2026-07-14-wave1-tech-spec-promotion.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

Source `deep-analyze` is a compatibility mapping into the canonical technical-design owner, not a separate live alias. This ticket solely owns `tech-spec/deep`.

## Requirements

- Merge the pinned `deep-analyze` behavior into a bounded deep mode of `tech-spec`.
- Keep the R4 `mapping-only` decision: no `deep-analyze` live entrypoint may be created.

## Scope

| Scope | Description |
|---|---|
| In | Deep-mode adaptation、multi-mode routing、core re-promotion and evidence |
| Out | Default-mode redesign、research-pack workflows、alias capability changes |

## Related Files

| File | Action | Description |
|---|---|---|
| `migration/staging/deep-analyze/` | Read | Pinned source payload |
| `migration/candidates/tech-spec/` | Update | Deep mode candidate |
| `plugin/sd0x-dev-flow-codex/skills/tech-spec/` | Update | Final canonical skill |
| `test/tech-spec-deep-routing.test.js` | New | Deep-mode routing harness |
| `migration/source-disposition.json` | Update | Mode ownership and lifecycle |
| `migration/alias-capability.json` | Read | Mapping-only constraint |

## Acceptance Criteria

- [x] Deep mode preserves bounded deeper investigation and synthesis while routing final design through canonical `tech-spec`.
- [x] Candidate contract includes both active default/deep units and exact source attribution for `deep-analyze`.
- [x] Routing tests uniquely select deep mode and reject default、research-only and implementation prompts.
- [x] Audit proves no live `deep-analyze` alias directory or automatic-routing candidate exists.
- [x] Candidate preflight and final core re-audit pass with current review/verify gates.
- [x] R3 transaction inputs are ready to bind `tech-spec/deep` and the revised canonical payload after docs review and fresh deterministic verification on the resulting Completed-request fingerprint.
- [x] Repository-only reload/status confirms one canonical `tech-spec` entrypoint with both modes.

## Progress

| Phase | Status | Note |
|---|---|---|
| Analysis | Complete | Pinned `deep-analyze` source、mapping-only alias decision、shared canonical payload and default/deep ownership boundary reviewed. |
| Development | Complete | Canonical default/deep registry、bounded deep workflow、mapping-only ledger row and generated routing harness implemented. Exact live-byte candidate copy verified with `cmp`; shared payload `d110dcf425607c0cfe15080b19b90119a22208325b424952f4de2d02ebaf81c7` passed deep preflight `0d099c19d451442d94305e59a1d277f2641eff2c73b15f8af644d7c7a686d13c`. |
| Testing | Complete | Shared-payload review and deterministic verification passed at `8564efbafe8f0bae2d850d2f63e2316b9bf86f3a06ad5dfea9562ce57d2a4e96`; `npm run check` passed 336/336 tests. Deep final audit `30521a63f7d931f84c5f102a9ca1bc72f98186cc01b36c242ef1b1d30d5b74b9` passed. Repository-only reload/status remained linked with 13 copied and 31 linked files. |
| Acceptance | Candidate Complete | Independent acceptance verification returned 7/7 Complete/High. R3 closure/promotion is intentionally deferred because the upstream default ticket is not Completed; no durable promotion record is claimed. |

## References

- [Tech Spec](../2-tech-spec.md)
- [Wave 1 Tech-Spec Core Promotion](./2026-07-14-wave1-tech-spec-promotion.md)
