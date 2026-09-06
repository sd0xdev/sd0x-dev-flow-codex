---
name: skill-health-check
description: "Audit skill discovery, routing, progressive loading, resources, safety, and verification evidence. Read-only; does not install candidates or claim a review gate."
---

# Skill Health Check

Audit one skill or a bounded skill set for discovery quality, routing precision, progressive loading, resource integrity, operational safety, and verification strength. The workflow is read-only.

## Scope and inventory

The report binds repository fingerprint, plugin root, selected canonical skill names, manifest identity, and the discovery mechanism supported by the current Codex installation. It inventories frontmatter, main instructions, linked references, deterministic scripts, templates, aliases, modes, and tests without executing candidate content.

## Checks

Discovery checks confirm that each public skill has one canonical entrypoint and that mapping-only aliases do not create duplicate owners. Routing checks compare positive triggers, negative boundaries, neighboring skills, and mode ownership for overlap or dead zones.

Progressive-loading checks ensure the main file is sufficient for safe routing, references are linked and bounded, scripts are deterministic and reachable, and large material is loaded only when its branch requires it. Resource checks evaluate reachability and loading against the declared host and package contract; report missing files, unexplained resources, symbolic-link escape, external package drift, unsafe dynamic dependencies, and duplicated runtime logic with evidence.

Safety checks compare declared capabilities and operations with observable behavior, sensitive-operation policy, secret handling, untrusted-content boundaries, path containment, and platform assumptions. Verification checks trace behavior claims to routing, semantic, boundary, failure, and regression evidence.

## Scoring and result

Each finding records severity, exact file and line evidence, affected behavior, confidence, and a minimal remediation. Scores are reported separately for discovery, routing, loading, resources, safety, and verification; a numeric total never hides a critical finding.

The result distinguishes confirmed defects, risks, capability gaps, and informational observations. It does not edit skills, install payloads, dispatch reviewers, run the primary review gate, or substitute for the independent test-review workflow.

<!-- sd0x-routing-contract:v1 unit=skill-health-check/default -->
```json
{
  "positive_triggers": [
    "Apply the canonical skill-health-check workflow and report its evidence.",
    "Help me run the skill-health-check workflow for this repository.",
    "I need the canonical skill-health-check procedure with its safety boundaries."
  ],
  "negative_boundaries": [
    "Do not run skill-health-check; only execute deterministic repository verification.",
    "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
    "Only review the current code changes for correctness and defects."
  ]
}
```
