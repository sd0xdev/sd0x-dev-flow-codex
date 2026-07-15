---
name: brainstorm
description: "Route brainstorm using exact migration registry [{\"unit\":\"brainstorm/default\",\"routing\":{\"positive_triggers\":[\"Brainstorm competing designs for offline synchronization and challenge each one.\",\"Explore solution options adversarially until they converge or clearly diverge.\",\"Stress-test our proposed migration strategy with independent positions.\"],\"negative_boundaries\":[\"Explain this function line by line.\",\"Implement the selected offline synchronization design.\",\"Research the full market landscape with a multi-source evidence report.\"]}}]."
---

# Adversarial Brainstorming

Explore difficult solution spaces through independently formed positions, bounded adversarial challenge, and a clear equilibrium or divergence result.

## Debate protocol

[Read the deterministic debate validator](scripts/debate.js).

1. Define the decision, shared constraints, success criteria, and non-negotiable facts.
2. Native Codex develops Position A from repository evidence. A configured Claude adapter develops Position B from the same neutral question and constraints without seeing Position A. If either model is unavailable, stop as divergent; one model may not impersonate both positions.
3. Compare positions only after both are complete. Register stable claim identifiers, assumptions, conflicts, and evidence gaps.
4. Conduct at most five attack/rebuttal rounds. Every attack record is `{attack_id, target_claim_id, novelty_key, argument, evidence_refs[], proposed_by, validity}`; novelty keys are transcript-global, evidence references must resolve to the claim registry, and the argument must directly rebut its target. Each side records `position_changed`, adjudicated `new_valid_attack`, concessions, position updates, and evidence references in every round.
5. A semantic-validity dispute goes to a blind verifier that generated neither position. A verdict without evidence remains unresolved. Equilibrium exists only when the same round gives both sides no valid or unresolved new attack.
6. Stop early only at equilibrium. After round five, any valid or unresolved attack produces `divergent` with assumptions and Need Human inputs.

## Closed outcomes

Apply precedence `divergent → conditional → pure → pareto` so one transcript has one outcome. Unresolved validity, missing evidence, or non-convergence is `divergent`; assumption-dependent actions are `conditional`; one unconditional dominant position plus full concession is `pure`; remaining quantified non-dominated tradeoffs are `pareto`.

Do not fabricate a second position, cross-seed independent analysis, mutate the repository, or turn the selected idea into implementation.

## Output

Return the decision frame, independent positions, challenge record, equilibrium assessment, agreed actions, divergences, and decision-sensitive unknowns.

## Pack handoff

This repository payload is research-pack-ready source material only. It remains outside the core plugin manifest and live skill discovery, and it is not released here. A later separate-plugin repository must provide its own manifest, dependency declaration, installation tests, fingerprint-bound review and verification gates, and release authorization.

<!-- sd0x-active-semantic-contract:v1 unit=brainstorm/default -->
Normative semantic requirements:
- Apply precedence `divergent → conditional → pure → pareto`
- Conduct at most five attack/rebuttal rounds
- Every attack record is `{attack_id, target_claim_id, novelty_key, argument, evidence_refs[], proposed_by, validity}`
- one model may not impersonate both positions
<!-- sd0x-active-semantic-contract:end -->

<!-- sd0x-semantic-contract:v1 unit=brainstorm/default -->
```json
{
  "required": [
    "Apply precedence `divergent → conditional → pure → pareto`",
    "Conduct at most five attack/rebuttal rounds",
    "Every attack record is `{attack_id, target_claim_id, novelty_key, argument, evidence_refs[], proposed_by, validity}`",
    "one model may not impersonate both positions"
  ],
  "forbidden": [
    "at most three rounds"
  ]
}
```

<!-- sd0x-routing-contract:v1 unit=brainstorm/default -->
```json
{
  "positive_triggers": [
    "Brainstorm competing designs for offline synchronization and challenge each one.",
    "Explore solution options adversarially until they converge or clearly diverge.",
    "Stress-test our proposed migration strategy with independent positions."
  ],
  "negative_boundaries": [
    "Explain this function line by line.",
    "Implement the selected offline synchronization design.",
    "Research the full market landscape with a multi-source evidence report."
  ]
}
```
