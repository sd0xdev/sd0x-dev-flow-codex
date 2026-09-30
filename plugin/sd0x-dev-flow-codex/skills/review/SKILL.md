---
name: review
description: "Review changes: default closes the worktree gate; fast (quick diff), full, branch, and deep return reports."
---

# Review a Change

Choose one requested mode. **Default** is the only gating mode: read [the gate protocol](references/default.md) and [review theory](references/review-theory.md) together, then follow that protocol for the current fingerprint. For report-only modes, use the procedures below.

Every mode uses the configured read-only Codex primary reviewer. Inherit the current parent model and reasoning effort through a full-history fork without overrides unless the user explicitly selects reviewer settings. If the host cannot establish those settings or dispatch the configured identity, report unavailability. Claude and other substitute reviewers have no gate authority.

## Subjects and modes

Select exactly one subject before starting. Findings remain bound to the inspected
bytes. `default` uses the linked current-worktree gate protocol and is the only
mode that records the repository review gate.

Non-default modes are direct reporting workflows. The `round.js` and `gate.js`
wrappers are excluded; these modes never write runtime evidence or satisfy
repository completion.
They still fail closed on a stale subject. Resolve `<plugin-root>` as two directories above this skill's installed directory, from the current `SKILL.md` location. The runner inherits `CODEX_HOME` and `CODEX_THREAD_ID` from the current Codex shell. The runner returns JSON with `exit_code`, `stdout`, and `stderr`; parse the script's JSON from `stdout` and respect failures. Before dispatch, run
`node "<plugin-root>/scripts/runtime/runner.js" '{"entrypoint":"review/snapshot.js","cwd":"<repository-root>","args":[]}'`
and retain its canonical root and fingerprint. Immediately after the reviewer
returns, run the same exact runner command again. Discard the reviewer output and report that
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
