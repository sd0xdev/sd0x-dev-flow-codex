# Model Trust Instruction Revision — review/deep

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-09-06
> **Implementation Base SHA**: `d6f7e3968881e54c73a73365ad63a9e2b7cc1ba0`
> **Status**: Candidate Complete
> **Priority**: P1
> **Depends On**: [Previous unit owner](./2026-09-05-native-auto-loop-review-deep-revision.md); [review/default](./2026-09-06-model-trust-review-default-revision.md); [Latest durable owner](./2026-07-26-review-deep-final-audit-closure.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

全面指令改版：精簡 discovery、移除舊流程微管理與重複規則、沿用範圍內既有使用者授權。保留 canonical routing、領域知識、具體操作限制與 fingerprint-bound review → verify。歷史 owner 與來源封存保持不變。

## Acceptance Criteria

- [x] 此 unit 的用途與真實操作邊界已核對，且正式 candidate preflight 成功。
- [x] 更新後的 payload 與 preflight identity 已記錄；完成宣告仍依本次 review 與 verify。

## Progress

| Phase | Status | Note |
|---|---|---|
| Development | Complete | Native payload `4c7d359c0baf56366072d271bd738d01cf72154d70f680c1a01ed556cfbeb2e5`. |
| Testing | Complete | Preflight `fe1656db3ce96ee0e280a54c33e8933b9aec768cdebb240fe47b6731f78d20eb`; static routing, operation and test-identity audit passed. Full repository verification remains pending. |
| Acceptance | Candidate Complete | Pending current fingerprint primary review and deterministic verification; no final completion claim. |
