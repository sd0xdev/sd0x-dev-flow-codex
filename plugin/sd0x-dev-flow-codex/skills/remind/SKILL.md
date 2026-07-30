---
name: remind
description: "Route remind using exact migration registry [{\"unit\":\"remind/default\",\"routing\":{\"negative_boundaries\":[\"Do not run remind; only execute deterministic repository verification.\",\"Only assess test coverage, acceptance criteria, flakiness, and verification gaps.\",\"Only review the current code changes for correctness and defects.\"],\"positive_triggers\":[\"Apply the canonical remind workflow and report its evidence.\",\"Help me run the remind workflow for this repository.\",\"I need the canonical remind procedure with its safety boundaries.\"]}}]."
---

# Resume the sd0x Loop

The allowlisted bundled entrypoint below performs the read-only status inspection. Follow the returned reason and next action exactly.

## Bounded runtime

`mcp__sd0x_claude_review__run_skill_script '{"entrypoint":"remind/status.js","cwd":"<repository-root>","args":[]}'`

- `reviewer-unavailable`: preserve failure evidence and ask before reset.
- `review-in-progress`: wait for the configured primary terminal result.
- `review-findings-remain`: fix root causes, then review the new fingerprint.
- `review-required`: dispatch only the configured primary reviewer.
- `verification-required` or `verification-failed`: default verify follows only after review passes.
- `all-required-gates-pass`: report completion for that exact fingerprint.

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
