---
name: debug
description: "Route debug using exact migration registry [{\"unit\":\"debug/default\",\"routing\":{\"positive_triggers\":[\"Analyze this supplied failing command and output, then trace the execution path that produced them.\",\"Diagnose the intermittent cache failure and report the evidenced root cause without editing code.\",\"Trace why the request returns stale data and identify the failing invariant.\"],\"negative_boundaries\":[\"Implement a new cache invalidation feature from the approved specification.\",\"Patch the cache regression and add a regression test.\",\"Review the current cache diff for correctness and test gaps.\"]}}]."
---

# Diagnose a Failure

Establish why observed behavior diverges from the intended invariant. This workflow is read-only: it returns evidence and a falsifiable diagnosis, not a code change.

## Protocol

1. Capture the supplied failing command, input, output, or test evidence. Separate confirmed facts from reports; reproduction is optional and only available through the fixed read-only probes below.
2. Bound the affected path and compare a nearby passing case when possible.
3. Trace control flow, data flow, state transitions, configuration, and error handling in execution order. Cite repository files and symbols at each decisive hop.
4. Form competing hypotheses and probe with the smallest safe observations that distinguish them. Record evidence that rejects alternatives.
5. State the root cause as the violated invariant, the exact responsible path, the conditions that activate it, and the affected scope.
6. Recommend a minimal correction and regression scenario without applying them. State missing observability or remaining uncertainty explicitly.

## Probe safety

The bundled [probe runner](scripts/probe-runner.js) is the exclusive execution boundary for reproduction commands. Its classifier, literal allowlist, deadline, capture ceiling, and sanitizer are mandatory.

- A probe may proceed only for the controlled missing-ref observation `git rev-parse --verify refs/sd0x-debug-probe/missing`. This fixed form validates nonzero-exit capture without reading worktree content; arbitrary failing commands and repository status are analyzed only from supplied evidence. Everything else is default-deny, including stateful tests, filesystem or network mutation, dependency changes, process control, destructive actions, dynamic shell syntax, and credentialed commands.
- Denied or ambiguous probes remain unexecuted and become an explicit handoff for a separately authorized mutation workflow.
- Every permitted probe has a 30-second deadline and a 64-KiB combined-output ceiling. The host terminates the probe at either boundary.
- Output is sanitized before retention or display. Bearer credentials, keys, tokens, passwords, secrets, and private-key blocks are replaced with redaction markers.
- A timeout, output-limit termination, or sanitizer failure is inconclusive evidence, never a passing observation.

## Result

Return reproduction evidence, probe classification and limits, sanitized execution trace, hypothesis table, root cause, impact, suggested correction, regression case, and unresolved questions.

## Pack handoff

This payload is development-pack-ready source material. It stays outside core discovery and is not published from this repository.

<!-- sd0x-routing-contract:v1 unit=debug/default -->
```json
{
  "positive_triggers": [
    "Analyze this supplied failing command and output, then trace the execution path that produced them.",
    "Diagnose the intermittent cache failure and report the evidenced root cause without editing code.",
    "Trace why the request returns stale data and identify the failing invariant."
  ],
  "negative_boundaries": [
    "Implement a new cache invalidation feature from the approved specification.",
    "Patch the cache regression and add a regression test.",
    "Review the current cache diff for correctness and test gaps."
  ]
}
```
