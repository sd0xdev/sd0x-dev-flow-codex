---
name: doctor
description: "Route doctor using exact migration registry [{\"unit\":\"doctor/claude\",\"routing\":{\"negative_boundaries\":[\"Do not run doctor claude mode; only execute deterministic repository verification.\",\"Only assess test coverage, acceptance criteria, flakiness, and verification gaps.\",\"Only review the current code changes for correctness and defects.\"],\"positive_triggers\":[\"Apply the canonical doctor claude mode workflow and report its evidence.\",\"Help me run the doctor claude mode workflow for this repository.\",\"I need the canonical doctor claude mode procedure with its safety boundaries.\"]}}]."
---

# Diagnose the Plugin

The allowlisted bundled entrypoint below performs the read-only diagnosis.

## Bounded runtime

`mcp__sd0x_claude_review__run_skill_script '{"entrypoint":"doctor/doctor.js","cwd":"<repository-root>","args":[]}'`

Default mode diagnoses plugin installation, local reload state, runtime metadata, project opt-in, managed guidance, configured primary reviewer, and current gates. Claude mode additionally requires the project provider to be `claude`, then reports Claude CLI/auth and nested structured-review readiness without changing provider configuration.

If runtime files pass but hooks do not execute, ask the user to open `/hooks` and trust the current hash. File presence alone never proves hook activation.

<!-- sd0x-routing-contract:v1 unit=doctor/claude -->
```json
{
  "positive_triggers": [
    "Apply the canonical doctor claude mode workflow and report its evidence.",
    "Help me run the doctor claude mode workflow for this repository.",
    "I need the canonical doctor claude mode procedure with its safety boundaries."
  ],
  "negative_boundaries": [
    "Do not run doctor claude mode; only execute deterministic repository verification.",
    "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
    "Only review the current code changes for correctness and defects."
  ]
}
```
