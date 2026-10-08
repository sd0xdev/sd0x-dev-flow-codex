---
name: plan-review
description: "Independently review an implementation or migration plan for goal coverage, ordering, repository fit, risks, and verification. Returns findings and readiness without editing the plan or satisfying the code-review gate."
---

# Plan Review

Independently critique an implementation or migration plan before execution. Find missing prerequisites, incorrect ordering, hidden scope, unsafe assumptions, weak validation, and rollback gaps, then return actionable findings and a bounded readiness verdict.

This is analysis-only. Do not rewrite the plan, modify repository files, implement steps, mutate plan state, emit framework sentinels, or record the core fingerprint-bound review gate. Lifecycle-spec correctness belongs to `review-spec`; dirty-worktree correctness belongs to the core `review` workflow.

## 1. Capture the candidate plan

Recover the candidate from the user's supplied plan, established conversation context, or one contained repository-relative plan document. Consult repository evidence to resolve discovery gaps; do not select an unrelated plan merely because it is the only file found. Preserve step identifiers and wording so findings can cite stable locations. Read referenced requirements, technical specifications, architecture decisions, request tickets, repository guidance, and relevant modules only as needed to validate plan claims.

State the plan's intended outcome, scope, non-goals, assumptions, constraints, and success signals. Review incomplete or stale plans as supplied, identifying unsupported intent and unreviewable sections separately from concrete findings. Recover available context before asking. Ask only when unresolved user intent materially changes the assessment; continue all independent inspection and deliver the supported critique with explicit limits instead of ending with questions alone. Do not invent missing plan steps or claim to have reviewed an unavailable plan.

## 2. Research independently

Do not treat the plan's claims as evidence. Inspect the repository paths, interfaces, tests, configurations, dependency edges, deployment behavior, and existing conventions that materially affect the proposed sequence. Keep Git inspection read-only and cite repository-relative locations for consequential findings.

When an independently useful challenge would improve the assessment, give a read-only Codex subagent the raw plan, declared goals, and referenced paths. The reviewer checks the plan independently while the main agent traces ordering and validation seams. Do not exchange conclusions before both passes finish. Otherwise assess both perspectives locally; report any consequential evidence gap.

## 3. Apply review dimensions

[Read the review template](references/output-template.md).

Check:

- **Goal coverage**: every stated outcome and constraint maps to a concrete step or decision.
- **Scope and ownership**: steps stay within the plan and name the responsible component or artifact without inventing assignees.
- **Dependencies and ordering**: prerequisites, migrations, compatibility work, and rollout gates precede consumers.
- **Repository fit**: file/module assumptions and integration seams match observed code.
- **Risk and failure handling**: destructive, irreversible, security-sensitive, data, and operational risks have mitigations.
- **Verification**: each material step has proportional unit, integration, migration, failure-path, or operational evidence.
- **Rollout and rollback**: partial deployment, backward compatibility, monitoring, and reversal are explicit where relevant.
- **Decision closure**: open questions have an owner or decision point before dependent work.

Challenge both omissions and unnecessary complexity. Do not require ceremony that does not reduce a concrete risk.

## 4. Report findings

Report only discrete findings with severity:

- `Blocker`: execution is unsafe or cannot meet a stated outcome.
- `Major`: a likely correctness, dependency, verification, or rollback failure.
- `Minor`: a bounded clarity or maintainability gap worth fixing before execution.

Each finding includes the plan step or section, repository evidence when applicable, root cause, consequence, recommended plan change, and validation that would close it. Separate facts from inferences and mark uncertainty.

End with `Ready`, `Revise`, or `Limited`. The `Revise` verdict applies when evidence supports actionable plan changes; `Limited` applies when consequential missing context prevents an overall readiness judgment; name the assessed portions, unassessed portions, and next evidence needed. `Ready` requires adequate coverage of the material scope and no Blocker or Major findings; it is not implementation approval and does not satisfy the core review gate. Missing context is not itself a request for human approval. Return the critique in the response and leave the candidate plan unchanged.

Completion requires the following outcomes; choose the inspection and checking sequence that establishes them:

- plan coverage, dependency ordering, repository fit, risks, verification, rollout/rollback, and open decisions were examined.
- every actionable finding has precise evidence and a closure check.
- no plan, repository, Git, runtime-state, or external-system mutation occurred.
- The response contains no exposed secrets.

## Pack handoff

This canonical skill is distributed from the core plugin. The [historical planning-pack handoff](references/pack-handoff.md) is migration provenance only; consult it for historical context, not current workflow instructions.

<!-- sd0x-routing-contract:v1 unit=plan-review/default -->
```json
{
  "positive_triggers": [
    "Critique this implementation plan for missing steps, dependency errors, risks, and weak verification.",
    "Review the proposed execution sequence before work begins and return actionable findings.",
    "Stress-test the rollback, validation, and decision points in this plan."
  ],
  "negative_boundaries": [
    "Generate the final component architecture document for the feature.",
    "Inspect the dirty worktree and record the fingerprint-bound code review gate.",
    "Judge whether an existing lifecycle specification is correct and internally consistent."
  ]
}
```
