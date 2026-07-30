# Recap Document Output Template

## Required structure

The document begins with a recap title and metadata for scope source, repository, base and head identity, detected time, focus, depth, confidence, and scope digest.

1. Overview: two to four evidence-backed sentences.
2. Changed Files: deterministic table with path, change class, line statistics, intent, and verified path-and-line evidence.
3. Design Decisions: decision, rationale, alternatives when evidenced, and source citation.
4. Specification Drift: included only when a specification exists; every work item is matched, partial, missing, or contradicted.
5. Blind Spots: always present. When no heuristic fires, state that no obvious blind spot was detected and list the evidence supporting that limited conclusion.
6. Anticipated Questions: omitted at brief depth; otherwise at least three evidence-grounded questions with short hints.
7. Evidence: object IDs, source paths, verified line index, diff statistics at deep depth, truncation, and missing-source markers.

## Blind-spot heuristics

Report source changes without tests, tests without matching source, configuration-only change, security-sensitive paths, substantial deletion, rename without callers in scope, missing request evidence, ambiguous base, truncated diff, stale specification, and any focus term unsupported by scope.

## Invariants

Blind Spots exists at every depth. Brief includes at most five files and omits Anticipated Questions; normal includes at most ten; deep includes at most fifteen and may include bounded snippets. Every changed-file or decision citation points to verified evidence. The file ends with a newline.
