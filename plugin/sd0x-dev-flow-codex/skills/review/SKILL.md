---
name: review
description: "Run the configured read-only Codex primary review for the exact current fingerprint. Default mode owns the review gate; fast, full, branch, and deep modes return subject-bound reports only."
---

# Close the Review Gate

1. Resolve the repository root. Read the [review theory](references/review-theory.md); it defines independent judgment, behavioral coverage, actionable evidence, and severity. The deterministic [provider](scripts/provider.js), [snapshot](scripts/snapshot.js), [round](scripts/round.js), and [gate](scripts/gate.js) wrappers implement the workflow. Required ordered invocations:

`mcp__sd0x_skill_runtime__run_skill_script '{"entrypoint":"review/provider.js","cwd":"<repository-root>","args":[]}'`

`mcp__sd0x_skill_runtime__run_skill_script '{"entrypoint":"review/snapshot.js","cwd":"<repository-root>","args":[]}'`

Parse and retain the configured provider, primary agent, root, fingerprint, and changed files. Stop if the worktree is clean. Immediately before dispatch, run:

`mcp__sd0x_skill_runtime__run_skill_script '{"entrypoint":"review/round.js","cwd":"<repository-root>","args":["begin"]}'`

On Codex surfaces with persistent collaboration agents, the round wrapper records a fingerprint-bound transcript boundary for the explicit Codex JSONL adapter. If that adapter is unavailable, each round requires a fresh native configured subagent with authoritative native start and terminal lifecycle evidence. Following up with a completed agent does not emit a new native start and cannot establish that round's evidence.
2. Dispatch exactly one `sd0x_codex_primary_reviewer` against the fingerprint-bound snapshot. Its project profile is read-only and omits model/effort pins. The default is the **current parent session's model and reasoning effort**, including live session changes, not a fixed plugin model or a guessed config-file default.
   - On a collaboration surface whose full-history fork guarantees parent model/effort inheritance, use that fork without model overrides.
   - On a native custom-agent surface, unset profile values inherit through the host. If `[agents]` defaults would override the parent, pass both actual current parent settings explicitly. An explicit user reviewer override takes precedence; never silently lower effort or switch models.
   - If the host cannot establish the requested settings or cannot dispatch the configured identity, report reviewer unavailability. Parent prose never substitutes for terminal evidence.
   - The reviewer performs no repository mutations even when the parent's live permission mode is permissive. `sandbox_mode = "read-only"` remains the profile default; host permission overrides are not proof that writes are impossible.
3. Observe the dispatched primary until it produces a terminal result or authoritative evidence establishes failure. An MCP observation timeout is not reviewer failure: continue observing the same live agent or runner session; do not restart, replace, or reset it merely because a polling call timed out. It must return an explicit terminal result; a lifecycle start and end without final assistant output does not count. When clean, the reviewer returns exactly `No actionable findings remain.` Before recording a pass, run:

`mcp__sd0x_skill_runtime__run_skill_script '{"entrypoint":"review/round.js","cwd":"<repository-root>","args":["import"]}'`

The `sd0x_skill_runtime` MCP connection exposes only the deterministic `run_skill_script`. The configured native Codex subagent performs review; the MCP server has no LLM review capability. The passing gate wrapper rescans from the original boundary and finalizes the marker. Only exact direct reviewer paths and terminal messages after the recorded boundary count for the unchanged fingerprint and runtime epoch.
4. Findings must meet the theory's evidence and assurance criteria. Normalize them to `[P0|P1|P2] file:line description → root cause → recommendation → regression protection`. Deduplicate by canonical issue rather than incidental line drift, preserving the highest severity and source attribution.
5. Aggregate only discrete actionable findings with file and line evidence. Any P0, P1, or P2 finding blocks this strict gate.
6. If findings exist, record failure and address their root causes with appropriate recurrence protection. Fixes create a new fingerprint, invalidate the prior result, and require a new round from step 1. If the reviewer is confirmed unavailable, cancelled, or terminal without final output, record failure; do not replace or retry that reviewer type on the same fingerprint without a user-authorized reset. Existing explicit reset authorization, including ongoing authorization covering this recovery, suffices; ask only when that authority is absent. After the formal reset, restart from step 1. A genuine implementation change also requires a fresh round; do not manufacture edits to evade the ledger.
7. Record pass only when the configured primary reviewer reports no actionable findings for the same fingerprint.

Record failure with compact JSON evidence:

`mcp__sd0x_skill_runtime__run_skill_script '{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["fail","--evidence","{\"provider\":\"<provider>\",\"reviewers\":1,\"agents\":[\"<primary-agent>\"],\"findings\":1,\"summary\":\"actionable findings or reviewer failure remain\"}"]}'`

For unavailable reviewer infrastructure, record `findings: 0` and `reviewer_failure: true`. This keeps the gate failed while allowing the review lifecycle to yield. On the same fingerprint, use the reset skill under existing explicit authorization before retrying; request authorization only if none covers this recovery. Restoring reviewer identities may additionally require a new Codex task, but process restart alone does not clear the failed gate or stale ledger. Corrupt-state quarantine requires the new session activation reported by reset.

Record pass only after all provider-plan evidence has been observed:

`mcp__sd0x_skill_runtime__run_skill_script '{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass","--evidence","{\"provider\":\"codex\",\"reviewers\":1,\"agents\":[\"sd0x_codex_primary_reviewer\"],\"findings\":0,\"summary\":\"no actionable findings\"}"]}'`

Claude and other substitute reviewers have no gate authority.

Do not weaken, bypass, or manually edit runtime state when the gate rejects evidence.

## Subjects and modes

Select exactly one subject before starting. Findings remain bound to the inspected
bytes. `default` uses the strict current-worktree protocol above and is the only
mode that records the repository review gate.

Non-default modes are direct reporting workflows. The `round.js` and `gate.js`
wrappers are excluded; these modes never write runtime evidence or satisfy
repository completion.
They still fail closed on a stale subject. Before dispatch, run
`mcp__sd0x_skill_runtime__run_skill_script '{"entrypoint":"review/snapshot.js","cwd":"<repository-root>","args":[]}'`
and retain its canonical root and fingerprint. Immediately after the reviewer
returns, run the same exact tool call again. Discard the reviewer output and report that
the subject changed whenever either value differs; never present stale findings
as the selected subject.
Return their findings to the user with the selected mode, exact subject, inspected
paths, checks performed, and scope limitations.

### `fast`

1. Capture the current staged and unstaged diff plus the directly affected full
   files. Do not expand into unrelated architecture and do not run project checks.
2. Dispatch the configured primary reviewer read-only with the captured diff,
   changed paths, repository guidance, and an explicit `fast` label.
3. Re-run the canonical snapshot check and reject the report if the root or
   fingerprint changed during review.
4. Normalize actionable findings with file and line evidence, mark the result
   preliminary, and state that the default gate remains required.

### `full`

1. Capture the current staged and unstaged diff and complete changed-file set.
   The reviewer chooses the surrounding evidence needed to assess behavior and
   acceptance criteria across that set.
2. Collect evidence from available non-mutating local build, lint, or test checks.
   List each selected check, its exit status, and anything that was unavailable.
3. Dispatch the configured primary reviewer read-only with the same subject and
   check evidence.
4. Re-run the canonical snapshot check and reject the report if the root or
   fingerprint changed during review, then return normalized findings without
   recording a gate.

### `branch`

1. Resolve the comparison base from the user-supplied base, configured upstream,
   or repository default branch, in that order. Inspect repository history without
   mutation to compute the merge base and capture the exact merge-base-to-HEAD
   commit range.
2. Cover every changed path and its behavioral effects in that range. Exclude
   dirty worktree-only changes unless the user explicitly adds them to the subject.
3. Dispatch the configured primary reviewer read-only with the base, merge base,
   head commit, commit list, and range diff.
4. Re-resolve the comparison base, merge base, and HEAD after review and reject
   the report if any identity changed. When dirty worktree changes were explicitly
   included, also re-run the canonical snapshot check and reject fingerprint
   drift. Return findings identified as a branch-range report, not a dirty-worktree
   gate.

### `deep`

1. Capture the current diff and complete changed-file set. The configured primary
   independently evaluates implementation and test/acceptance behavior, choosing
   exploration depth for the architecture, invariants, and risks involved.
2. Follow credible dependencies beyond changed lines to establish or refute failure
   paths; report only defects caused or exposed by the selected subject.
3. Re-run the canonical snapshot check and reject the report if the root or
   fingerprint changed during review.
4. Return evidence-backed, normalized and deduplicated findings, and describe
   the explored context and remaining uncertainty without
   recording a gate.

Repository completion always requires `default` against the exact current
fingerprint.

<!-- sd0x-routing-contract:v1 unit=review/branch -->
```json
{
  "positive_triggers": [
    "Audit all commits on this feature branch against its merge base.",
    "Review every change introduced by the current branch before opening a pull request.",
    "Review the branch range from main through HEAD as one coherent change."
  ],
  "negative_boundaries": [
    "Inspect only the current unstaged diff for a quick preliminary opinion.",
    "Review prose accuracy and links in the migration guide.",
    "Run the mandatory current-worktree gate for deterministic verification."
  ]
}
```

<!-- sd0x-routing-contract:v1 unit=review/deep -->
```json
{
  "positive_triggers": [
    "Deeply inspect these changes, their callers, architecture, and hidden invariants.",
    "Perform an independent whole-codebase investigation around this diff before judging it.",
    "Review this complex change with broad repository exploration and surrounding tests."
  ],
  "negative_boundaries": [
    "Check only whether the tests adequately cover the acceptance criteria.",
    "Give a fast changed-lines-only opinion without broader exploration.",
    "Scan the change exclusively for security vulnerabilities."
  ]
}
```

<!-- sd0x-routing-contract:v1 unit=review/default -->
```json
{
  "positive_triggers": [
    "Perform the standard fingerprint-bound code review before verification.",
    "Review the current dirty worktree and close the repository review gate.",
    "Run the required configured primary review for these changes."
  ],
  "negative_boundaries": [
    "Assess project-wide maintainability and repository health without focusing on a diff.",
    "Create missing regression tests for this implementation.",
    "Summarize the pull request without judging correctness."
  ]
}
```

<!-- sd0x-routing-contract:v1 unit=review/fast -->
```json
{
  "positive_triggers": [
    "Give me a quick diff-only review of the current changed lines.",
    "Inspect this small patch for obvious correctness issues without running checks.",
    "Provide a preliminary fast review before the full repository gate."
  ],
  "negative_boundaries": [
    "Deeply investigate the architectural implications of this cross-cutting change.",
    "Review the complete feature branch commit range against main.",
    "Run local checks and inspect all affected dependencies before reviewing."
  ]
}
```

<!-- sd0x-routing-contract:v1 unit=review/full -->
```json
{
  "positive_triggers": [
    "Complete a comprehensive review with read-only local checks and dependency context.",
    "Inspect this worktree thoroughly and include available build and lint evidence.",
    "Run the full change review, including affected integrations and repository checks."
  ],
  "negative_boundaries": [
    "Audit dependency freshness and advisories without reviewing application logic.",
    "Inspect only this documentation page for clarity and factual accuracy.",
    "Provide a quick diff-only review with no project checks."
  ]
}
```
