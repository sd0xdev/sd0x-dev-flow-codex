# Model Trust Instruction Revision — verify/fast

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-09-06
> **Implementation Base SHA**: `d6f7e3968881e54c73a73365ad63a9e2b7cc1ba0`
> **Status**: Candidate Complete
> **Priority**: P1
> **Depends On**: [Previous unit owner](./2026-07-28-wave5-verify-fast-promotion.md); [verify/default](./2026-09-06-model-trust-verify-default-revision.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

全面指令改版：精簡 discovery、移除舊流程微管理與重複規則、沿用範圍內既有使用者授權。保留 canonical routing、領域知識、具體操作限制與 fingerprint-bound review → verify。歷史 owner 與來源封存保持不變。

## Acceptance Criteria

- [x] 此 unit 的用途與真實操作邊界已核對，且正式 candidate preflight 成功。
- [x] 更新後的 payload 與 preflight identity 已記錄；完成宣告仍依本次 review 與 verify。

## Progress

| Phase | Status | Note |
|---|---|---|
| Development | Complete | Native payload `c6d3107d42111b909b391bd62189d1ff98fd0ddd7c6da5c50ec3996565d039b7`. |
| Testing | Complete | Preflight `ab4076f2dc42a873d5cbe5c3407430cd555568ea3c9db37883c4dc329bf1042e` passed. |
| Acceptance | Candidate Complete | 新版 payload 已通過 canonical move-window audit；等待 fingerprint-bound review、verify 與 durable closure。 |
