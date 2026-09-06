---
name: code-explore
description: "Explain how a repository subsystem, execution path or data flow connects using source evidence. Read-only; does not implement proposed changes."
---

# Code-Path Exploration

Build an evidence-backed explanation of the requested subsystem, execution path or data flow. Stay read-only: do not mutate files, Git state, dependencies or external systems.

Resolve a contained repository scope and reject traversal, symlink escapes, unsupported absolute input paths and ambiguous repositories. Start from the most informative entry point or evidence, tracing material calls, transformations and state boundaries. Inspect alternate flows, errors, asynchronous behavior and external interfaces where they affect the question.

Reconcile source with tests and documentation; label stale documentation and inference. A read-only Codex investigator may trace a separate useful branch without receiving a preferred conclusion. Validate consequential findings against evidence rather than repeating the entire investigation automatically.

Return the connected flow, key source locations and material unknowns. Use diagrams when they clarify the relationships; completeness means the requested flow is explained and high-impact gaps are resolved or explicitly reported.



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
