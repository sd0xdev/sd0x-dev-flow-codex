---
name: code-investigate
description: "Route code-investigate using exact migration registry [{\"unit\":\"code-investigate/default\",\"routing\":{\"positive_triggers\":[\"Ask Claude and Codex to independently confirm why this cache path differs in production.\",\"Get independent Claude and Codex confirmation of this parser root cause.\",\"Investigate this retry mechanism with separate Claude and Codex evidence.\"],\"negative_boundaries\":[\"Determine why this cache invalidation path behaves differently in production.\",\"Implement the cache invalidation fix now.\",\"Map the entire service architecture and all data flows.\"]}}]."
---

# Focused Code Investigation

Investigate one mechanism, discrepancy, or suspected root cause through independent repository evidence. The result is a tested explanation, not an implementation.

## Investigation protocol

1. State the hypothesis, competing explanations, observable symptoms, and a bounded repository scope.
2. Native Codex develops Position A from implementation, callers, tests, configuration, and relevant Git diff or history. A configured Claude adapter receives the same neutral question and scope to develop Position B without the preferred hypothesis or first position. If either independent model is unavailable, stop as inconclusive; one model may not impersonate both positions.
3. Integrate only after both positions are complete. Trace the exact normal and failing paths, including inputs, state transitions, error handling, concurrency boundaries, and environment-dependent branches.
4. Seek disconfirming evidence. A claim is confirmed only when code and at least one independent corroborating artifact support it; otherwise label it probable, possible, or rejected.
5. Reconcile the independent positions and any conflicting findings in a claim table with evidence, confidence, and remaining checks.
6. Stop when the mechanism or root cause is supported, falsified, or blocked by a named missing artifact.

All work is read-only. Do not modify source, execute destructive commands, alter Git state, or contact write-capable services.

## Output

Return the question, evidence summary, execution trace, hypothesis assessment, root-cause conclusion, confidence, and next verification step. Separate fact from inference.

## Pack handoff

This repository payload is research-pack-ready source material only. It remains outside the core plugin manifest and live skill discovery, and it is not released here. A later separate-plugin repository must provide its own manifest, dependency declaration, installation tests, fingerprint-bound review and verification gates, and release authorization.

<!-- sd0x-active-semantic-contract:v1 unit=code-investigate/default -->
Normative semantic requirements:
- A configured Claude adapter receives the same neutral question and scope
- Native Codex develops Position A
- one model may not impersonate both positions
<!-- sd0x-active-semantic-contract:end -->

<!-- sd0x-semantic-contract:v1 unit=code-investigate/default -->
```json
{
  "required": [
    "A configured Claude adapter receives the same neutral question and scope",
    "Native Codex develops Position A",
    "one model may not impersonate both positions"
  ],
  "forbidden": []
}
```

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
