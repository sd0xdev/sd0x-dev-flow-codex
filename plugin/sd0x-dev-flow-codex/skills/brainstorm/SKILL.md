---
name: brainstorm
description: "Explore competing designs through independent Codex perspectives and evidence-backed challenge. Reports agreement, conditional choices or divergence without implementing the result."
---

# Adversarial Brainstorming

Explore difficult solution spaces through independently formed positions, bounded adversarial challenge, and a clear equilibrium or divergence result.

## Debate protocol

[Read the deterministic debate validator](scripts/debate.js).

1. Define the decision, shared constraints, success criteria, and non-negotiable facts.
2. Develop independent positions through separate read-only Codex agents receiving the same neutral question and constraints without seeing each other’s position. If an independent position is unavailable, report divergent rather than impersonating the missing agent.
3. Compare positions only after both are complete. Register stable claim identifiers, assumptions, conflicts, and evidence gaps.
4. The bundled validator uses a default budget of five attack/rebuttal rounds; select a positive integer `roundBudget` appropriate to the investigation, and indicate `stopRequested` when further work is unwarranted. Unresolved attacks at either stopping condition remain divergent. Every attack record is `{attack_id, target_claim_id, novelty_key, argument, evidence_refs[], proposed_by, validity}`; novelty keys are transcript-global, evidence references must resolve to the claim registry, and the argument must directly rebut its target. Round sides are `codex_proponent` and `codex_challenger`, with matching `proposed_by` actors `codex-proponent` and `codex-challenger`. Each side records `position_changed`, adjudicated `new_valid_attack`, concessions, position updates, and evidence references in every round.
5. A semantic-validity dispute goes to a blind verifier that generated neither position. A verdict without evidence remains unresolved. Equilibrium exists only when the same round gives both sides no valid or unresolved new attack.
6. Stop with the validated outcome when evidence supports it. If the resource ceiling is reached with valid or unresolved attacks, report `divergent` and identify the decision-sensitive unknowns; do not manufacture additional rounds or consensus.

## Closed outcomes

Apply precedence `divergent → conditional → pure → pareto` so one transcript has one outcome. Unresolved validity, missing evidence, or non-convergence is `divergent`; assumption-dependent actions are `conditional`; one unconditional dominant position plus full concession is `pure`; remaining quantified non-dominated tradeoffs are `pareto`.

Do not fabricate a second position, cross-seed independent analysis, mutate the repository, or turn the selected idea into implementation.

## Output

Return the decision frame, independent positions, challenge record, equilibrium assessment, agreed actions, divergences, and decision-sensitive unknowns.




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
