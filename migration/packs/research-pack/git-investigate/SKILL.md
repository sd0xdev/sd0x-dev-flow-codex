---
name: git-investigate
description: "Route git-investigate using exact migration registry [{\"unit\":\"git-investigate/default\",\"routing\":{\"positive_triggers\":[\"Find when this validation branch was introduced and why.\",\"Trace the history of this function across renames and cite the commits.\",\"Use Git archaeology to identify the change that caused this regression.\"],\"negative_boundaries\":[\"Commit the regression fix and push it.\",\"Explain only how the current function works without historical context.\",\"Map the architecture of the entire validation subsystem.\"]}}]."
---

# Git Archaeology

Trace who changed code, when it changed, how it evolved, and what historical evidence supports a causal explanation. Git access is strictly read-only.

## Investigation protocol

1. Define the symbol, path, behavior, time range, and question. Capture the current commit so findings have a stable reference point.
2. Inspect status and relevant diffs to avoid confusing uncommitted work with history.
3. Start from current code, then follow line attribution, path history across renames, content searches, and candidate commit patches.
4. Read surrounding commits and tests rather than inferring intent from a subject line. Distinguish author, committer, review context, and later modification.
5. For regression questions, identify the last known-good and first known-bad behavior from evidence. Correlation with a commit is not proof of causation.
6. Stop when the historical chain answers the question or when missing history, shallow clones, or rewritten commits prevent a defensible conclusion.

Never change the index, branch, worktree, references, remotes, or configuration. Never fetch, merge, rebase, restore, clean, commit, or push.

## Output

Return the finding, chronological history, key patches, causal assessment, confidence, and limitations. Cite commit identifiers and repository-relative paths.

## Pack handoff

This repository payload is research-pack-ready source material only. It remains outside the core plugin manifest and live skill discovery, and it is not released here. A later separate-plugin repository must provide its own manifest, dependency declaration, installation tests, fingerprint-bound review and verification gates, and release authorization.

<!-- sd0x-active-semantic-contract:v1 unit=git-investigate/default -->
Normative semantic requirements:
- Correlation with a commit is not proof of causation
- Never change the index, branch, worktree, references, remotes, or configuration
- follow line attribution, path history across renames
<!-- sd0x-active-semantic-contract:end -->

<!-- sd0x-semantic-contract:v1 unit=git-investigate/default -->
```json
{
  "required": [
    "Correlation with a commit is not proof of causation",
    "Never change the index, branch, worktree, references, remotes, or configuration",
    "follow line attribution, path history across renames"
  ],
  "forbidden": []
}
```

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
