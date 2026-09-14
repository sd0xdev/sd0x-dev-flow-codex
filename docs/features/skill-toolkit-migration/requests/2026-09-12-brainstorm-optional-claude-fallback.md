# Adversarial Brainstorming — Native Default and Optional Claude Fallback

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-09-12
> **Implementation Base SHA**: `35edf3b56f0538c0fc02d097653e6092bf7537e4`
> **Status**: Completed
> **Priority**: P1
> **Depends On**: [Previous unit owner](./2026-09-06-model-trust-brainstorm-default-revision.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

使用者要求 Adversarial Brainstorming 預設使用 subagents、不依賴其他平台，Claude 作為備選。既有版本已使用 Codex agents，但沒有 Claude 備選協定或對應 transcript 驗證。此次只修訂 brainstorm/default；歷史 owner 與來源封存保持不變。

## Acceptance Criteria

- [x] 預設以獨立、唯讀 Codex subagents 產生立場及盲驗，不需要檢查、安裝或登入 Claude。
- [x] 使用者指定或 Codex subagent 不可用時，可用既有 Claude CLI 作備選；保留唯讀、輸入隔離、實際來源紀錄及無參與者時的 divergent 結果，不恢復 Claude MCP 或授予 review gate 權限。
- [x] 驗證器接受 Codex、Claude 及混合來源的固定角色，拒絕來源／角色冒用、重複角色與中途來源替換；保留證據、novelty、未解攻擊及回合上限驗證。
- [x] 新 payload 與 preflight identity 經 candidate audit 核對；本次交付維持 configured primary review、deterministic verify 及 runtime-owned closure／promotion 門檻，並以 replacement owner 接續最新紀錄，不沿用舊版完成證據。

## Progress

| Phase | Status | Note |
|---|---|---|
| Development | Complete | Formal-plugin candidate payload `d8d138afcb29d9deb8168416f29c82bc76d6efdbe1b137236a5fe515c9e10464` preserves native independence and adds optional Claude provenance. |
| Testing | Complete | Routing, semantic, and static checks passed. Preflight `b1372f218d64a30b798c9ad701ef09f67613e8595871fbefa84f7166fb4be830`. Final audit `f73f427d4bf6b7906f94951a893b4701aad068a306ef817aa8e2d67e63609e3b` passed. |
| Acceptance | Complete | Runtime-owned R3 closure and promotion evidence bind this Completed owner. |
