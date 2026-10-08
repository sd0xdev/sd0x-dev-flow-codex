---
name: feature-dev
description: "Implement a coherent feature from its accepted scope through behavior-focused acceptance evidence and configured review/verification gates."
---

# Develop a Feature

Deliver the accepted capability from the user's request and repository evidence through acceptance and fingerprint-bound gates. Understand relevant guidance, specifications when present, architecture boundaries, affected behavior and nearby tests. Recover missing context from the conversation and current implementation, choose reversible implementation details, and state material assumptions. A missing formal specification or feature key does not block an otherwise concrete request. Ask only when unresolved choices would materially change the intended outcome or require new authority; continue independent implementation, investigation, and preparatory work while that answer is pending.

Choose an implementation plan, edit batches and focused checks according to dependencies and risk. Preserve unrelated user changes and established architecture unless the accepted scope requires a change. Add behavior-focused tests for consequential success, failure and boundary cases; scale testing to the behavior and risk.

Complete the configured primary review, resolve actionable findings, then complete deterministic verification on the same final fingerprint. Any subsequent edit reopens required gates. Do not claim completion from a plan, summary or stale result.

Report delivered behavior, acceptance evidence, executed checks and material residual risk. The compatibility name `codex-implement` maps to this owner and does not create another entrypoint.

<!-- sd0x-routing-contract:v1 unit=feature-dev/default -->
```json
{
  "positive_triggers": [
    "Build the approved notification preference feature end to end.",
    "Extend the billing API with the specified refund behavior and tests.",
    "Implement this non-trivial capability from the technical specification."
  ],
  "negative_boundaries": [
    "Diagnose the failing refund test without implementing a correction.",
    "Generate focused tests for the existing billing behavior only.",
    "Review the notification preference diff without changing it."
  ]
}
```

<!-- sd0x-v5-native-guidance -->
Before using feature documents, load the documentation topic through the installed native contract reader with the expected plugin version. Resolve the feature through its owning resolver, validate the complete context shape, and distinguish scan failure from confirmed absence. Report Corpus scan: complete or unknown; recover unknown scans before making exhaustive claims. Repository-relative source-set paths already include the feature directory. The legacy canonical alias is role-blind and is not an authority selector.

Read exact feature intent when known, link acceptance to applicable INV-nnn, and flag scope conflict before the dependent implementation. Existing authorization governs resolution; an ordinary missing document is still research/drafting work.

When work is delegated, explicitly prohibit staging, commits and stashes unless separately authorized for that worker. Record HEAD and stash identities before and after each delegated implementation item; persistent drift invalidates the original subject and must be reconciled. This comparison cannot prove that no transient mutation occurred between observations.
