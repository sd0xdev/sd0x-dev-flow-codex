---
name: verify
description: "Run fingerprint-bound verification after review, or explicitly requested non-gating fast/precommit checks."
---

# Verify Repository Evidence

Default is the only gating mode. After current-fingerprint primary review passes, the allowlisted bundled verifier records deterministic evidence for that fingerprint.

The bundled runtime call is:

`mcp__sd0x_skill_runtime__run_skill_script '{"entrypoint":"verify/verify.js","cwd":"<repository-root>","args":[]}'`

Provide the current shell `CODEX_HOME` and `CODEX_THREAD_ID` as `context.codex_home` and `context.thread_id` on each call. Select args from the mode table below. The [bundled entrypoint](scripts/verify.js) owns ecosystem detection, command selection, execution and result recording.

| Mode | Args | Behavior |
| --- | --- | --- |
| Default | `[]` | Deterministic verification after review; writes the gate. |
| Fast | `["--mode","fast","--allow-fixes"]` | Fast is non-gating; available `lint:fix` then `test`. |
| Precommit | `["--mode","precommit","--allow-fixes"]` | Precommit is non-gating; available `lint:fix`, `build`, then `test`. |

Fast and precommit retain continue-all behavior through every available step after failures, report literal argv, exit codes and changed files, with no runtime gate write. They never stage, unstage, commit, push, or access gate state. Existing user authorization covering lint fixes suffices; obtain it only when absent. Without `--allow-fixes`, a detected mutating plan fails before any command runs.

Follow the runtime result. Fixes that change the fingerprint require review before default verification. Report actual commands, results, and material limitations. Passing gates establishes those gates, not unexamined user requirements such as activation or publication.

<!-- sd0x-routing-contract:v1 unit=verify/default -->
```json
{
  "positive_triggers": [
    "Apply the canonical verify workflow and report its evidence.",
    "Help me run the verify workflow for this repository.",
    "I need the canonical verify procedure with its safety boundaries."
  ],
  "negative_boundaries": [
    "Do not run verify; only execute deterministic repository verification.",
    "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
    "Only review the current code changes for correctness and defects."
  ]
}
```

<!-- sd0x-routing-contract:v1 unit=verify/fast -->
```json
{
  "positive_triggers": [
    "Apply the canonical verify fast mode workflow and report its evidence.",
    "Help me run the verify fast mode workflow for this repository.",
    "I need the canonical verify fast mode procedure with its safety boundaries."
  ],
  "negative_boundaries": [
    "Do not run verify fast mode; only execute deterministic repository verification.",
    "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
    "Only review the current code changes for correctness and defects."
  ]
}
```

<!-- sd0x-routing-contract:v1 unit=verify/precommit -->
```json
{
  "positive_triggers": [
    "Apply the canonical verify precommit mode workflow and report its evidence.",
    "Help me run the verify precommit mode workflow for this repository.",
    "I need the canonical verify precommit mode procedure with its safety boundaries."
  ],
  "negative_boundaries": [
    "Do not run verify precommit mode; only execute deterministic repository verification.",
    "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
    "Only review the current code changes for correctness and defects."
  ]
}
```
