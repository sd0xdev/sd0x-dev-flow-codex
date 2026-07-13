# Promotion Evidence Ledger

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-07-10
> **Implementation Base SHA**: `0b24525489ee3be9413ebf0d81e140eeadcc3fe7`
> **Status**: Completed
> **Priority**: P0
> **Depends On**: [R2 — Migration Validation Harness](./2026-07-10-skill-migration-validators-r2.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

Current-fingerprint review/verify state is intentionally invalidated by later edits, but completed promotion units still need tamper-evident、clone-transferable historical provenance. This request adds an append-only custom Git ref without weakening current gates.

## Requirements

- Add append-only per-unit promotion revisions under `refs/sd0x-dev-flow-codex/evidence/v1`.
- Enforce separate fail-closed guards for closure-pending、closure、core-promotion and retirement record kinds.
- Make re-audit survive unrelated later fingerprints while rejecting stale、tampered or superseded evidence.
- Expose deterministic `closure prepare/finalize` commands so R3 can self-bootstrap and Wave 1 can close tickets before `create-request` is live.
- Require schema-v2 Complete AC verdicts to cite request-external evidence；legacy request-only pending records remain auditable only for explicit supersession、cannot fresh apply/finalize，but retain recovery for pre-existing journals.
- Reduce current review orchestration to two independent perspectives（configured primary + test reviewer）with exact evidence identity and explicit invalidation of legacy three-view gates.

## Scope

| Scope | Description |
|---|---|
| In | Closed record schema/hashes、two-phase closure CLI、locked Git-ref writer、revision chain、fetch/export contract、two-view review contract、audit integration、tests |
| Out | `create-request` UX/modes、candidate adaptation、tracked evidence files、automatic remote mutation、manual ledger editing |

## Related Files

| File | Action | Description |
|---|---|---|
| `plugin/sd0x-dev-flow-codex/scripts/runtime/state.js` | Update | Ledger transition owner and atomic writer |
| `plugin/sd0x-dev-flow-codex/scripts/runtime/cli.js` | Update | Deterministic closure prepare/finalize entrypoint |
| `plugin/sd0x-dev-flow-codex/scripts/runtime/collaboration.js`、`hook.js` | Update | Exact primary + test review round and hook guidance |
| `plugin/sd0x-dev-flow-codex/skills/review/`、`setup/` | Update | Two-view orchestration and managed profile retirement |
| `scripts/skill-migration-audit.js` | Update | Historical per-unit evidence validation |
| `plugin/sd0x-dev-flow-codex/skills/create-request/` | Update | Durable closure orchestration and evidence contract |
| `docs/PROJECT-MIGRATION-GUIDE.md`、`README.md` | Update | Advertise the shipped closure boundary |
| `test/state.test.js` | Update | Gate-to-ledger and later-fingerprint transitions |
| `test/skill-migration.test.js` | Update | Payload/disposition/tamper audit fixtures |
| `test/r3-acceptance.test.js` | Add | Safe per-AC map to focused implementation symbols、regressions and behavioral signals |

## Acceptance Criteria

- [x] Closed promotion record binds a matching request-closure record hash、request/AC、disposition/payload、final fingerprint、HEAD、redacted evidence blobs/hashes and stored `record_sha256`.
- [x] Per-kind guard matrix allows pending before Completed/payload，requires exact pending→closure and closure→promotion links，and rejects unknown/cross-kind/missing fields；prepare/finalize support restart but reject drift/tamper.
- [x] State-locked compare-and-swap append advances `refs/sd0x-dev-flow-codex/evidence/v1` with a parent-linked commit and does not alter worktree fingerprint.
- [x] Later fingerprints and explicit fresh-clone ref fetch preserve a unit whose record and redacted review/verify blobs re-hash against request/AC、payload、disposition and evidence.
- [x] A legitimate payload/disposition change requires fresh final gates and a new revision linked to the previous record hash.
- [x] Missing/corrupt ref、metadata loss、divergence、direct Completed edit、missing/stale closure、record/request/AC/blob tamper or stale payload fail re-audit.
- [x] Retirement records require final closure + approved reason/review and null payload/verify；core promotion rejects pack-ready rows.
- [x] Tests cover R3 self-bootstrap + fixture-only first-promotion simulation（actual E2E belongs Wave 1）、phase guards/drift/tamper、exact two-reviewer gates + legacy evidence invalidation、versioned secret/account/path redaction + unsafe-redaction refusal、blob/OID CAS、clone/bundle；checks/gates pass.

## Progress

| Phase | Status | Note |
|---|---|---|
| Analysis | Done | Durable history is separated from current worktree gates |
| Development | Done | Append-only CAS ledger、subject-bound closure、repository-derived promotion evidence and create-request orchestration implemented |
| Testing | Done | Clean/dirty attestation、prepare/finalize restart、closed exits/paths、owner binding、self-referential AC evidence rejection、safe focused per-AC traceability、redaction、full-unit fetch/bundle、revision、tamper/divergence/metadata、promotion/retirement and R2 compatibility fixtures pass |
| Acceptance | Done | All acceptance criteria are backed by scoped executable evidence and final gates |

## References

- [Tech Spec](../2-tech-spec.md)
- [R2 — Migration Validation Harness](./2026-07-10-skill-migration-validators-r2.md)
