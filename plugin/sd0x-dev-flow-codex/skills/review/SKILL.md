---
name: review
description: Review the current dirty worktree with a configured Codex-first or Claude primary subagent plus two independent read-only Codex perspectives, fix actionable findings, and record a fingerprint-bound review gate. Use before finishing code or documentation changes, after fixes invalidate prior review, or when the sd0x stop hook requests review.
---

# Close the Review Gate

1. Resolve this skill's installed directory from the current `SKILL.md`. Read `references/review-theory.md`; its independent-research, orthogonal-perspective, evidence, severity, and convergence rules govern every reviewer. Run `node "<this-skill-directory>/scripts/provider.js"`, then `node "<this-skill-directory>/scripts/snapshot.js"`. Parse and retain the configured provider, primary agent, root, fingerprint, and changed files. Stop if the worktree is clean. Run `node "<this-skill-directory>/scripts/round.js" begin` immediately before dispatch. When the current Codex surface exposes persistent collaboration agents instead of per-run subagent hooks, this records a fingerprint-bound transcript offset for the explicit Codex JSONL adapter; an unavailable adapter is non-fatal because native `SubagentStart`/`SubagentStop` hooks remain authoritative where supported.
2. In one parallel dispatch, start the configured primary subagent and both independent Codex perspectives. Do not give any reviewer another reviewer's conclusions:
   - When `provider` is `codex`, spawn `sd0x_codex_primary_reviewer` against the snapshot. Its project agent profile pins `gpt-5.6-sol`, `xhigh`, and read-only mode.
   - When `provider` is `claude`, spawn `sd0x_claude_primary_reviewer` against the snapshot. Tell it that the provider is `claude`; inside that subagent it must call `mcp__sd0x_claude_review__review_worktree` with the exact `cwd: root` and `fingerprint`. On a fix round, give it only Claude's own prior normalized finding identities. The MCP PostToolUse hook records the structured Claude evidence; never call the Claude MCP from the parent task and never substitute prose for the nested call.
   - Spawn `sd0x_reviewer` against the same fingerprint for the native Codex implementation perspective. On a fix round, give it only its own prior finding identities as hypotheses to revalidate.
   - Spawn `sd0x_test_reviewer` against the same fingerprint for the native Codex test and acceptance perspective. On a fix round, give it only its own prior finding identities as hypotheses to revalidate.
3. Wait for all three subagent results. Each subagent must return an explicit terminal result; a start/stop pair without final assistant output does not count. In Claude mode, a failed, missing, unstructured, or stale nested MCP result also blocks the gate. When clean, each subagent must return exactly `No actionable findings remain.` so the runtime can record a structured clean outcome. Before recording a pass, run `node "<this-skill-directory>/scripts/round.js" import`; `gate.js pass` rescans from the original offset and finalizes the marker at the gate boundary. The adapter accepts only exact direct collaboration agent paths and terminal messages observed after the recorded transcript offset for the unchanged fingerprint and runtime epoch; malformed, overlapping, interrupted, pending, missing, replayed, or stale evidence fails closed.
4. Apply the theory's five deliberate checks before accepting a finding. Normalize survivors to `[P0|P1|P2] file:line description → root cause → recommendation → regression protection`, then deduplicate by `file + canonical issue` (ignore line drift of at most five lines). Keep the highest severity and tag each finding with `source: claude`, `source: codex`, `source: codex-test`, or `source: both`.
5. Aggregate only discrete actionable findings with file and line evidence. Any P0/P1/P2 finding blocks this strict gate.
6. If findings exist, record `fail`. Before editing, identify each finding's symptom, violated invariant/root cause, minimal fix, and recurrence protection; add regression evidence at the appropriate test layer when feasible. Fix the findings, then restart from step 1. If a native reviewer is unavailable, cancelled, missing terminal output, or otherwise leaves stale start evidence, record `fail`; do not replace or retry that reviewer type on the same fingerprint. Ask the user before running `$sd0x-dev-flow-codex:reset`, then restart from step 1 only after the user-authorized reset. Any edit creates a new fingerprint and invalidates all three prior results; prior finding identities are verification hypotheses, never gate evidence.
7. Record `pass` only when the configured primary subagent and both Codex perspectives independently report no actionable findings for the same fingerprint. Claude mode additionally requires the nested Claude MCP structured clean result.

Record a failed pass with compact JSON evidence:

```bash
node "<this-skill-directory>/scripts/gate.js" fail --evidence '{"provider":"<provider>","reviewers":3,"agents":["<primary-agent>","sd0x_reviewer","sd0x_test_reviewer"],"findings":1,"summary":"actionable findings or reviewer failure remain"}'
```

For unavailable reviewer infrastructure, record `findings: 0` and `reviewer_failure: true` instead. This keeps the gate failed while allowing the Stop hook to yield. On the same fingerprint, a user-authorized reset is required before retrying; restoring reviewer identities may additionally require a new Codex task, but process restart alone does not clear the failed gate or stale ledger. A genuine fingerprint change also invalidates that evidence.

Record the passing gate only after all provider-plan evidence has been observed for this fingerprint:

```bash
node "<this-skill-directory>/scripts/gate.js" pass --evidence '{"provider":"codex","reviewers":3,"agents":["sd0x_codex_primary_reviewer","sd0x_reviewer","sd0x_test_reviewer"],"findings":0,"summary":"no actionable findings"}'
```

For Claude mode, use the provider plan's four evidence identities: `sd0x_claude_primary_reviewer`, `sd0x_reviewer`, `sd0x_test_reviewer`, and `claude_mcp_primary`.

Do not weaken, bypass, or manually edit runtime state when the gate rejects evidence.
