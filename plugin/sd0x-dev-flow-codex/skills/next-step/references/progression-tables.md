# Progression Tables

These tables are advisory after the current fingerprint and runtime gate state are known.

## Code or Configuration Change

| Current evidence | Next action |
|---|---|
| Scope or requirements unclear | Requirements or technical-spec workflow |
| Implementation incomplete | Continue the active feature-dev, bug-fix, or refactor work |
| Implementation complete, tests missing | Add the acceptance-criteria and regression tests |
| Current fingerprint lacks primary review | `$sd0x-dev-flow-codex:review` |
| Primary review has findings | Fix root causes, then review the new fingerprint |
| Primary review clean, verification missing | Default `$sd0x-dev-flow-codex:verify` |
| Verification failed | Fix the failing check, then primary review the new fingerprint |
| Review and verification pass | Synchronize request and documentation evidence, then delivery preview |

## Documentation-Only Change

| Current evidence | Next action |
|---|---|
| Documentation incomplete | Continue the bounded documentation workflow |
| Documentation ready | Primary review for the exact fingerprint |
| Review clean | Delivery preview; deterministic verification is non-required unless repository policy says otherwise |

## Test Sufficiency Question

| Request | Next action |
|---|---|
| Coverage, AC traceability, flakiness, or verification-gap assessment | Explicit non-gating `$sd0x-dev-flow-codex:test-review` handoff |
| Repository correctness gate | Primary review, not test-review |
| Deterministic command evidence | Default verify after primary review |

## Investigation

| Need | Suggested workflow |
|---|---|
| Understand code structure | `$sd0x-dev-flow-codex:code-explore` |
| Trace history | `$sd0x-dev-flow-codex:git-investigate` |
| Analyze an issue | `$sd0x-dev-flow-codex:issue-analyze` |
| Assess feasibility or architecture | Feasibility-study or architecture-advice |

No table entry dispatches its suggestion automatically.
