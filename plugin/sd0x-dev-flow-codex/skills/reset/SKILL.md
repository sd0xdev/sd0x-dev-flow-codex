---
name: reset
description: Reset sd0x Dev Flow review and verification evidence for the current worktree without changing project files or deactivating current sessions. Use when the user explicitly asks to restart a stuck or stale review loop from a clean runtime state.
---

# Reset the Current Loop

Only run this skill when the user explicitly requests a reset. Resetting discards
the current worktree's recorded review, verification, and reviewer evidence, but
does not modify the worktree or bypass any required gate. Active sessions remain
active, and a dirty worktree immediately returns to `review`.

Resolve this skill's installed directory from the current `SKILL.md`, then run:

```bash
node "<this-skill-directory>/scripts/reset.js"
```

Report the returned fingerprint and `next_action`. Do not claim completion unless
the newly required review and verification gates subsequently pass.
