# Model Trust Instruction Revision — skill-health-check/default

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-09-06
> **Implementation Base SHA**: `d6f7e3968881e54c73a73365ad63a9e2b7cc1ba0`
> **Status**: Candidate Complete
> **Priority**: P1
> **Depends On**: [Previous unit owner](./2026-07-28-wave6-skill-health-check-default-promotion.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

全面指令改版：精簡 discovery、移除舊流程微管理與重複規則、沿用範圍內既有使用者授權。保留 canonical routing、領域知識、具體操作限制與 fingerprint-bound review → verify。歷史 owner 與來源封存保持不變。

## Acceptance Criteria

- [x] 此 unit 的用途與真實操作邊界已核對，且正式 candidate preflight 成功。
- [x] 更新後的 payload 與 preflight identity 已記錄；完成宣告仍依本次 review 與 verify。

## Progress

| Phase | Status | Note |
|---|---|---|
| Development | Complete | Native payload `e2544ed6c604c2c938475bc2bb51584d8002abb6772261c9dd22af9bdbbc1ce2`. |
| Testing | Complete | Preflight `205a540c2b9c58de6b4abc6efeafd2f2b396f52d275fcc42f60f9817541c9521`; static routing, operation and test-identity audit passed. Full repository verification remains pending. |
| Acceptance | Candidate Complete | Pending current fingerprint primary review and deterministic verification; no final completion claim. |
