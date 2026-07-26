# Feature-Dev Single-Primary Re-promotion

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-07-26
> **Implementation Base SHA**: `2631aaff15b4a829f54ac34c2365887b0cb3e0e1`
> **Status**: Completed
> **Priority**: P0
> **Depends On**: [Wave 3 Feature-Dev Core Promotion](./2026-07-15-wave3-feature-dev-promotion.md), [R4 — Alias Registry Capability](./2026-07-10-skill-alias-capability-r4.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

The fingerprint-bound completion loop now requires exactly one configured primary
reviewer. The shipped `feature-dev` orchestration must describe that authority
model without retaining the retired independent test-reviewer gate.

## Requirements

- Keep `feature-dev/default` as the only owner of the implementation workflow.
- Require the configured primary review and deterministic verification before completion.
- Keep test-quality review optional and outside repository gate authority.

## Scope

| Scope | Description |
|---|---|
| In | Re-promote the `feature-dev/default` payload after its single-primary completion contract changes. |
| Out | Feature implementation behavior, deterministic verification selection, and compatibility entrypoints |

## Related Files

| File | Action | Description |
|---|---|---|
| `plugin/sd0x-dev-flow-codex/skills/feature-dev/` | Update | Single-primary completion orchestration |
| `test/feature-dev-default-routing.test.js` | Read | Trusted routing contract |
| `migration/source-disposition.json` | Update | Candidate-to-promotion revision |

## Acceptance Criteria

- [x] Candidate preserves the complete implementation workflow and its meaningful failure boundaries.
- [x] Contract binds every assigned source name to this single canonical promotion unit.
- [x] Compatibility aliases remain mapping-only and add no discovered compatibility entrypoints.
- [x] Trusted routing tests distinguish positive prompts from adjacent skill boundaries.
- [x] Candidate preflight binds exact payload and behavioral-test identity.
- [x] Final core destination and move-window comparison are fixed for the accepted candidate bytes.
- [x] R3 closure inputs identify this exact request, promotion unit, evidence kind, and final-fingerprint fields.

## Progress

| Phase | Status | Note |
|---|---|---|
| Analysis | Complete | The retired test-reviewer gate was isolated from the feature workflow. |
| Development | Complete | Candidate payload `058f96660dc1dc9055ce80d45c0537bbf3654c6d2606d3e59fcf8b57d60bb3fa` and its closed behavior contract are complete. |
| Testing | Complete | Preflight `6aa17773b5ba2197c95be10ed05668fd19a0615e84be4e4bbfebecf2882a241e` binds the candidate payload, routing tests, and disposition rows. |
| Acceptance | Complete | All seven ACs have Complete/High evidence; subject review and final core audit passed. This exact Completed proposal is owned by the runtime closure transaction. |

## References

- Tech Spec: [Skill Toolkit Migration](../2-tech-spec.md)
