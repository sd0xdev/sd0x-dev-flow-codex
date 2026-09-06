---
name: git-investigate
description: "Trace code history, renames and candidate regressions using exact commits and patches. Strictly read-only Git archaeology; does not fetch or change repository state."
---

# Git Archaeology

Trace how selected code or behavior evolved and what historical evidence supports the explanation. Bind the analysis to exact commits and distinguish current uncommitted changes from committed history.

Consult relevant patches, line attribution, history across renamed paths, content searches, tests and surrounding context. Distinguish author, committer and later changes. For regressions, identify supported known-good and known-bad behavior; correlation with a commit is not proof of causation.

Git access is strictly read-only. Never change the index, branch, worktree, references, remotes or configuration; do not fetch, merge, rebase, restore, clean, commit or push.

Return the historical finding, causal assessment, important patches and source locations, with limitations such as shallow or rewritten history. Choose the investigation order from the question and evidence.



<!-- sd0x-routing-contract:v1 unit=git-investigate/default -->
```json
{
  "positive_triggers": [
    "Find when this validation branch was introduced and why.",
    "Trace the history of this function across renames and cite the commits.",
    "Use Git archaeology to identify the change that caused this regression."
  ],
  "negative_boundaries": [
    "Commit the regression fix and push it.",
    "Explain only how the current function works without historical context.",
    "Map the architecture of the entire validation subsystem."
  ]
}
```
