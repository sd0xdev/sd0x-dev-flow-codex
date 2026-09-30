---
name: remind
description: "Inspect current sd0x runtime status and resume the required review, recovery, or verification action. Existing scoped reset authorization remains valid."
---

# Resume the sd0x Loop

The allowlisted bundled entrypoint below performs the read-only status inspection. Use the returned gate facts and recovery requirements to resume the active task; gate status does not establish completion of the full user objective.

## Bounded runtime

Resolve `<plugin-root>` as two directories above this skill's installed directory, from the current `SKILL.md` location. The runner inherits `CODEX_HOME` and `CODEX_THREAD_ID` from the current Codex shell. The runner returns JSON with `exit_code`, `stdout`, and `stderr`; parse the script's JSON from `stdout` and respect failures.

`node "<plugin-root>/scripts/runtime/runner.js" '{"entrypoint":"remind/status.js","cwd":"<repository-root>","args":[]}'`

- `reviewer-unavailable`: preserve failure evidence; use the reset skill under existing user authorization within its scope, or ask before reset if none applies.
- `review-in-progress`: wait for the configured primary terminal result.
- `review-findings-remain`: fix root causes, then review the new fingerprint.
- `review-required`: dispatch only the configured primary reviewer.
- `verification-required` or `verification-failed`: default verify follows only after review passes.
- `all-required-gates-pass`: report these gates passed for that exact fingerprint. Claim task completion only when the requested scope and deliverables are also satisfied.

Never retry a failed reviewer on the same fingerprint without a user-authorized reset.

<!-- sd0x-routing-contract:v1 unit=remind/default -->
```json
{
  "positive_triggers": [
    "Apply the canonical remind workflow and report its evidence.",
    "Help me run the remind workflow for this repository.",
    "I need the canonical remind procedure with its safety boundaries."
  ],
  "negative_boundaries": [
    "Do not run remind; only execute deterministic repository verification.",
    "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
    "Only review the current code changes for correctness and defects."
  ]
}
```
