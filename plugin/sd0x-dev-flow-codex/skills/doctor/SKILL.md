---
name: doctor
description: "Diagnose local plugin installation, real hook activation, reviewer configuration and fingerprint-bound gates through the official read-only runtime entrypoint."
---

# Diagnose the Plugin

The allowlisted bundled entrypoint below performs the read-only diagnosis.

## Bounded runtime

`mcp__sd0x_skill_runtime__run_skill_script '{"entrypoint":"doctor/doctor.js","cwd":"<repository-root>","args":[]}'`

Default mode diagnoses plugin installation, local reload state, runtime metadata, project opt-in, managed guidance, configured primary reviewer, and current gates. The legacy `doctor/claude` routing name is retained only for migration compatibility: Claude review is retired, and a legacy Claude provider fails closed with setup migration guidance. No Claude CLI or authentication check runs.

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
