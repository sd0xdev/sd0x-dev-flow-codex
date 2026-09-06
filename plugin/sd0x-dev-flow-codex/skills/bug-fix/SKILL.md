---
name: bug-fix
description: "Diagnose and correct a concrete bug with regression evidence, then complete configured review and deterministic verification. Preserve unrelated user changes."
---

# Fix a Bug

Restore the intended invariant using a reproduction or concrete counterexample and a supported root cause. Trace enough of the real execution path to distinguish the cause from its visible symptom.

Apply the correction needed for the accepted behavior while preserving unrelated user changes and repository conventions. Avoid speculative cleanup or unrelated features. Add or strengthen behavior-focused regression coverage when feasible; otherwise state the concrete limitation and substitute evidence.

Choose investigation order, edit batches and focused checks according to risk. Complete the configured sd0x primary review and deterministic verification for the final fingerprint; a post-review edit reopens the required gates.

Report the root cause, changed behavior, regression evidence, executed checks and material residual risk. Claim gate completion only from current runtime-recorded evidence.

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
