# Model Trust Instruction Revision — remind/default

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-09-06
> **Implementation Base SHA**: `d6f7e3968881e54c73a73365ad63a9e2b7cc1ba0`
> **Status**: Candidate Complete
> **Priority**: P1
> **Depends On**: [Previous unit owner](./2026-09-06-remind-authorization-continuity.md); [Latest durable owner](./2026-07-28-wave6-remind-default-promotion.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

全面指令改版：精簡 discovery、移除舊流程微管理與重複規則、沿用範圍內既有使用者授權。保留 canonical routing、領域知識、具體操作限制與 fingerprint-bound review → verify。歷史 owner 與來源封存保持不變。

## Acceptance Criteria

- [x] 此 unit 的用途與真實操作邊界已核對，且正式 candidate preflight 成功。
- [x] 更新後的 payload 與 preflight identity 已記錄；完成宣告仍依本次 review 與 verify。

## Progress

| Phase | Status | Note |
|---|---|---|
| Development | Complete | Native payload `44cb4364a90f43d06bc812a7168804dc0f088c8a41f1028fad259e6ef5be4fb4`. |
| Testing | Complete | Preflight `307109b4757d977a0caac00b27646ae801e0e43ab1c1cd9b646b1cacf37abe77` passed. |
| Acceptance | Candidate Complete | 新版 payload 已通過 canonical move-window audit；等待 fingerprint-bound review、verify 與 durable closure。 |
