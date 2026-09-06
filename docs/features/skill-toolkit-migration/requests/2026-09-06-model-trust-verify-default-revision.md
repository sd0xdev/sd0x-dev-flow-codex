# Model Trust Instruction Revision — verify/default

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-09-06
> **Implementation Base SHA**: `d6f7e3968881e54c73a73365ad63a9e2b7cc1ba0`
> **Status**: Completed
> **Priority**: P1
> **Depends On**: [Previous unit owner](./2026-07-28-wave5-verify-default-promotion.md)
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
| Testing | Complete | Preflight `b0d14dc7a62aa231292fd05df96f77a0f65903ba9798c11be5af5c75be2dbaf1`; Final audit `0b2ff4184719b8c178b95691369d9d153ec4f0856c475af0f98b4ba547e647f7` passed. Fingerprint-bound repository verification passed. |
| Acceptance | Complete | Runtime-owned request closure and promotion evidence bind this Completed owner. |
