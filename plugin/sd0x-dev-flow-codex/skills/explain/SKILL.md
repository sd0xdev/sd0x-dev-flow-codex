---
name: explain
description: "Explain selected code at the requested depth using relevant source and caller evidence. Read-only; avoids expanding a focused explanation into unrelated investigation."
---

# Explain Code

Explain selected code accurately at the requested depth. Resolve the intended file, symbol or contained scope; ask only when ambiguity materially changes the explanation.

Inspect enough source context to avoid a misleading local account, including callers, types, tests and configuration where consequential. Explain purpose, relevant control/data flow, state, side effects, errors and invariants. Distinguish observable behavior from uncertain intent and cite material source locations.

Keep access read-only. Do not diagnose unrelated incidents or expand into broad exploration unless requested. Choose examples, diagrams and detail to help this reader understand the code; no fixed walkthrough or example count is required.



<!-- sd0x-routing-contract:v1 unit=explain/default -->
```json
{
  "positive_triggers": [
    "Explain how this parser function works at an intermediate depth.",
    "Give me a beginner-friendly explanation of the selected module.",
    "Walk through this algorithm line by line and cite the code."
  ],
  "negative_boundaries": [
    "Change the parser to support another format.",
    "Investigate an intermittent production failure and determine its root cause.",
    "Map the architecture and data flow of the entire subsystem."
  ]
}
```
