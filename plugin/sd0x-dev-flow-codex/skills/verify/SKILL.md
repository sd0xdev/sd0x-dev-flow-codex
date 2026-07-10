---
name: verify
description: Run deterministic repository checks selected from the project type and record a fingerprint-bound verification gate. Use after review passes for code or configuration changes, after fixing failed tests, or when the sd0x stop hook requests verification.
---

# Close the Verification Gate

Resolve this skill's installed directory from the current `SKILL.md`, then run:

```bash
node "<this-skill-directory>/scripts/verify.js"
```

The runner requires a current review pass, always checks `git diff --check`, then uses the repository's native checks (`check`, or `typecheck`/`lint`/`test`; pytest; Go test; or Cargo test). It records command, exit code, duration, bounded output, and the start/end fingerprints. A command that changes the fingerprint records verification failure and returns the workflow to review.

If a check fails, diagnose and fix the root cause, then run `$sd0x-dev-flow-codex:review` again because edits invalidate the previous review. After review passes, rerun this skill. Never replace the deterministic result with a verbal claim.
