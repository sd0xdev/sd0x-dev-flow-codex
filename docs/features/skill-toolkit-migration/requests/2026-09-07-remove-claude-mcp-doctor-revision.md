# Remove Claude MCP Connection — doctor/claude

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-09-07
> **Implementation Base SHA**: `d6f7e3968881e54c73a73365ad63a9e2b7cc1ba0`
> **Status**: Candidate Complete
> **Priority**: P1
> **Depends On**: [Previous completed owner](./2026-09-06-model-trust-doctor-claude-revision.md); [Latest durable owner](./2026-07-28-wave6-doctor-claude-promotion.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

依使用者要求移除 Claude MCP connection，doctor 僅診斷 `sd0x_skill_runtime` deterministic runner 與原生 Codex primary。前一 Completed owner 與其 Git evidence 保持原樣；本 request 承接新版 payload 的驗證與交付。

## Acceptance Criteria

- [x] 此 unit 的用途與真實操作邊界已核對，且正式 candidate preflight 成功。
- [x] 更新後的 payload 與 preflight identity 已記錄；完成宣告仍依本次 review 與 verify。

## Progress

| Phase | Status | Note |
|---|---|---|
| Development | Complete | Native payload `15bc6eb13c9db0facb93f5f20f304a7dfd08ed20f3e91129bea0b0b36c5d49bb`. |
| Testing | Complete | Preflight `fd227514fadc46f69648803889c6cd9a548060cd9abb1c844301e5c0dc3231bb` passed. |
| Acceptance | Candidate Complete | 新版 payload 已通過 canonical move-window audit；等待 fingerprint-bound review、verify 與 durable closure。 |
