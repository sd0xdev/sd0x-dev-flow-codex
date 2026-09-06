---
name: doc-refactor
description: "Restructure existing documentation for clarity while preserving technical meaning, project knowledge and important constraints. Does not impose line-count or diagram quotas."
---

# Refactor Documentation

Restructure the requested document for clarity while preserving technical meaning, project knowledge, user-authored content, safety constraints and completion criteria. Keep changes within the requested document scope; documentation review covers an assessment without edits.

Identify duplication, conflicts, stale structure and information the reader needs. Choose prose, tables, diagrams and section boundaries according to the material. Consolidate repeated guidance around its authoritative source and retain useful references. Do not replace facts or operational contracts with generic advice.

Delegate to a bounded Codex worker only when independent document work improves the outcome; give it explicit ownership and preservation requirements. Local work is sufficient when delegation adds no value.

Validate that important information remains recoverable, links and technical claims remain correct, and the revised instructions do not conflict. Line counts may describe the edit but are not success criteria; there are no file-type quotas or mandatory diagram transformations.

Report substantive improvements, preserved constraints and any unresolved ambiguity. Follow the repository’s required review and verification rules for the actual changes.

<!-- sd0x-routing-contract:v1 unit=doc-refactor/default -->
```json
{
  "positive_triggers": [
    "Apply the canonical doc-refactor workflow and report its evidence.",
    "Help me run the doc-refactor workflow for this repository.",
    "I need the canonical doc-refactor procedure with its safety boundaries."
  ],
  "negative_boundaries": [
    "Do not run doc-refactor; only execute deterministic repository verification.",
    "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
    "Only review the current code changes for correctness and defects."
  ]
}
```
