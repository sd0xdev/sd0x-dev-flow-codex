# Model Trust Instruction Revision — review/fast

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-09-06
> **Implementation Base SHA**: `d6f7e3968881e54c73a73365ad63a9e2b7cc1ba0`
> **Status**: Candidate Complete
> **Priority**: P1
> **Depends On**: [Previous unit owner](./2026-09-05-native-auto-loop-review-fast-revision.md); [review/default](./2026-09-06-model-trust-review-default-revision.md); [Latest durable owner](./2026-07-26-review-fast-final-audit-closure.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

全面指令改版：精簡 discovery、移除舊流程微管理與重複規則、沿用範圍內既有使用者授權。保留 canonical routing、領域知識、具體操作限制與 fingerprint-bound review → verify。歷史 owner 與來源封存保持不變。

## Acceptance Criteria

- [x] 此 unit 的用途與真實操作邊界已核對，且正式 candidate preflight 成功。
- [x] 更新後的 payload 與 preflight identity 已記錄；完成宣告仍依本次 review 與 verify。

## Progress

| Phase | Status | Note |
|---|---|---|
| Development | Complete | Native payload `18e9ec812fdc9a29ac3aad36564ce12cc1d89567029f37bebddba8805ee837bd`. |
| Testing | Complete | Preflight `165093a8d32b49ca63834402c3d8fee619584a65c673e3250b7bf81c107209f1` passed. |
| Acceptance | Candidate Complete | 新版 payload 已通過 canonical move-window audit；等待 fingerprint-bound review、verify 與 durable closure。 |
