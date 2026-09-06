---
name: doc-review
description: "Review documentation against current repository behavior, sources and the intended audience. Returns factual defects and readiness without editing."
---

# Review Documentation

Evaluate the requested documentation against its audience, promised outcome and current authoritative sources without editing it. Trace consequential commands, paths, configuration, API names, examples, defaults and lifecycle claims to repository evidence.

Check relevant prerequisites, terminology, links, recovery guidance, accessibility and localization. Distinguish factual defects and task-blocking gaps from optional clarity or style improvements.

Findings identify severity, location, contradictory or missing evidence and a concrete revision. Return `Ready` only when no correctness or task-blocking documentation gaps remain; report unresolved evidence honestly. Adapt depth and presentation to the document.

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
