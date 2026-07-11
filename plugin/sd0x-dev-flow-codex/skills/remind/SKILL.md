---
name: remind
description: Inspect sd0x Dev Flow state and resume the next required review or verification action. Use when a task was interrupted, after compaction, when asked what remains, or when the auto-loop reports an unfinished gate.
---

# Resume the Loop

Resolve this skill's installed directory from the current `SKILL.md`, then run:

```bash
node "<this-skill-directory>/scripts/status.js"
```

Inspect `reason` before following `next_action`:

- If `reason` is `reviewer-unavailable`, do not run `$sd0x-dev-flow-codex:review` again on the same fingerprint. Report that the failed gate and reviewer ledger remain intact, then ask the user before a user-authorized reset. Restoring reviewer identities may require a new Codex task, but restart alone does not clear evidence; reset or a genuine fingerprint change is still required.
- If `reason` is `review-in-progress`, wait for every terminal reviewer result. If the ledger is stale, do not spawn replacements; ask the user before reset.
- If `reason` is `review-findings-remain`, inspect and fix the recorded findings, then run `$sd0x-dev-flow-codex:review` against the new fingerprint.
- If `reason` is `review-required`, run `$sd0x-dev-flow-codex:review`.

For the remaining actions, follow `next_action` exactly:

- `verify`: run `$sd0x-dev-flow-codex:verify`.
- `complete`: report that all required gates pass for this fingerprint.

The loop has no retry ceiling. If the runtime evidence is stale or the user wants
to restart the workflow, explain that `$sd0x-dev-flow-codex:reset` clears only
sd0x gate evidence and requires explicit user invocation.
