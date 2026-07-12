---
name: create-request
description: Create, update, batch-sync, or scan date-prefixed single-task request tickets under docs/features/*/requests/. Use for breaking a tech spec into execution tickets, tracking acceptance-criteria progress, finding incomplete or stale requests, or independently verifying one ticket's acceptance criteria. Do not use for feature-wide requirements, technical design, or implementation.
---

# Manage Request Tickets

Treat request tickets as execution units, not feature requirements. Keep one concern
layer per ticket, no more than eight acceptance criteria, and an estimate small enough
for roughly three days of work.

## Select a mode

- Create: the user asks for a new ticket and does not identify an existing request.
- Update: the user identifies one request or asks to sync the current request.
- Update all: the user explicitly asks for a batch sync. Never infer this mutation.
- Status: the user asks for a dashboard, incomplete work, or stale requests. This is
  read-only.
- Verify AC: `--verify-ac` modifies only one request and is incompatible with update
  all.

Resolve this skill's installed directory from this `SKILL.md`. Run its deterministic
helper from the target repository before reading or writing request documents:

```bash
node "<skill-directory>/scripts/request-tool.js" resolve [--feature <key>] [--path <repo-relative-path>]
node "<skill-directory>/scripts/request-tool.js" scan
```

Use the helper's canonical paths and active-request list. Never guess after a null or
ambiguous resolution. If both a feature key and path are supplied, they must resolve
to the same slug. The helper is query-only and never creates directories or files.

## Create

1. Resolve the feature from an explicit path/key; an existing feature named by a
   `feat/`, `feature/`, `fix/`, or `docs/` branch prefix; a uniquely changed feature
   path; or a single feature directory, in that order.
2. Read the parent tech spec and, when present, requirements document. Read
   [references/request-format.md](references/request-format.md) before rendering.
3. Derive a single-task scope, related files, dependencies, and evidence-oriented ACs.
   If the task mixes layers, spans independent areas, exceeds eight ACs, or is larger
   than about three days, propose focused sibling tickets before writing.
4. Record the current `git rev-parse HEAD` as `Implementation Base SHA`. Use
   `YYYY-MM-DD-kebab-case-title.md`; refuse collisions instead of overwriting.
5. Create only after clear user intent to create a local ticket. Preserve bidirectional
   links with the parent tech spec and requirements document when they exist.

## Update one

1. Resolve exactly one request. Multiple active requests require the user to choose.
2. Read the entire request, its implementation base, related files, and relevant
   repository guidance. Snapshot the current non-request worktree state before
   evaluating progress.
3. Update checkboxes and progress only from concrete implementation or test evidence.
   Normalize `In Development` and `In Dev` to `In Progress`; normalize `Done` to
   `Completed` only when reading legacy tickets.
4. Without independent AC verification, the highest writable state is
   `Candidate Complete`. Partial or missing evidence stays `In Progress`.
5. Preserve user-authored sections and unrelated edits. Re-run the resolver before
   writing and refuse the edit if the target or non-request subject drifted.

For `--verify-ac`, start a fresh, isolated, read-only Codex subagent with only the raw
AC list, related paths, repository root, implementation base, and subject snapshot.
Bound it to 60 seconds. Require one structured result per AC with `Complete`,
`Partial`, `Not Found`, or `Inconclusive`; `High`, `Medium`, or `Low` confidence; and
repo-relative `file:line` evidence for every `Complete`. Timeout, cancellation,
unavailability, malformed output, missing evidence, or subject drift makes affected
ACs inconclusive and prevents `Completed`.

All-Complete, High-confidence verification may propose `Completed`, but do not write
that transition directly unless the repository provides its configured durable
request-closure operation. Until that operation is available, write `Candidate
Complete` and report the closure limitation. This prevents a request edit from
reusing evidence for the pre-edit fingerprint.

## Update all

Run `scan`, then inspect each incomplete ticket independently. A batch may mark
evidenced ACs and move `Pending` to `In Progress` or `Candidate Complete`; it must
never write `Completed`, use `--verify-ac`, or treat docs-only commits as
implementation evidence. Keep parse failures as per-file errors and continue with
unrelated valid tickets. Report before/after status and AC counts for every file.

## Status

Use the `scan` JSON without editing files. Group active requests in this order:
`In Progress`, `Candidate Complete`, `Pending`/unknown, then `Design`/`Proposed`.
Sort each group by P0, P1, P2, unknown priority, then oldest creation date. Show AC
counts, paths, parse errors, requests pending for more than 30 days, and the archived
count.

## Completion discipline

After any write, follow the target repository's documentation review and verification
rules. A ticket's status is not evidence that its implementation or the current
worktree passed a gate. Never modify Git metadata, stage, commit, push, or publish as
an implied part of request management.
