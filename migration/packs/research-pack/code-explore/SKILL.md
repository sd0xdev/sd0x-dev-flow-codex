---
name: code-explore
description: "Route code-explore using exact migration registry [{\"unit\":\"code-explore/default\",\"routing\":{\"positive_triggers\":[\"Map the architecture and execution flow for the authentication subsystem.\",\"Show how a request travels from the HTTP handler to persistence.\",\"Trace the data flow for invoice creation and identify the key files.\"],\"negative_boundaries\":[\"Change the request handler to add invoice retries.\",\"Find the commit that introduced this exact regression.\",\"Give a quick answer about where one configuration constant is defined.\"]}}]."
---

# Code-Path Exploration

Build an evidence-backed model of a repository subsystem, execution path, or data flow. Exploration is read-only and emphasizes how pieces connect rather than proposing or applying changes.

## Exploration protocol

1. Define the entry point, scope, and completion question. Reject absolute paths, traversal, symlink escapes, and ambiguous repositories.
2. Start breadth-first: identify top-level modules, public entry points, configuration, tests, and integration seams.
3. Follow calls and data transformations in execution order. Record file and symbol evidence at every material hop.
4. Inspect alternate paths, errors, asynchronous boundaries, persistence, and external interfaces only where they affect the requested flow.
5. Compare implementation with tests and documentation. Label stale documentation, unreachable paths, and inferences explicitly.
6. Stop after the requested architecture, execution flow, and data flow can be explained without unresolved high-impact gaps.

A read-only investigator may trace a separate branch of the flow with isolated instructions. Its claims must be checked against repository bytes before inclusion. Do not mutate files, Git state, dependencies, or external systems.

## Output

Provide an architecture overview, key files, ordered execution flow, data flow, findings, and residual unknowns. Use a compact diagram only when it makes three or more relationships materially clearer.

## Pack handoff

This repository payload is research-pack-ready source material only. It remains outside the core plugin manifest and live skill discovery, and it is not released here. A later separate-plugin repository must provide its own manifest, dependency declaration, installation tests, fingerprint-bound review and verification gates, and release authorization.

<!-- sd0x-active-semantic-contract:v1 unit=code-explore/default -->
Normative semantic requirements:
- Record file and symbol evidence at every material hop
- Start breadth-first
- Stop after the requested architecture, execution flow, and data flow can be explained
<!-- sd0x-active-semantic-contract:end -->

<!-- sd0x-semantic-contract:v1 unit=code-explore/default -->
```json
{
  "required": [
    "Record file and symbol evidence at every material hop",
    "Start breadth-first",
    "Stop after the requested architecture, execution flow, and data flow can be explained"
  ],
  "forbidden": []
}
```

<!-- sd0x-routing-contract:v1 unit=code-explore/default -->
```json
{
  "positive_triggers": [
    "Map the architecture and execution flow for the authentication subsystem.",
    "Show how a request travels from the HTTP handler to persistence.",
    "Trace the data flow for invoice creation and identify the key files."
  ],
  "negative_boundaries": [
    "Change the request handler to add invoice retries.",
    "Find the commit that introduced this exact regression.",
    "Give a quick answer about where one configuration constant is defined."
  ]
}
```
