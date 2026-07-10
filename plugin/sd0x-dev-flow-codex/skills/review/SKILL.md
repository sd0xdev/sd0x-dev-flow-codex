---
name: review
description: Review the current dirty worktree with a Claude MCP primary reviewer and two independent read-only Codex perspectives, fix actionable findings, and record a fingerprint-bound review gate. Use before finishing code or documentation changes, after fixes invalidate prior review, or when the sd0x stop hook requests review.
---

# Close the Review Gate

1. Resolve this skill's installed directory from the current `SKILL.md`. Read `references/review-theory.md`; its independent-research, orthogonal-perspective, evidence, severity, and convergence rules govern every reviewer. Run `node "<this-skill-directory>/scripts/snapshot.js"`. Parse and retain its `root`, `fingerprint`, and changed files. Stop if the worktree is clean.
2. In one parallel dispatch, start all three independent review perspectives. Do not give any reviewer another reviewer's conclusions:
   - Call `mcp__sd0x_claude_review__review_worktree` with the snapshot `cwd: root` and `fingerprint`. On a fix round, also pass only Claude's own prior normalized finding identities as `prior_findings`; omit this field on the first round. This is the blocking primary review. The PostToolUse hook records its structured evidence; never substitute a prose claim for the MCP call.
   - Spawn `sd0x_reviewer` against the same fingerprint for the native Codex implementation perspective. On a fix round, give it only its own prior finding identities as hypotheses to revalidate.
   - Spawn `sd0x_test_reviewer` against the same fingerprint for the native Codex test and acceptance perspective. On a fix round, give it only its own prior finding identities as hypotheses to revalidate.
3. Wait for all three results. A failed, missing, unstructured, or stale Claude MCP result blocks the gate. Each Codex subagent must return an explicit terminal result; a start/stop pair without final assistant output does not count. When clean, each subagent must return exactly `No actionable findings remain.` so the runtime can record a structured clean outcome.
4. Apply the theory's five deliberate checks before accepting a finding. Normalize survivors to `[P0|P1|P2] file:line description → root cause → recommendation → regression protection`, then deduplicate by `file + canonical issue` (ignore line drift of at most five lines). Keep the highest severity and tag each finding with `source: claude`, `source: codex`, `source: codex-test`, or `source: both`.
5. Aggregate only discrete actionable findings with file and line evidence. Any P0/P1/P2 finding blocks this strict gate.
6. If findings exist or a reviewer is unavailable, record `fail`. Before editing, identify each finding's symptom, violated invariant/root cause, minimal fix, and recurrence protection; add regression evidence at the appropriate test layer when feasible. Fix the findings or restore the reviewer, then restart from step 1. Any edit creates a new fingerprint and invalidates all three prior results; prior finding identities are verification hypotheses, never gate evidence.
7. Record `pass` only when the Claude MCP primary and both Codex subagents independently report no actionable findings for the same fingerprint.

Record a failed pass with compact JSON evidence:

```bash
node "<this-skill-directory>/scripts/gate.js" fail --evidence '{"reviewers":3,"agents":["claude_mcp_primary","sd0x_reviewer","sd0x_test_reviewer"],"findings":1,"summary":"actionable findings or reviewer failure remain"}'
```

Record the passing gate only after the observed Claude MCP tool result and both subagents completed for this fingerprint:

```bash
node "<this-skill-directory>/scripts/gate.js" pass --evidence '{"reviewers":3,"agents":["claude_mcp_primary","sd0x_reviewer","sd0x_test_reviewer"],"findings":0,"summary":"no actionable findings"}'
```

Do not weaken, bypass, or manually edit runtime state when the gate rejects evidence.
