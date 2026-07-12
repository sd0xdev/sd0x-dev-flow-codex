---
name: reset
description: Reset sd0x Dev Flow review and verification evidence without changing project files; trusted sessions are preserved, while corrupt state is quarantined and requires a new SessionStart. Use when the user explicitly asks to restart a stuck or stale review loop from a clean runtime state.
---

# Reset the Current Loop

Only run this skill when the user explicitly requests a reset. Resetting discards
the current worktree's recorded review, verification, and reviewer evidence, but
does not modify the worktree or bypass any required gate. For valid runtime
state, active sessions remain active and a dirty worktree immediately returns to
`review`. If runtime state is corrupt or uses an unsupported schema, reset
quarantines the original bytes, discards the untrusted session ledger, and
requires a new SessionStart. Report the quarantine path and new-session
requirement returned in `reset_recovery`.

Resolve this skill's installed directory from the current `SKILL.md`, then run:

```bash
node "<this-skill-directory>/scripts/reset.js"
```

Report the returned fingerprint and `next_action`. Do not claim completion unless
the newly required review and verification gates subsequently pass.
