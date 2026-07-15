---
name: deep-explore
description: "Route deep-explore using exact migration registry [{\"unit\":\"deep-explore/default\",\"routing\":{\"positive_triggers\":[\"Deeply explore how authorization works across this repository.\",\"Map a large subsystem in multiple passes and identify hidden cross-cutting behavior.\",\"Perform a multi-wave codebase exploration with a completeness assessment.\"],\"negative_boundaries\":[\"Answer where one constant is defined.\",\"Implement the authorization changes after exploration.\",\"Research external standards and community practices for authorization.\"]}}]."
---

# Multi-Wave Repository Exploration

Build a high-confidence model of a broad repository area through independent breadth and depth passes, a claim registry, and an explicit completeness gate.

## Exploration protocol

[Read the deterministic completeness helper](scripts/completeness.js).

1. Define the question, contained scope, wave ceiling, and coverage dimensions. Default to two waves; permit a third only for a cross-cutting critical gap, findings more than 70% concentrated in one subsystem, or a high-risk auth/security/migration domain.
2. Breadth: split two or three non-overlapping areas and inspect them independently. Each shard returns key files, flows, claims, uncertainties, and the next high-value target.
3. Gather findings without silently merging conflicts. Build a claim registry keyed by stable claim identifiers with evidence, confidence, and supporting or conflicting shards.
4. Depth: assign the highest-impact gaps to fresh contexts. Pass only the question, scope, verified evidence locations, and unresolved gaps; do not pass conclusions as facts.
5. Compute novelty_rate = unique_new_findings divided by max(1, total_valid_findings), then score = round(100 × (0.7 × (1 - novelty_rate) + 0.3 × is_zero(critical_open))). Zero findings score 70. An unanswered critical user question, unresolved high-severity contradiction, or missing evidence for a high-impact claim is a hard fail.
6. Stop complete only when score is at least 80 and critical_open equals zero. Wave three is allowed only for a cross-cutting critical gap, findings more than 70% concentrated in one subsystem, or a high-risk auth/security/migration domain; an allowed three-wave run also continues for a hard fail. A sub-80 score with no qualifying condition stops Inconclusive after wave two. After wave three, any score below 80 is Inconclusive, and a two-wave ceiling is never exceeded. Preserve divergence rather than forcing agreement.

All investigators are read-only. Never mutate files, Git state, dependencies, or external systems.

## Output

Provide completeness status, executive summary, per-wave findings, claim registry, coverage matrix, proactive discoveries, divergence, and residual risks.

## Pack handoff

This repository payload is research-pack-ready source material only. It remains outside the core plugin manifest and live skill discovery, and it is not released here. A later separate-plugin repository must provide its own manifest, dependency declaration, installation tests, fingerprint-bound review and verification gates, and release authorization.

<!-- sd0x-active-semantic-contract:v1 unit=deep-explore/default -->
Normative semantic requirements:
- Stop complete only when score is at least 80 and critical_open equals zero
- Wave three is allowed only for a cross-cutting critical gap, findings more than 70% concentrated in one subsystem, or a high-risk auth/security/migration domain
- Zero findings score 70
- score = round(100 × (0.7 × (1 - novelty_rate) + 0.3 × is_zero(critical_open)))
<!-- sd0x-active-semantic-contract:end -->

<!-- sd0x-semantic-contract:v1 unit=deep-explore/default -->
```json
{
  "required": [
    "Stop complete only when score is at least 80 and critical_open equals zero",
    "Wave three is allowed only for a cross-cutting critical gap, findings more than 70% concentrated in one subsystem, or a high-risk auth/security/migration domain",
    "Zero findings score 70",
    "score = round(100 × (0.7 × (1 - novelty_rate) + 0.3 × is_zero(critical_open)))"
  ],
  "forbidden": []
}
```

<!-- sd0x-routing-contract:v1 unit=deep-explore/default -->
```json
{
  "positive_triggers": [
    "Deeply explore how authorization works across this repository.",
    "Map a large subsystem in multiple passes and identify hidden cross-cutting behavior.",
    "Perform a multi-wave codebase exploration with a completeness assessment."
  ],
  "negative_boundaries": [
    "Answer where one constant is defined.",
    "Implement the authorization changes after exploration.",
    "Research external standards and community practices for authorization."
  ]
}
```
