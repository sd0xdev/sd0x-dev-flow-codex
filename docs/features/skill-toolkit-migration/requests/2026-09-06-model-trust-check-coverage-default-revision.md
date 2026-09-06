# Model Trust Instruction Revision — check-coverage/default

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-09-06
> **Implementation Base SHA**: `d6f7e3968881e54c73a73365ad63a9e2b7cc1ba0`
> **Status**: Completed
> **Priority**: P1
> **Depends On**: [Previous unit owner](./2026-07-28-wave4-check-coverage-default-formal-promotion.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

全面指令改版：精簡 discovery、移除舊流程微管理與重複規則、沿用範圍內既有使用者授權。保留 canonical routing、領域知識、具體操作限制與 fingerprint-bound review → verify。歷史 owner 與來源封存保持不變。

## Acceptance Criteria

- [x] 此 unit 的用途與真實操作邊界已核對，且正式 candidate preflight 成功。
- [x] 更新後的 payload 與 preflight identity 已記錄；完成宣告仍依本次 review 與 verify。

## Progress

| Phase | Status | Note |
|---|---|---|
| Development | Complete | Native payload `90e3a2911a890a4f8df59a9da96756cd3c901f9f4ec63b6efaef39c6614d14bf`. |
| Testing | Complete | Preflight `8137d4ba265e09c323057f5397b1141ae81966d4a7dee4b1081e6d541c338c69`; Final audit `0fc7ae0efe868604b9c7408637dea43481b4db709d066d7bf912a53cf5f8a198` passed. Fingerprint-bound repository verification passed. |
| Acceptance | Complete | Runtime-owned request closure and promotion evidence bind this Completed owner. |
