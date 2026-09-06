---
name: recap-doc
description: "Write a post-development recap with design decisions, specification drift, blind spots, and verified source citations. Uses a temporary destination unless a repository output path is requested."
---

# Recap Document Generator

This workflow generates an evidence-backed post-development recap with design decisions, specification drift, blind spots, anticipated questions, and exact source references. The default destination is temporary; a repository destination requires an explicit output path.

## Scope contract

Accept one closed scope record from the parent workflow or user containing version, source class, repository identity, base and head object IDs when applicable, sorted changed paths, change classes, line statistics, feature-document context, confidence, and fallback reasons. Inline objects and regular contained JSON files are accepted as data; executable values, unknown fields, empty scopes, traversal, symbolic-link escape, and repository or object drift are rejected.

## Evidence collection

Follow the [source guide](references/source-guide.md). Collect bounded read-only Git history, diff statistics and hunks for scope paths, current file excerpts, and approved feature specification and request evidence when present. Depth controls explanatory detail, not which scoped changes count. Include every scoped path in the inventory, select excerpts by decision relevance, and report actual byte or time truncation. Missing or contradictory evidence produces explicit markers and blind spots.

## Synthesis

Apply the [synthesis contract](references/prompt-template.md) in the current Codex task; no bridge MCP, second reviewer, or hidden model invocation is used. The [output template](references/output-template.md) requires overview, changed files, design decisions, conditional specification drift, blind spots at every depth, anticipated questions where useful; brief depth may omit them, and an evidence index.

Every claim traces to the scope or collected evidence. Paths and line numbers are never invented. High-confidence secret shapes abort output; lower-confidence sensitive values are masked without changing structural evidence.

## Destination and write

The default path lies under a dedicated operating-system temporary recap directory. An explicit path must resolve inside the repository or temporary root through its first existing regular ancestor. Reject traversal, symbolic links, special files, collision with unrelated bytes, unsafe parent permissions, and source or destination drift.

Preview destination, scope digest, evidence digest, output byte length and digest, redaction result, and collision strategy. Apply one contained atomic write with a trailing newline, then re-read and verify digest and required structure. A requested repository write preserves unrelated files and remains subject to later primary review.

## Result

Return scope and evidence digests, destination, depth, included and omitted paths, section inventory, blind spots, anticipated-question count, redaction outcome, output digest, and verification status. Recap questions belong to the independent recap-ask workflow.

<!-- sd0x-routing-contract:v1 unit=recap-doc/default -->
```json
{
  "positive_triggers": [
    "Apply the canonical recap-doc workflow and report its evidence.",
    "Help me run the recap-doc workflow for this repository.",
    "I need the canonical recap-doc procedure with its safety boundaries."
  ],
  "negative_boundaries": [
    "Do not run recap-doc; only execute deterministic repository verification.",
    "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
    "Only review the current code changes for correctness and defects."
  ]
}
```
