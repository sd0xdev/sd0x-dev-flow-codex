---
name: architecture-advice
description: "Route architecture-advice using exact migration registry [{\"unit\":\"architecture-advice/default\",\"routing\":{\"positive_triggers\":[\"Compare architecture options for introducing an event bus in this codebase.\",\"Give an independent architecture second opinion on this proposed caching design.\",\"Recommend a component boundary for the billing integration with repository evidence.\"],\"negative_boundaries\":[\"Create the feature 3-architecture.md lifecycle document.\",\"Implement the selected architecture in production code.\",\"Write an implementation-ready technical specification and task breakdown.\"]}}]."
---

# Architecture Advice

Provide an answer-only architecture second opinion grounded in current repository boundaries. This workflow explores options and tradeoffs; it does not own lifecycle documents or implementation.

## Advice protocol

1. Clarify the decision, constraints, quality attributes, time horizon, and irreversible choices.
2. Inspect existing components, interfaces, ownership boundaries, integration patterns, tests, and operational constraints.
3. Develop at least two credible options independently before selecting a preference. Include a minimal-change option when one exists.
4. Compare coupling, cohesion, failure isolation, compatibility, security, observability, testability, delivery cost, and rollback consequences where relevant.
5. Challenge the preferred option with the strongest counterexample and identify conditions that would reverse the recommendation.
6. Stop with a recommendation, explicit divergence, or a concise list of missing evidence.

Keep repository and Git access read-only. Do not create or update lifecycle artifacts, issue trackers, production code, configuration, or external systems.

## Output

Lead with the recommendation and confidence. Then show repository evidence, option comparison, consequential tradeoffs, reversal conditions, and open questions.

## Pack handoff

This repository payload is research-pack-ready source material only. It remains outside the core plugin manifest and live skill discovery, and it is not released here. A later separate-plugin repository must provide its own manifest, dependency declaration, installation tests, fingerprint-bound review and verification gates, and release authorization.

<!-- sd0x-active-semantic-contract:v1 unit=architecture-advice/default -->
Normative semantic requirements:
- Challenge the preferred option with the strongest counterexample
- Develop at least two credible options independently
- Keep repository and Git access read-only
<!-- sd0x-active-semantic-contract:end -->

<!-- sd0x-semantic-contract:v1 unit=architecture-advice/default -->
```json
{
  "required": [
    "Challenge the preferred option with the strongest counterexample",
    "Develop at least two credible options independently",
    "Keep repository and Git access read-only"
  ],
  "forbidden": []
}
```

<!-- sd0x-routing-contract:v1 unit=architecture-advice/default -->
```json
{
  "positive_triggers": [
    "Compare architecture options for introducing an event bus in this codebase.",
    "Give an independent architecture second opinion on this proposed caching design.",
    "Recommend a component boundary for the billing integration with repository evidence."
  ],
  "negative_boundaries": [
    "Create the feature 3-architecture.md lifecycle document.",
    "Implement the selected architecture in production code.",
    "Write an implementation-ready technical specification and task breakdown."
  ]
}
```
