# Behavior-Evaluated Skill Revision — verify/precommit

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-09-12
> **Implementation Base SHA**: `35edf3b56f0538c0fc02d097653e6092bf7537e4`
> **Status**: Completed
> **Priority**: P1
> **Depends On**: [Previous unit owner](./2026-09-06-model-trust-verify-precommit-revision.md); [Default mode owner](./2026-09-12-behavior-eval-verify-default-revision.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

依真實模型評測精簡 discovery descriptions，保留可辨識的模式名稱；review 僅抽離較長的 default 協定，簡單流程保留在入口。正式 reviewer authority、fingerprint 與 deterministic verification 不變。評測紀錄與 gate evidence 分開。

## Related Files

- `plugin/sd0x-dev-flow-codex/skills/verify/SKILL.md`
- `scripts/skill-discovery-catalog.json`
- `docs/SKILL-EVALUATION.md`

## Acceptance Criteria

- [x] 精簡後用途與模式仍符合既有 routing contract；新 payload 通過此 unit 的 candidate preflight。
- [x] 較長程序按需讀取，既有操作限制與 gate authority 保留；評測結果與限制可追溯。

## Progress

| Phase | Status | Note |
|---|---|---|
| Development | Complete | Formal-plugin candidate payload `6ae12071c7019c9a603917ae3937b2c4e14d9f49e5aebc68db454d14ecc13244` preserves the selected unit's operations. |
| Testing | Complete | Routing, semantic, and static checks passed. Preflight `a940057b2c28b8c82fdf4654709c611d49ce7b4f813c388bf0ac07edd038e846`. Final audit `79e88b7ab4d96d03cb31c704c63313d81b20d9bc5c6098ba51edadec59611322` passed. |
| Acceptance | Complete | Runtime-owned R3 closure and promotion evidence bind this Completed owner. |
