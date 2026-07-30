# Black-Box Verification Guide

## Diff-Lite Scoping

Changed paths are identified by fixed read-only repository argv calls, an exact pull-request file list, or a deployment manifest. Scope tracing covers only externally observable routes, scheduled jobs, log signals, and metrics. If no reliable diff exists, bind the scope to the user's feature description and mark unmapped code as a gap.

## Charter Design

| Case type | Goal | Required evidence |
|---|---|---|
| L1 regression | Existing observable behavior remains valid | Status plus expected response structure |
| L2 active | New read-only path produces its documented signal | Response or correlated log evidence |
| L3 passive | Background behavior remains healthy | Bounded time-window observation |
| M1 metric | Documented metric and labels are present | Bounded metric query result |

Every case maps to an acceptance criterion, exact environment, allowlisted target, fixed parameters, timeout, and pass condition.

## Correlation

Prefer an in-memory correlation identifier generated for the probe. Search the exact configured field, then configured aliases, then the endpoint within a narrow time window. Stop after the configured ingestion-delay attempts. Missing logs lower confidence but do not independently prove feature failure.

## Blind Spots

Record internal branches, negative paths requiring mutation, concurrency behavior, long-running schedules, third-party side effects, and parameter combinations that cannot be observed safely. Hand these to `$sd0x-dev-flow-codex:test-review` only when explicitly requested; that review remains read-only and non-gating.
