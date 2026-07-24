---
name: explain
description: "Route explain using exact migration registry [{\"unit\":\"explain/default\",\"routing\":{\"positive_triggers\":[\"Explain how this parser function works at an intermediate depth.\",\"Give me a beginner-friendly explanation of the selected module.\",\"Walk through this algorithm line by line and cite the code.\"],\"negative_boundaries\":[\"Change the parser to support another format.\",\"Investigate an intermittent production failure and determine its root cause.\",\"Map the architecture and data flow of the entire subsystem.\"]}}]."
---

# Code Explanation

Explain selected code accurately at the requested depth using repository evidence. The explanation should reduce cognitive load without hiding important behavior.

## Explanation protocol

1. Resolve an explicit file, symbol, or contained repository scope. Ask one concise question when the target is ambiguous.
2. Read the complete relevant unit plus its callers, types, tests, and configuration only as needed to avoid a misleading local explanation.
3. Match beginner, intermediate, or expert depth to the request. State the purpose before mechanics.
4. Walk through control flow, data transformations, state, side effects, errors, and invariants. Concrete examples should clarify behavior where useful.
5. Cite repository-relative locations for material claims and label uncertain intent separately from observable behavior.
6. Check the explanation against tests and caller expectations before returning it.

Keep all access read-only. Do not modify the code, diagnose an unrelated incident, or expand into subsystem-wide exploration unless asked.

## Output

Lead with a short mental model. Follow with the ordered walkthrough, key concepts, one representative example, caveats, and evidence locations.

## Pack handoff

This repository payload is research-pack-ready source material only. It remains outside the core plugin manifest and live skill discovery, and it is not released here. A later separate-plugin repository must provide its own manifest, dependency declaration, installation tests, fingerprint-bound review and verification gates, and release authorization.

<!-- sd0x-active-semantic-contract:v1 unit=explain/default -->
Normative semantic requirements:
- Check the explanation against tests and caller expectations
- Match beginner, intermediate, or expert depth to the request
- Read the complete relevant unit plus its callers, types, tests
<!-- sd0x-active-semantic-contract:end -->

<!-- sd0x-semantic-contract:v1 unit=explain/default -->
```json
{
  "required": [
    "Check the explanation against tests and caller expectations",
    "Match beginner, intermediate, or expert depth to the request",
    "Read the complete relevant unit plus its callers, types, tests"
  ],
  "forbidden": []
}
```

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
