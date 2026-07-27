---
name: doc-review
description: "Route doc-review using exact migration registry [{\"unit\":\"doc-review/default\",\"routing\":{\"negative_boundaries\":[\"Review the current code diff for implementation defects.\",\"Rewrite this guide to improve its structure and wording.\",\"Synchronize the English and Traditional Chinese README files.\"],\"positive_triggers\":[\"Check this migration guide for factual accuracy, missing prerequisites, and broken examples.\",\"Review the API documentation against the current implementation and report defects.\",\"Verify this runbook is complete and usable by its intended operator.\"]}}]."
---

# Review Documentation

Evaluate documentation against its intended audience, repository behavior, and linked sources without editing it.

## Protocol

1. Identify the document class, audience, promised outcome, authoritative sources, and excluded topics.
2. Trace commands, configuration, API names, paths, examples, defaults, and lifecycle claims to current repository evidence.
3. Check structure, prerequisites, terminology, links, examples, error recovery, accessibility, and localization consistency.
4. Distinguish factual defects from clarity improvements and optional style preferences.
5. For each finding, provide severity, document location, contradictory or missing evidence, and a concrete revision.
6. Return `Ready` only when no correctness or task-blocking documentation gaps remain.

## Result

Report scope, audience, verified claims, findings grouped by severity, unresolved evidence, and the readiness decision.

<!-- sd0x-routing-contract:v1 unit=doc-review/default -->
```json
{
  "positive_triggers": [
    "Check this migration guide for factual accuracy, missing prerequisites, and broken examples.",
    "Review the API documentation against the current implementation and report defects.",
    "Verify this runbook is complete and usable by its intended operator."
  ],
  "negative_boundaries": [
    "Review the current code diff for implementation defects.",
    "Rewrite this guide to improve its structure and wording.",
    "Synchronize the English and Traditional Chinese README files."
  ]
}
```
