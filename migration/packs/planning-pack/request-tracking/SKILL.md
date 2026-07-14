---
name: request-tracking
description: "Route request-tracking using exact migration registry [{\"unit\":\"request-tracking/default\",\"routing\":{\"positive_triggers\":[\"Build a read-only cross-feature request portfolio report with status, priority, age, blockers, and parse errors.\",\"Show request health trends and broken dependency links without editing any tickets.\",\"Summarize all active and terminal request metadata for planning governance.\"],\"negative_boundaries\":[\"Create or update a date-prefixed execution request ticket.\",\"Scan only incomplete requests and show the operational work queue.\",\"Verify one request acceptance criteria and mark its completion status.\"]}}]."
---

# Request Portfolio Tracking

Build a read-only, cross-feature portfolio report from date-prefixed request tickets. Summarize status, priority, age, acceptance progress, dependencies, blockers, terminal history, and parse errors for planning governance.

Do not create or edit request tickets, verify acceptance criteria, write closure state, update progress, or mutate Git. Evidence refs remain unchanged. An operational queue limited to incomplete tickets belongs to core `create-request`; this workflow covers portfolio health across active and terminal records.

## 1. Discover the portfolio

Inspect contained regular Markdown files directly under `docs/features/{feature}/requests/` and its `archived/` child. Reject absolute paths, traversal, symlinked ancestors/directories/files, nested request directories, and non-Markdown files. Count active-directory and archived-directory files separately; never infer archived status solely from location.

Accept an optional feature filter, status filter, date window, or explicit request set. Otherwise include every feature. Report unreadable or malformed files as per-file errors and continue with unrelated valid tickets.

## 2. Parse the request contract

[Read the portfolio report contract](references/report-contract.md).

For the metadata region before the first level-two heading, prefer canonical blockquote fields and fall back to the first fifteen lines of a legacy metadata table. Parse title, created date, implementation base, status, priority, dependencies, supersession links, and technical-spec link. Extract the filename date only when `Created` is absent.

Count checked and total task boxes only inside the Acceptance Criteria section. Treat `Completed`, `Done`, and `Superseded` as terminal labels, but expose an error when terminal records lack their required base, complete criteria, or reciprocal supersession link. Normalize `In Development` and `In Dev` to the `In Progress` report group without editing source bytes.

Preserve unknown status or priority values as explicit parser errors. Do not silently coerce malformed terminal work into complete history.

## 3. Derive portfolio signals

Use the current local date supplied by the runtime. Compute age from a valid `Created` date or filename date, never filesystem timestamps. Flag pending work older than thirty days as stale. Keep `Candidate Complete` visible as active work that still needs closure-grade verification.

Validate dependency and supersession targets as contained sibling request links. Report missing targets, self-links, missing reciprocal links, and cycles. A dependency is blocked when its target is non-terminal or malformed; distinguish that from a broken link.

Group records by normalized status, then priority `P0`, `P1`, `P2`, unknown, then creation date oldest first, then canonical path. Summaries must retain parse-error rows instead of dropping them from denominators.

## 4. Report without mutation

[Read the output template](references/output-template.md).

Show scope and timestamp, totals, active/terminal/archived counts, status and priority distribution, stale work, blockers, broken links, parse errors, and the full request table. State the parser rules and any unavailable metadata. Do not claim a status or AC is correct merely because the source text says so.

Before reporting completion:

- Confirm every discovered valid or malformed request appears exactly once.
- Confirm ordering, age, AC counts, terminal validation, blockers, and link errors follow the report contract.
- Confirm active, terminal, archived-location, and parser-error counts reconcile.
- Confirm no request, evidence, runtime state, Git metadata, or external system changed.
- Scan the report for secrets and redact suspicious values.

## Pack handoff

[Read the planning-pack handoff specification](references/pack-handoff.md). This repository payload is pack-ready source material only; it is not a core skill and is not a released separate plugin.

<!-- sd0x-routing-contract:v1 unit=request-tracking/default -->
```json
{
  "positive_triggers": [
    "Build a read-only cross-feature request portfolio report with status, priority, age, blockers, and parse errors.",
    "Show request health trends and broken dependency links without editing any tickets.",
    "Summarize all active and terminal request metadata for planning governance."
  ],
  "negative_boundaries": [
    "Create or update a date-prefixed execution request ticket.",
    "Scan only incomplete requests and show the operational work queue.",
    "Verify one request acceptance criteria and mark its completion status."
  ]
}
```
