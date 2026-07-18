---
name: bug-fix
description: "Route bug-fix using exact migration registry [{\"unit\":\"bug-fix/default\",\"routing\":{\"positive_triggers\":[\"Correct the invoice rounding regression and add a test that proves the root cause.\",\"Fix the failing request parser after reproducing the error and tracing its execution path.\",\"Resolve this production behavior discrepancy with the narrowest tested code change.\"],\"negative_boundaries\":[\"Diagnose why the parser fails but do not change any files.\",\"Implement a new invoice discount feature from the approved specification.\",\"Review the current diff without modifying production code.\"]}}]."
---

# Fix a Bug

Restore an intended invariant through evidence, a narrow correction, and regression proof.

## Workflow

1. Reproduce the failure or establish a concrete counterexample. Record the exact command, input, output, and affected path when available.
2. Trace the real execution path from entry point to the violated invariant. State a falsifiable root cause; do not patch only the visible symptom.
3. Define the smallest acceptable behavior change and its regression case. Preserve unrelated user changes and repository conventions.
4. Apply the narrowest correction. Avoid speculative cleanup, new features, and broad restructuring.
5. Add or strengthen a regression test that fails for the original behavior and passes with the correction when feasible. If a reliable test cannot be added, explain the concrete limitation and substitute evidence.
6. Complete focused checks, then the repository's sd0x review and deterministic verification workflows. Any post-review fix invalidates the previous fingerprint and requires review again.

## Result

Report the reproduction, root cause, changed invariant, regression coverage, executed checks, and any residual risk. Do not claim either gate without runtime-recorded evidence for the current fingerprint.

<!-- sd0x-routing-contract:v1 unit=bug-fix/default -->
```json
{
  "positive_triggers": [
    "Correct the invoice rounding regression and add a test that proves the root cause.",
    "Fix the failing request parser after reproducing the error and tracing its execution path.",
    "Resolve this production behavior discrepancy with the narrowest tested code change."
  ],
  "negative_boundaries": [
    "Diagnose why the parser fails but do not change any files.",
    "Implement a new invoice discount feature from the approved specification.",
    "Review the current diff without modifying production code."
  ]
}
```
