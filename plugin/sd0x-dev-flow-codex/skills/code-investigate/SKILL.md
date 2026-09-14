---
name: code-investigate
description: "Trace the cause of a specific failure or unexplained repository behavior without editing."
---

# Focused Code Investigation

Investigate one mechanism, discrepancy or suspected root cause without applying changes. Establish the question, observable symptoms, competing explanations and bounded repository scope.

Obtain independent read-only Codex analysis for the two positions. Give a separate Codex subagent the same neutral question and scope without the preferred hypothesis or first position. If independent analysis is unavailable, report that limitation and keep the independent assessment inconclusive; one agent cannot impersonate both positions.

Reconcile findings only after both positions are available. Trace consequential normal and failing paths, including state, errors, concurrency and environment dependencies. Seek disconfirming evidence. A confirmed claim needs source evidence and independent corroboration; weaker claims remain probable, possible or rejected.

Do not modify source, alter Git state, execute destructive commands or contact write-capable services. Return the supported explanation, evidence, conflicting findings, confidence and remaining verification needs.



<!-- sd0x-routing-contract:v1 unit=code-investigate/default -->
```json
{
  "positive_triggers": [
    "Ask Claude and Codex to independently confirm why this cache path differs in production.",
    "Get independent Claude and Codex confirmation of this parser root cause.",
    "Investigate this retry mechanism with separate Claude and Codex evidence."
  ],
  "negative_boundaries": [
    "Determine why this cache invalidation path behaves differently in production.",
    "Implement the cache invalidation fix now.",
    "Map the entire service architecture and all data flows."
  ]
}
```
