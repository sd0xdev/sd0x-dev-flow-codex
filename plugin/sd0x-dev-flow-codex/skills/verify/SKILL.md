---
name: verify
description: "Record deterministic verification after current-fingerprint primary review passes. Fast and precommit are non-gating check sequences; lint fixes require scoped authorization and --allow-fixes."
---

# Verify Repository Evidence

## Modes

- Default is the only gating mode. After the current primary review passes, the allowlisted bundled verifier records deterministic evidence for the exact fingerprint.
- Fast is non-gating. Under existing user authorization covering the lint-fix changes, or after obtaining that authority if absent, it runs the available `lint:fix` → `test` sequence with continue-all behavior, ecosystem fallback, changed-file reporting, and no runtime gate write.
- Precommit is non-gating. Under existing user authorization covering the lint-fix changes, or after obtaining that authority if absent, it runs the available `lint:fix` → `build` → `test` sequence with continue-all behavior, ecosystem fallback, changed-file reporting, and no staging, unstaging, committing, or runtime gate write.

## Bounded runtime

```bash
mcp__sd0x_claude_review__run_skill_script '{"entrypoint":"verify/verify.js","cwd":"<repository-root>","args":[]}'
```

```bash
mcp__sd0x_claude_review__run_skill_script '{"entrypoint":"verify/verify.js","cwd":"<repository-root>","args":["--mode","fast","--allow-fixes"]}'
```

```bash
mcp__sd0x_claude_review__run_skill_script '{"entrypoint":"verify/verify.js","cwd":"<repository-root>","args":["--mode","precommit","--allow-fixes"]}'
```

Without `--allow-fixes`, a detected lint-fix step fails closed before any command
runs. Both non-default modes run every available step even after a failure, report
each literal argv and exit code plus `git diff --name-only`, and never read or
write the sd0x review/verification gate state. The bundled
[verify entrypoint](scripts/verify.js) delegates ecosystem detection, closed
command ordering, and result normalization to the shared deterministic runtime.

Follow the returned runtime reason after a failed check. Any fix that changes the fingerprint requires review before default verification. Never substitute a verbal claim for the deterministic result; passing gates establishes those gates, not unexamined user requirements.

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
