---
name: architecture-advice
description: "Compare architecture choices and offer an evidence-backed second opinion. Returns advice without writing lifecycle documents or implementation."
---

# Architecture Advice

Give an answer-only second opinion grounded in the decision, repository boundaries and operational constraints. Keep repository and Git access read-only; do not create lifecycle documents, implement code or mutate external systems.

Compare credible alternatives where they exist, including minimal change where useful. Evaluate consequential coupling, failure isolation, compatibility, security, testability, delivery and rollback tradeoffs. Challenge the preferred option with decision-sensitive counterevidence; do not invent alternatives to meet a count.

Lead with the recommendation and confidence, supported by repository evidence, consequential tradeoffs, reversal conditions and unresolved questions. Choose investigation depth and presentation to fit the decision.



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
