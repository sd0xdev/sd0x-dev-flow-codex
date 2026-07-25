---
name: review
description: "Route review using exact migration registry [{\"unit\":\"review/branch\",\"routing\":{\"negative_boundaries\":[\"Inspect only the current unstaged diff for a quick preliminary opinion.\",\"Review prose accuracy and links in the migration guide.\",\"Run the mandatory current-worktree gate for deterministic verification.\"],\"positive_triggers\":[\"Audit all commits on this feature branch against its merge base.\",\"Review every change introduced by the current branch before opening a pull request.\",\"Review the branch range from main through HEAD as one coherent change.\"]}},{\"unit\":\"review/deep\",\"routing\":{\"negative_boundaries\":[\"Check only whether the tests adequately cover the acceptance criteria.\",\"Give a fast changed-lines-only opinion without broader exploration.\",\"Scan the change exclusively for security vulnerabilities.\"],\"positive_triggers\":[\"Deeply inspect these changes, their callers, architecture, and hidden invariants.\",\"Perform an independent whole-codebase investigation around this diff before judging it.\",\"Review this complex change with broad repository exploration and surrounding tests.\"]}},{\"unit\":\"review/default\",\"routing\":{\"negative_boundaries\":[\"Assess project-wide maintainability and repository health without focusing on a diff.\",\"Create missing regression tests for this implementation.\",\"Summarize the pull request without judging correctness.\"],\"positive_triggers\":[\"Perform the standard fingerprint-bound code review before verification.\",\"Review the current dirty worktree and close the repository review gate.\",\"Run the required independent implementation and test reviews for these changes.\"]}},{\"unit\":\"review/fast\",\"routing\":{\"negative_boundaries\":[\"Deeply investigate the architectural implications of this cross-cutting change.\",\"Review the complete feature branch commit range against main.\",\"Run local checks and inspect all affected dependencies before reviewing.\"],\"positive_triggers\":[\"Give me a quick diff-only review of the current changed lines.\",\"Inspect this small patch for obvious correctness issues without running checks.\",\"Provide a preliminary fast review before the full repository gate.\"]}},{\"unit\":\"review/full\",\"routing\":{\"negative_boundaries\":[\"Audit dependency freshness and advisories without reviewing application logic.\",\"Inspect only this documentation page for clarity and factual accuracy.\",\"Provide a quick diff-only review with no project checks.\"],\"positive_triggers\":[\"Complete a comprehensive review with read-only local checks and dependency context.\",\"Inspect this worktree thoroughly and include available build and lint evidence.\",\"Run the full change review, including affected integrations and repository checks.\"]}}]."
---

# Close the Review Gate

1. Resolve this skill's installed directory. Read the [review theory](references/review-theory.md); its independent-research, orthogonal-perspective, evidence, severity, and convergence rules govern every reviewer. Run `node "<this-skill-directory>/scripts/provider.js"`, then `node "<this-skill-directory>/scripts/snapshot.js"`. Parse and retain the configured provider, primary agent, root, fingerprint, and changed files. Stop if the worktree is clean. Run `node "<this-skill-directory>/scripts/round.js" begin` immediately before dispatch. On Codex surfaces with persistent collaboration agents, the round wrapper records a fingerprint-bound transcript boundary for the explicit Codex JSONL adapter; an unavailable adapter is non-fatal only when native reviewer lifecycle evidence remains authoritative.
2. In one parallel dispatch, start the configured primary reviewer and the independent Codex test perspective. Neither reviewer receives the other's conclusions:
   - For provider `codex`, dispatch `sd0x_codex_primary_reviewer` against the snapshot. Its project profile pins model gpt-5.6-sol, reasoning effort xhigh, and read-only mode.
   - For provider `claude`, dispatch `sd0x_claude_primary_reviewer` against the snapshot. The required nested entrypoint is mcp__sd0x_claude_review__review_worktree with the exact root and fingerprint. On a fix round, give it only its own prior normalized finding identities. The nested Claude evidence recorder must store a structured result; the parent task never substitutes prose for that nested result.
   - Dispatch `sd0x_test_reviewer` against the same fingerprint for the native Codex test and acceptance perspective. On a fix round, give it only its own prior finding identities as hypotheses to revalidate.
3. Wait for both reviewer results. Each reviewer must return an explicit terminal result; a lifecycle start and end without final assistant output does not count. In Claude mode, a failed, missing, unstructured, or stale nested result also blocks the gate. When clean, each reviewer returns exactly `No actionable findings remain.` Before recording a pass, run `node "<this-skill-directory>/scripts/round.js" import`; the passing gate wrapper rescans from the original boundary and finalizes the marker. Only exact direct reviewer paths and terminal messages after the recorded boundary count for the unchanged fingerprint and runtime epoch.
4. Apply the theory's five deliberate checks before accepting a finding. Normalize survivors to `[P0|P1|P2] file:line description → root cause → recommendation → regression protection`, then deduplicate by file and canonical issue while ignoring line drift of at most five lines. Keep the highest severity and preserve source attribution.
5. Aggregate only discrete actionable findings with file and line evidence. Any P0, P1, or P2 finding blocks this strict gate.
6. If findings exist, record failure. Before editing, identify each finding's symptom, violated invariant or root cause, minimal fix, and recurrence protection. Fixes create a new fingerprint, invalidate both prior results, and require a new round from step 1. If a reviewer is unavailable, cancelled, or lacks terminal output, record failure; do not replace or retry that reviewer type on the same fingerprint. Ask the user before running the sd0x Dev Flow reset skill, then restart from step 1 only after the user-authorized reset. A genuine fingerprint change invalidates the stale evidence and requires a fresh round.
7. Record pass only when the configured primary reviewer and the Codex test perspective independently report no actionable findings for the same fingerprint. Claude mode additionally requires the nested Claude structured clean result.

Record failure with compact JSON evidence:

```bash
node "<this-skill-directory>/scripts/gate.js" fail --evidence '{"provider":"<provider>","reviewers":2,"agents":["<primary-agent>","sd0x_test_reviewer"],"findings":1,"summary":"actionable findings or reviewer failure remain"}'
```

For unavailable reviewer infrastructure, record `findings: 0` and `reviewer_failure: true`. This keeps the gate failed while allowing the review lifecycle to yield. On the same fingerprint, a user-authorized reset is required before retrying; restoring reviewer identities may additionally require a new Codex task, but process restart alone does not clear the failed gate or stale ledger.

Record pass only after all provider-plan evidence has been observed:

```bash
node "<this-skill-directory>/scripts/gate.js" pass --evidence '{"provider":"codex","reviewers":2,"agents":["sd0x_codex_primary_reviewer","sd0x_test_reviewer"],"findings":0,"summary":"no actionable findings"}'
```

For Claude mode, the provider plan requires `sd0x_claude_primary_reviewer`, `sd0x_test_reviewer`, and `claude_mcp_primary`.

Do not weaken, bypass, or manually edit runtime state when the gate rejects evidence.

## Subjects and modes

Select exactly one subject before starting. Findings remain bound to the inspected
bytes. `default` uses the strict current-worktree protocol above and is the only
mode that records the repository review gate.

Non-default modes are direct reporting workflows. The `round.js` and `gate.js`
wrappers are excluded; these modes never write runtime evidence or satisfy
repository completion.
Return their findings to the user with the selected mode, exact subject, inspected
paths, checks performed, and scope limitations.

### `fast`

1. Capture the current staged and unstaged diff plus the directly affected full
   files. Do not expand into unrelated architecture and do not run project checks.
2. Dispatch the configured primary reviewer read-only with the captured diff,
   changed paths, repository guidance, and an explicit `fast` label.
3. Normalize actionable findings with file and line evidence, mark the result
   preliminary, and state that the default gate remains required.

### `full`

1. Capture the current staged and unstaged diff, full changed files, directly
   affected callers and dependencies, repository guidance, and relevant specs.
2. Collect evidence from available non-mutating local build, lint, or test checks.
   List each selected check, its exit status, and anything that was unavailable.
3. Dispatch the configured primary reviewer read-only with the same subject and
   check evidence, then return normalized findings without recording a gate.

### `branch`

1. Resolve the comparison base from the user-supplied base, configured upstream,
   or repository default branch, in that order. Inspect repository history without
   mutation to compute the merge base and capture the exact merge-base-to-HEAD
   commit range.
2. Inspect every changed path and full changed file in that range. Exclude dirty
   worktree-only changes unless the user explicitly adds them to the subject.
3. Dispatch the configured primary reviewer read-only with the base, merge base,
   head commit, commit list, and range diff. Return findings identified as a
   branch-range report, not a dirty-worktree gate.

### `deep`

1. Capture the current diff and full changed files, then map surrounding
   architecture, callers, invariants, state transitions, and relevant tests.
2. Independent read-only implementation and test/acceptance passes precede the
   evidence comparison. Follow credible dependencies beyond changed lines, but
   report only defects caused or exposed by the selected subject.
3. Apply the five deliberate checks, normalize and deduplicate the surviving
   findings, and describe the explored context and remaining uncertainty without
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
    "Run the required independent implementation and test reviews for these changes."
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
