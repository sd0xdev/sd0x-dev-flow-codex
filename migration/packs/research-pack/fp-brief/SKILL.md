---
name: fp-brief
description: "Route fp-brief using exact migration registry [{\"unit\":\"fp-brief/default\",\"routing\":{\"positive_triggers\":[\"Create a first-principles brief from this technical proposal.\",\"Decompose the assumptions behind our service migration decision.\",\"Turn these design notes into a reasoning chain with sensitivity analysis.\"],\"negative_boundaries\":[\"Implement the service migration described in the proposal.\",\"Perform a broad multi-source survey of service migration tools.\",\"Write a feature technical specification with implementation tasks.\"]}}]."
---

# First-Principles Briefing

Turn a supplied decision, proposal, or bounded repository topic into a compact reasoning artifact that exposes assumptions, causal logic, rejected alternatives, sensitivity, and unknowns.

## Briefing protocol

1. Resolve the primary input and intended audience. Read linked repository evidence needed to understand the decision while keeping all access read-only.
2. State the root problem without inherited solution language. Separate goals, constraints, observations, and proposed mechanisms.
3. Build an assumptions register. Mark each assumption as observed, inferred, externally sourced, or unverified, with the evidence that could falsify it.
4. Construct the reasoning chain from premises to conclusion. Identify leaps, circular dependencies, and claims that rely on authority rather than evidence.
5. Record credible alternatives and why they were rejected. Do not invent rejection evidence.
6. Test decision sensitivity: show which changed assumptions would alter the conclusion and which would not.
7. Stop with a complete brief or a clearly named evidence gap. Never fill unknowns with confident prose.

Do not modify lifecycle documents, production files, Git state, or external systems. Return the briefing in the conversation; a later explicit writing task may persist it.

## Output

Include root problem, assumptions register, reasoning chain, alternative rejection log, decision sensitivity, open unknowns, and evidence locations.

## Pack handoff

This repository payload is research-pack-ready source material only. It remains outside the core plugin manifest and live skill discovery, and it is not released here. A later separate-plugin repository must provide its own manifest, dependency declaration, installation tests, fingerprint-bound review and verification gates, and release authorization.

<!-- sd0x-active-semantic-contract:v1 unit=fp-brief/default -->
Normative semantic requirements:
- Build an assumptions register
- Construct the reasoning chain from premises to conclusion
- Test decision sensitivity
<!-- sd0x-active-semantic-contract:end -->

<!-- sd0x-semantic-contract:v1 unit=fp-brief/default -->
```json
{
  "required": [
    "Build an assumptions register",
    "Construct the reasoning chain from premises to conclusion",
    "Test decision sensitivity"
  ],
  "forbidden": []
}
```

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
