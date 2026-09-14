---
name: brainstorm
description: "Explore competing designs through independent Codex perspectives and evidence-backed challenge. Reports agreement, conditional choices or divergence without implementing the result."
---

# Adversarial Brainstorming

Explore difficult solution spaces through independently formed positions, bounded adversarial challenge, and a clear equilibrium or divergence result.

## Participants

Both positions and any blind verifier default to independent, read-only Codex subagents. This path needs no external platform, Claude installation, authentication, or availability probe.

Claude is an optional fallback when the user selects it or a Codex subagent is unavailable. Only then check for an already available Claude CLI. Each affected role needs a separate, read-only conversation. Consult local CLI help when needed to establish read-only execution and conversation isolation; if either cannot be established, treat that participant as unavailable. Do not install or authenticate Claude, restore Claude MCP, or change platform configuration as part of brainstorming. If a needed independent participant remains unavailable, report divergent with that limitation as a precondition failure, without inventing rounds or passing an empty transcript to the validator.

Give each position the same neutral question and constraints without the other position's analysis. Record the actual provider and agent/conversation reference for each role; never label Claude output as Codex output. Keep participants fixed within a transcript. If a participant must be replaced after debate starts, begin a new independent transcript. These debate participants do not satisfy the repository's configured primary review gate.

## Debate protocol

[Read the deterministic debate validator](scripts/debate.js).

1. Define the decision, shared constraints, success criteria, and non-negotiable facts.
2. Develop both independent positions using the participant selection above. If an independent position is unavailable, report divergent rather than impersonating the missing agent.
3. Compare positions only after both are complete. Register stable claim identifiers, assumptions, conflicts, and evidence gaps.
4. The bundled validator uses a default budget of five attack/rebuttal rounds; select a positive integer `roundBudget` appropriate to the investigation, and indicate `stopRequested` when further work is unwarranted. Unresolved attacks at either stopping condition remain divergent. Every attack record is `{attack_id, target_claim_id, novelty_key, argument, evidence_refs[], proposed_by, validity}`; novelty keys are transcript-global, evidence references must resolve to the claim registry, and the argument must directly rebut its target. Each round has exactly one `<provider>_proponent` and one `<provider>_challenger`, where each provider is `codex` or `claude`, with `proposed_by` using the matching `<provider>-<role>`. The default remains `codex_proponent` and `codex_challenger`; a Claude challenger uses `claude_challenger` and `claude-challenger`. Keep these provider/role bindings unchanged across rounds. Each side records `position_changed`, adjudicated `new_valid_attack`, concessions, position updates, and evidence references in every round. Validation checks the declared transcript structure; it does not authenticate provider execution.
5. A semantic-validity dispute goes to a blind verifier that generated neither position. Supply the disputed claims, arguments, and evidence without provider identities or an expected verdict. A verdict without evidence remains unresolved. Equilibrium exists only when the same round gives both sides no valid or unresolved new attack.
6. Stop with the validated outcome when evidence supports it. If the resource ceiling is reached with valid or unresolved attacks, report `divergent` and identify the decision-sensitive unknowns; do not manufacture additional rounds or consensus.

## Closed outcomes

Apply precedence `divergent → conditional → pure → pareto` so one transcript has one outcome. Unresolved validity, missing evidence, or non-convergence is `divergent`; assumption-dependent actions are `conditional`; one unconditional dominant position plus full concession is `pure`; remaining quantified non-dominated tradeoffs are `pareto`.

Do not fabricate a second position, cross-seed independent analysis, mutate the repository, or turn the selected idea into implementation.

## Output

Return the decision frame, participant provenance and any fallback reason, independent positions, challenge record, equilibrium assessment, agreed actions, divergences, and decision-sensitive unknowns.




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
