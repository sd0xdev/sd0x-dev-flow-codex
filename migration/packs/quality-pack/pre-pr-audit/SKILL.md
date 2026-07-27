---
name: pre-pr-audit
description: "Route pre-pr-audit using exact migration registry [{\"unit\":\"pre-pr-audit/default\",\"routing\":{\"negative_boundaries\":[\"Create and publish the pull request for this branch.\",\"Prepare the branch for merge after all pull-request reviews pass.\",\"Summarize the existing pull request for reviewers.\"],\"positive_triggers\":[\"Audit this branch for pull-request readiness without publishing it.\",\"Check whether the current changes, tests, and commits are ready for a pull request.\",\"Perform the final local readiness audit before I create the pull request.\"]}}]."
---

# Audit Pull-Request Readiness

Decide whether the current branch is ready to publish as a pull request without creating or changing remote state.

## Protocol

1. Resolve the base branch and inspect status, commits, changed paths, diff size, generated files, and untracked work.
2. Match the change to its request and acceptance criteria; identify unrelated scope and missing migration or release notes.
3. Check current review and verification evidence, relevant local test results, secret exposure risk, dependency changes, and backward compatibility.
4. Inspect commit coherence and branch hygiene without rewriting history.
5. Classify blockers, warnings, and optional improvements with exact evidence.
6. Return `READY`, `CONDITIONAL`, or `BLOCKED` and list the actions required before publication.

## Boundaries

Do not commit, push, create a pull request, rewrite history, or infer permission for remote changes.

## Result

Report base and head, scope summary, evidence status, blocker list, and readiness decision.

<!-- sd0x-routing-contract:v1 unit=pre-pr-audit/default -->
```json
{
  "positive_triggers": [
    "Audit this branch for pull-request readiness without publishing it.",
    "Check whether the current changes, tests, and commits are ready for a pull request.",
    "Perform the final local readiness audit before I create the pull request."
  ],
  "negative_boundaries": [
    "Create and publish the pull request for this branch.",
    "Prepare the branch for merge after all pull-request reviews pass.",
    "Summarize the existing pull request for reviewers."
  ]
}
```
