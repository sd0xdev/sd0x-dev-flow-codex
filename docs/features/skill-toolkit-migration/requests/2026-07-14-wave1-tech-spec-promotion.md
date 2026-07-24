# Wave 1 Tech-Spec Core Promotion

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-07-14
> **Implementation Base SHA**: `8e3efb425e3848cb537beda2101d16014114fe3d`
> **Status**: Completed
> **Priority**: P0
> **Depends On**: [R4 — Alias Registry Capability](./2026-07-10-skill-alias-capability-r4.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

The lifecycle needs a solution-design owner after requirements analysis. This ticket is the sole gate owner for `tech-spec/default` and source skill `tech-spec`.

## Requirements

- Adapt the pinned source technical-design workflow into the canonical Codex-native `tech-spec` skill.
- Promote only the default mode while preserving a stable multi-mode contract for the later `tech-spec/deep` unit.

## Scope

| Scope | Description |
|---|---|
| In | Default-mode candidate、routing、core promotion、closure and promotion evidence |
| Out | Deep-analysis mode、requirements implementation、execution ticket mutation |

## Related Files

| File | Action | Description |
|---|---|---|
| `migration/staging/tech-spec/` | Read | Pinned source payload |
| `migration/candidates/tech-spec/` | New | Canonical multi-mode candidate |
| `plugin/sd0x-dev-flow-codex/skills/tech-spec/` | New | Final core payload |
| `test/tech-spec-default-routing.test.js` | New | Default-mode routing harness |
| `migration/source-disposition.json` | Update | Unit ownership and lifecycle |
| `docs/PROJECT-MIGRATION-GUIDE.md` | Update | Wave and reload evidence |

## Acceptance Criteria

- [x] Default mode produces solution architecture、risk、WBS and testing design without writing feature-wide requirements or per-task status.
- [x] Candidate contract declares the complete active `tech-spec` mode registry and closes default-mode provenance、capabilities and operations.
- [x] Routing tests separate default technical design from `req-analyze` and deep-analysis prompts.
- [x] Candidate preflight audit passes with exact payload and behavior-test identity.
- [x] Final core move passes global audit、independent review and deterministic verification；candidate disposition is ready for the runtime-owned promotion transition.
- [x] R3 transaction inputs are ready to bind `tech-spec/default`、this request and the final payload fingerprint after docs review and fresh deterministic verification on the resulting Completed-request fingerprint.
- [x] Repository-only reload/status proves canonical discovery without a compatibility alias directory.

## Progress

| Phase | Status | Note |
|---|---|---|
| Analysis | Complete | Pinned default source、shared resolver boundary and default/deep ownership split reviewed |
| Development | Complete | Exact live-byte candidate copy verified with `cmp`; shared payload `d110dcf425607c0cfe15080b19b90119a22208325b424952f4de2d02ebaf81c7` passed default preflight `9460fdf87ec2cec08a0931837be532bf1a1dea3063f6f58492a6c8ca2b539088`. |
| Testing | Complete | Shared-payload review and deterministic verification passed at `8564efbafe8f0bae2d850d2f63e2316b9bf86f3a06ad5dfea9562ce57d2a4e96`; `npm run check` passed 336/336 tests. Default final audit `aba7fafd829468a56c84ac019d3ff1ac9b5d8481fd328cecde7bba97e268556b` passed. |
| Acceptance | Complete | All seven ACs now have direct contract、routing、final-audit、review/verify and reload evidence. R3 closure and promotion remain intentionally unrecorded until this ticket's durable transaction runs. |

## References

- [Tech Spec](../2-tech-spec.md)
- [Wave 1 Req-Analyze Core Promotion](./2026-07-14-wave1-req-analyze-promotion.md)
