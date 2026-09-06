---
name: reset
description: "Reset current sd0x review and verification evidence under explicit user authorization, preserving worktree bytes. Corrupt runtime state is quarantined and requires new session activation."
---

# Reset the Current Loop

Run this skill only under explicit user reset authorization. An earlier request
or ongoing authorization covering the current recovery is sufficient; ask only
when no such authority exists. Do not request the same permission again.

Resetting discards the current worktree's recorded review, verification, and
reviewer evidence, but
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
