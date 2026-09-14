# Behavior-Evaluated Skill Revision — code-explore/default

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-09-12
> **Implementation Base SHA**: `35edf3b56f0538c0fc02d097653e6092bf7537e4`
> **Status**: Completed
> **Priority**: P1
> **Depends On**: [Previous unit owner](./2026-09-06-model-trust-code-explore-default-revision.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

依真實模型評測精簡 discovery descriptions，保留可辨識的模式名稱；review 僅抽離較長的 default 協定，簡單流程保留在入口。正式 reviewer authority、fingerprint 與 deterministic verification 不變。評測紀錄與 gate evidence 分開。

## Related Files

- `plugin/sd0x-dev-flow-codex/skills/code-explore/SKILL.md`
- `scripts/skill-discovery-catalog.json`
- `docs/SKILL-EVALUATION.md`

## Acceptance Criteria

- [x] 精簡後用途與模式仍符合既有 routing contract；新 payload 通過此 unit 的 candidate preflight。
- [x] 較長程序按需讀取，既有操作限制與 gate authority 保留；評測結果與限制可追溯。

## Progress

| Phase | Status | Note |
|---|---|---|
| Development | Complete | Formal-plugin candidate payload `8c9c08f04685dd4049074fcc0f36d3fc636a99d27f4d29b03cb0da5bec6f10d1` preserves the selected unit's operations. |
| Testing | Complete | Routing, semantic, and static checks passed. Preflight `82cc74ca7439617ef297ee1241c3b52b2eee8109b280b8136aea1d7f953159a6`. Final audit `b682ccabfacef0febff9529939563bc7c75b023860314bc0c2a5924b4b25875b` passed. |
| Acceptance | Complete | Runtime-owned R3 closure and promotion evidence bind this Completed owner. |
