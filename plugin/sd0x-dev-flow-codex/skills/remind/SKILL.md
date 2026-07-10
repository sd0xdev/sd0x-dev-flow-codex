---
name: remind
description: Inspect sd0x Dev Flow state and resume the next required review or verification action. Use when a task was interrupted, after compaction, when asked what remains, or when the auto-loop reports an unfinished gate.
---

# Resume the Loop

Resolve this skill's installed directory from the current `SKILL.md`, then run:

```bash
node "<this-skill-directory>/scripts/status.js"
```

Follow `next_action` exactly:

- `review`: run `$sd0x-dev-flow-codex:review`.
- `verify`: run `$sd0x-dev-flow-codex:verify`.
- `complete`: report that all required gates pass for this fingerprint.
- `escalate`: stop automatic retries and explain the concrete blocker to the user.

