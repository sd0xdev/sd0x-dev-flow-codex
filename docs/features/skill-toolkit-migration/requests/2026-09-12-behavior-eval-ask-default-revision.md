# Behavior-Evaluated Skill Revision — ask/default

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-09-12
> **Implementation Base SHA**: `35edf3b56f0538c0fc02d097653e6092bf7537e4`
> **Status**: Completed
> **Priority**: P1
> **Depends On**: [Previous unit owner](./2026-09-06-model-trust-ask-default-revision.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

依真實模型評測精簡 discovery descriptions，保留可辨識的模式名稱；review 僅抽離較長的 default 協定，簡單流程保留在入口。正式 reviewer authority、fingerprint 與 deterministic verification 不變。評測紀錄與 gate evidence 分開。

## Related Files

- `plugin/sd0x-dev-flow-codex/skills/ask/SKILL.md`
- `scripts/skill-discovery-catalog.json`
- `docs/SKILL-EVALUATION.md`

## Acceptance Criteria

- [x] 精簡後用途與模式仍符合既有 routing contract；新 payload 通過此 unit 的 candidate preflight。
- [x] 較長程序按需讀取，既有操作限制與 gate authority 保留；評測結果與限制可追溯。

## Progress

| Phase | Status | Note |
|---|---|---|
| Development | Complete | Formal-plugin candidate payload `f39d425789ce7f42acd1bfc4fee9734e49a3726906a3044f0f90aac7eef212c2` preserves the selected unit's operations. |
| Testing | Complete | Routing, semantic, and static checks passed. Preflight `f4f88ffc742e7cefac37031c5b985bac0906033f23b99e7aa5ec93f7109952af`. Final audit `ef8f4991a465742fdb3e2e69c5390a4e978d5f27043f451f675282810f2ee47b` passed. |
| Acceptance | Complete | Runtime-owned R3 closure and promotion evidence bind this Completed owner. |
