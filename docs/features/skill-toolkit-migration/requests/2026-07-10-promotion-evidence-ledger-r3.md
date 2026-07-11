# Promotion Evidence Ledger

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-07-10
> **Implementation Base SHA**: `0b24525489ee3be9413ebf0d81e140eeadcc3fe7`
> **Status**: Pending
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

## Scope

| Scope | Description |
|---|---|
| In | Closed record schema/hashes、two-phase closure CLI、locked Git-ref writer、revision chain、fetch/export contract、audit integration、tests |
| Out | `create-request` UX/modes、candidate adaptation、tracked evidence files、automatic remote mutation、manual ledger editing |

## Related Files

| File | Action | Description |
|---|---|---|
| `plugin/sd0x-dev-flow-codex/scripts/runtime/state.js` | Update | Ledger transition owner and atomic writer |
| `plugin/sd0x-dev-flow-codex/scripts/runtime/cli.js` | Update | Deterministic closure prepare/finalize entrypoint |
| `scripts/skill-migration-audit.js` | Update | Historical per-unit evidence validation |
| `test/state.test.js` | Update | Gate-to-ledger and later-fingerprint transitions |
| `test/skill-migration.test.js` | Update | Payload/disposition/tamper audit fixtures |

## Acceptance Criteria

- [ ] Closed promotion record binds a matching request-closure record hash、request/AC、disposition/payload、final fingerprint、HEAD、redacted evidence blobs/hashes and stored `record_sha256`.
- [ ] Per-kind guard matrix allows pending before Completed/payload，requires exact pending→closure and closure→promotion links，and rejects unknown/cross-kind/missing fields；prepare/finalize support restart but reject drift/tamper.
- [ ] State-locked compare-and-swap append advances `refs/sd0x-dev-flow-codex/evidence/v1` with a parent-linked commit and does not alter worktree fingerprint.
- [ ] Later fingerprints and explicit fresh-clone ref fetch preserve a unit whose record and redacted review/verify blobs re-hash against request/AC、payload、disposition and evidence.
- [ ] A legitimate payload/disposition change requires fresh final gates and a new revision linked to the previous record hash.
- [ ] Missing/corrupt ref、metadata loss、divergence、direct Completed edit、missing/stale closure、record/request/AC/blob tamper or stale payload fail re-audit.
- [ ] Retirement records require final closure + approved reason/review and null payload/verify；core promotion rejects pack-ready rows.
- [ ] Tests cover R3 self-bootstrap + fixture-only first-promotion simulation（actual E2E belongs Wave 1）、phase guards/drift/tamper、versioned secret/account/path redaction + unsafe-redaction refusal、blob/OID CAS、clone/bundle；checks/gates pass.

## Progress

| Phase | Status | Note |
|---|---|---|
| Analysis | Done | Durable history is separated from current worktree gates |
| Development | Pending | |
| Testing | Pending | |
| Acceptance | Pending | |

## References

- [Tech Spec](../2-tech-spec.md)
- [R2 — Migration Validation Harness](./2026-07-10-skill-migration-validators-r2.md)
