---
name: fp-brief
description: "Analyze a proposal from first principles, exposing assumptions, causal reasoning, alternatives and decision sensitivity. Returns a read-only briefing."
---

# First-Principles Briefing

Explain the assumptions and reasoning behind the supplied decision, proposal or bounded repository topic. Keep repository, lifecycle documents, Git state and external systems unchanged; return the briefing in the conversation.

Separate the root problem, goals, constraints, observations and proposed mechanisms. Identify consequential assumptions as observed, inferred, externally sourced or unverified, with evidence that could falsify them. Trace the reasoning to its conclusion, exposing unsupported leaps, circularity and appeals to authority.

Consider credible alternatives and decision sensitivity without inventing rejection evidence. Report which changes in assumptions would alter the conclusion, the supporting sources and unresolved gaps. Choose the structure and analysis depth to fit the decision.



<!-- sd0x-routing-contract:v1 unit=fp-brief/default -->
```json
{
  "positive_triggers": [
    "Create a first-principles brief from this technical proposal.",
    "Decompose the assumptions behind our service migration decision.",
    "Turn these design notes into a reasoning chain with sensitivity analysis."
  ],
  "negative_boundaries": [
    "Implement the service migration described in the proposal.",
    "Perform a broad multi-source survey of service migration tools.",
    "Write a feature technical specification with implementation tasks."
  ]
}
```
