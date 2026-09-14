# Behavior-Evaluated Skill Revision — deep-explore/default

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-09-12
> **Implementation Base SHA**: `35edf3b56f0538c0fc02d097653e6092bf7537e4`
> **Status**: Completed
> **Priority**: P1
> **Depends On**: [Previous unit owner](./2026-09-06-model-trust-deep-explore-default-revision.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

依真實模型評測精簡 discovery descriptions，保留可辨識的模式名稱；review 僅抽離較長的 default 協定，簡單流程保留在入口。正式 reviewer authority、fingerprint 與 deterministic verification 不變。評測紀錄與 gate evidence 分開。

## Related Files

- `plugin/sd0x-dev-flow-codex/skills/deep-explore/SKILL.md`
- `scripts/skill-discovery-catalog.json`
- `docs/SKILL-EVALUATION.md`

## Acceptance Criteria

- [x] 精簡後用途與模式仍符合既有 routing contract；新 payload 通過此 unit 的 candidate preflight。
- [x] 較長程序按需讀取，既有操作限制與 gate authority 保留；評測結果與限制可追溯。

## Progress

| Phase | Status | Note |
|---|---|---|
| Development | Complete | Formal-plugin candidate payload `140f5b4747bdc581280badc52dda54a43018b43bf153ad4cd1c53b5d1990a481` preserves the selected unit's operations. |
| Testing | Complete | Routing, semantic, and static checks passed. Preflight `e7b6b88d848230f552061fc01163167c485c5f9b18cca0b37cd647a9f127f239`. Final audit `50e9fbd70fb17a1fdcf75b9012c3ae4c4d138c7e3665736ce736c8465ce355bb` passed. |
| Acceptance | Complete | Runtime-owned R3 closure and promotion evidence bind this Completed owner. |
