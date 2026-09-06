# Model Trust Instruction Revision — plan-review/default

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-09-06
> **Implementation Base SHA**: `d6f7e3968881e54c73a73365ad63a9e2b7cc1ba0`
> **Status**: Candidate Complete
> **Priority**: P1
> **Depends On**: [Previous unit owner](./2026-07-28-wave1-plan-review-default-formal-promotion.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

全面指令改版：精簡 discovery、移除舊流程微管理與重複規則、沿用範圍內既有使用者授權。保留 canonical routing、領域知識、具體操作限制與 fingerprint-bound review → verify。歷史 owner 與來源封存保持不變。

## Acceptance Criteria

- [x] 此 unit 的用途與真實操作邊界已核對，且正式 candidate preflight 成功。
- [x] 更新後的 payload 與 preflight identity 已記錄；完成宣告仍依本次 review 與 verify。

## Progress

| Phase | Status | Note |
|---|---|---|
| Development | Complete | Native payload `a311f8a0c741d3803f5f66c377d99162728c0b19874e714bc228264b26339c6b`. |
| Testing | Complete | Preflight `74e6cf7f0f0f9f351f8d12b165c5cce2ca133e7d458a9214ad33b775b7de2055`; static routing, operation and test-identity audit passed. Full repository verification remains pending. |
| Acceptance | Candidate Complete | Pending current fingerprint primary review and deterministic verification; no final completion claim. |
