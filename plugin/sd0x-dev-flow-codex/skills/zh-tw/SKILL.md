---
name: zh-tw
description: "Rewrite the preceding answer or a selected conversation passage in natural Taiwan Traditional Chinese, preserving facts, technical tokens, citations, and structure. Returns only the rewritten content."
---

# Traditional Chinese Rewrite

Rewrite the immediately preceding answer, or one explicitly identified conversation passage, in accurate Traditional Chinese using Taiwan vocabulary. This workflow is read-only and does not translate repository files or fetch external content.

## Target selection

Without a selector, the target is the complete immediately preceding assistant answer. An explicit selector must identify one unambiguous passage already present in the conversation. Missing, ambiguous, private, or inaccessible content produces a clarification rather than a guessed target.

## Rewrite rules

Preserve every fact, qualification, warning, citation, heading, list, table, code block, inline code span, command, identifier, filename, path, URL, number, and link destination. Translate prose meaning rather than performing character substitution. Taiwan-standard terminology and natural sentence order take precedence over literal wording when meaning remains unchanged.

Technical product names, API symbols, code, commands, and established English terms remain unchanged unless a widely accepted Traditional Chinese rendering improves clarity. Simplified-Chinese regional vocabulary is converted to Taiwan usage. No content is omitted, added, softened, strengthened, summarized, or reinterpreted.

## Result

Return only the complete rewritten content in the original Markdown structure. If a phrase has no safe equivalent, retain the original phrase and preserve its context. This result has no review, test-review, verification, or translation-file authority.

<!-- sd0x-routing-contract:v1 unit=zh-tw/default -->
```json
{
  "positive_triggers": [
    "Apply the canonical zh-tw workflow and report its evidence.",
    "Help me run the zh-tw workflow for this repository.",
    "I need the canonical zh-tw procedure with its safety boundaries."
  ],
  "negative_boundaries": [
    "Do not run zh-tw; only execute deterministic repository verification.",
    "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
    "Only review the current code changes for correctness and defects."
  ]
}
```
