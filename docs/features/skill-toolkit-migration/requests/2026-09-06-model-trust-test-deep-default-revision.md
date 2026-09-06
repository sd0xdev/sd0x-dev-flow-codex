# Model Trust Instruction Revision — test-deep/default

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-09-06
> **Implementation Base SHA**: `d6f7e3968881e54c73a73365ad63a9e2b7cc1ba0`
> **Status**: Completed
> **Priority**: P1
> **Depends On**: [Previous unit owner](./2026-07-28-wave3-test-deep-default-formal-promotion.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

全面指令改版：精簡 discovery、移除舊流程微管理與重複規則、沿用範圍內既有使用者授權。保留 canonical routing、領域知識、具體操作限制與 fingerprint-bound review → verify。歷史 owner 與來源封存保持不變。

## Acceptance Criteria

- [x] 此 unit 的用途與真實操作邊界已核對，且正式 candidate preflight 成功。
- [x] 更新後的 payload 與 preflight identity 已記錄；完成宣告仍依本次 review 與 verify。

## Progress

| Phase | Status | Note |
|---|---|---|
| Development | Complete | Native payload `736cf62c7d14d23022c8a178de8bc0de4b8675e13a2ce2868748e6b1333df7e3`. |
| Testing | Complete | Preflight `64042994a8c45c088c725f402969e8b19b4288c86e13dcc79c9cf119810f8a70`; Final audit `bb53be13503a2b4bbfb2f5002d4024a2fe476c0c960d443a28cf8a189c9cec23` passed. Fingerprint-bound repository verification passed. |
| Acceptance | Complete | Runtime-owned request closure and promotion evidence bind this Completed owner. |
