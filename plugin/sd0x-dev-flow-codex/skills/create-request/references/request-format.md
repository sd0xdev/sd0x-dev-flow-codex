# Request Ticket Format

Use this reference for create and update modes.

## Template

```markdown
# {Title}

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: {YYYY-MM-DD}
> **Implementation Base SHA**: `{40-character lowercase hexadecimal commit identifier}`
> **Status**: Pending
> **Priority**: {P0|P1|P2}
> **Depends On**: rendered relative Markdown link to the dependency request <!-- omit when none -->
> **Superseded By**: rendered relative Markdown link to the replacement request <!-- required only on Superseded tickets -->
> **Supersedes**: rendered relative Markdown link to the previous request <!-- required on the replacement ticket -->
> **Tech Spec**: rendered relative Markdown link to the canonical tech spec
> **Requirements**: rendered relative Markdown link to `1-requirements.md` <!-- omit when absent -->

## Background

{Why this single task is needed.}

## Requirements

- {Required behavior}

## Scope

| Scope | Description |
|---|---|
| In | {Owned concern} |
| Out | {Explicitly excluded work} |

## Related Files

| File | Action | Description |
|---|---|---|
| `path/to/file` | New/Update/Read | {Role in this request} |

## Acceptance Criteria

- [ ] {Observable behavior with deterministic evidence}

## Progress

| Phase | Status | Note |
|---|---|---|
| Analysis | Pending | |
| Development | Pending | |
| Testing | Pending | |
| Acceptance | Pending | |

## References

- Tech Spec: rendered relative Markdown link to the canonical tech spec
```

## Invariants

- Location: `docs/features/{feature}/requests/YYYY-MM-DD-{slug}.md`.
- One ticket owns one concern layer and no more than eight ACs.
- `Implementation Base SHA` is required for new tickets. Never invent a base for a
  legacy ticket; ask for an exact base or keep completion inconclusive.
- Canonical lifecycle: `Pending -> In Progress -> Candidate Complete -> Completed`.
- `Candidate Complete` means all ACs appear satisfied but durable closure-grade
  evidence is not recorded.
- `Superseded` is terminal only when the old ticket has `Superseded By`, the
  replacement has `Supersedes`, both links name contained sibling request files,
  and they point to each other.
- Quality gates may be ACs only when the target repository actually defines them.
- Related paths are repo-relative and must not use parent-directory traversal or symlinks.

## Cross-links

- A request links to the canonical tech spec and to requirements when present.
- The tech spec links to every active request. Add or repair that link during create.
- Sibling dependencies use relative links and must remain acyclic.
- Never add a link to a document that does not exist.

## Evidence rules

- A commit is relevant only when it changes a listed implementation/test path after
  the implementation base; docs-only commits are not implementation evidence.
- A checked AC names its evidence in the Progress note or verifier result.
- Parser or verifier uncertainty is visible; it never becomes completion.
- Heuristic and batch updates stop at `Candidate Complete`.

## Durable closure

Resolve the runtime CLI relative to the installed skill as
`<skill-directory>/../../scripts/runtime/cli.js`. A verified update reaches
`Completed` only through this transaction:

1. Keep the request non-Completed. An ordinary two-perspective review and, for
   code/config subjects, deterministic verification must bind the exact implementation
   fingerprint.
2. Render the exact proposed request bytes with `Status: Completed` and every AC
   checked. Build a prepare input whose closed fields are
   `promotion_unit_id`, `request_path`, `proposed_request`, `subject`, `evidence`,
   `recorded_at`, and `supersedes_record_sha256`.
3. Bind a dirty subject as `{kind,fingerprint,head_sha}`. For a clean committed
   subject `{kind:"commit",base_sha,head_sha,tree_sha}`, the runtime
   commit-review-begin operation consumes the subject JSON and also opens the
   fingerprint/epoch-bound collaboration round. Dispatch the configured two
   reviewers with the returned subject hash explicitly against `base_sha..head_sha`,
   require every terminal response to end with the returned
   `Commit-Subject-SHA256: <hash>` line, import that round, record the review gate,
   complete deterministic verification against the clean HEAD, and submit the same
   subject JSON to the runtime commit-review-attest operation. Caller-authored reviewer hashes
   are never commit evidence. This clean-commit transaction currently requires the
   Codex review provider; a Claude-configured repository must stay fail-closed until
   an equivalent subject-bound Claude range adapter exists.
   The current and proposed request must carry the same canonical `Implementation
   Base SHA`, it must be an ancestor of the subject HEAD, and for a commit subject it
   must equal `base_sha`. A legacy ticket without it requires an explicit
   human-supplied base before prepare; closure never rewrites an existing base.
4. Each review/verify blob is `{binding,provider,evidence}` with the configured
   review provider and `binding` byte-equivalent to the subject. Review `evidence`
   contains the gate plus the terminal native/external reviewer ledgers from the
   current raw state or completed commit attestation; verify `evidence` contains the
   deterministic gate evidence. AC evidence has one ordered
   `{ac,status:"Complete",confidence:"High",
   evidence:["path:line"]}` verdict per AC. Check evidence must show only zero exits.
   Every evidence location must be a canonical repository-relative regular file that
   exists at that line (and optional column) in the bound dirty snapshot or commit
   tree; absolute, traversing, symlinked, missing, and out-of-range locations fail.
   Every Complete AC must include at least one evidence location outside the request
   ticket itself, such as implementation, test, verifier, or another evidence-bearing
   artifact. The AC checkbox, Progress table, or any mixture of request-local lines
   cannot certify that AC. Legacy pending records without this invariant may be
   audited only so a schema-v2 pending can explicitly supersede them; they cannot be
   newly applied or finalized. Recovery remains available for a legacy apply journal
   that already exists.
5. The runtime closure prepare operation consumes the JSON input file. Preserve its
   returned pending record hash; do not edit any non-request path after prepare.
   The request path and every ancestor must remain regular, repository-contained,
   and free of symlinks; any path swap or worktree drift aborts finalization.
6. The runtime closure apply operation consumes only the pending record hash; only
   this runtime-owned operation may write
   the proposed request bytes. It revalidates the pending ref/path/projection and
   writes through the captured no-follow request descriptor with an inode-bound,
   durable apply journal and complete-write loop. Pre-existing or write-boundary
   request drift is rejected without changing those bytes. Once runtime mutation
   starts, any failed truncate/write/fsync or later validation leaves the journal and
   current bytes in place; there is no automatic rollback. The journal preserves
   runtime ownership context for explicit recovery instead of authorizing overwrite.
   Exact proposed success replays idempotently.
   If apply reports journaled unknown bytes after an interruption, stop and obtain an
   operator decision. The runtime closure recovery operation accepts
   `{pending_record_sha256,action:"restore-prior",expected_current_sha256}` to
   restore the exact persisted prior bytes before replay, or `action:"abandon"`
   with the same operator-inspected current hash to remove runtime recovery ownership
   without changing the request. Never infer either action. Restore requires the
   journaled inode; it atomically displaces the current file into the returned
   `.sd0x/closure-recovery/` backup before installing prior bytes, so a last-moment
   edit is retained. Abandon also supports an editor's atomic-save replacement inode.
   Complete the ordinary two-perspective docs review on that new fingerprint. The
   runtime closure finalize operation then accepts only
   `pending_record_sha256`, `recorded_at`, and
   `supersedes_record_sha256`.

Prepare/apply/recover/finalize are restart-safe through the evidence ref. Never hand-edit the ref,
reuse a pending record after drift, fabricate gate evidence, or treat a pending hash
as final closure evidence.
