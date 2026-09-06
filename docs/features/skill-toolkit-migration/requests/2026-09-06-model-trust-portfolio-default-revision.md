# Model Trust Instruction Revision — portfolio/default

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-09-06
> **Implementation Base SHA**: `d6f7e3968881e54c73a73365ad63a9e2b7cc1ba0`
> **Status**: Completed
> **Priority**: P1
> **Depends On**: [Previous unit owner](./2026-07-28-wave7-portfolio-default-promotion.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

全面指令改版：精簡 discovery、移除舊流程微管理與重複規則、沿用範圍內既有使用者授權。保留 canonical routing、領域知識、具體操作限制與 fingerprint-bound review → verify。歷史 owner 與來源封存保持不變。

## Acceptance Criteria

- [x] 此 unit 的用途與真實操作邊界已核對，且正式 candidate preflight 成功。
- [x] 更新後的 payload 與 preflight identity 已記錄；完成宣告仍依本次 review 與 verify。

## Progress

| Phase | Status | Note |
|---|---|---|
| Development | Complete | Native payload `03de4b342029d12fdb3c8611ce22804e16b846472f72d49dafebfbca083d07c8`. |
| Testing | Complete | Preflight `7e52bee12893e761236a2ff33a47611409174073c53e652d8261e048c422af99`; Final audit `e1853f3fbf3bef435c5fe04d3b0c0a31a0d063f907068b34b15c236d029a8776` passed. Fingerprint-bound repository verification passed. |
| Acceptance | Complete | Runtime-owned request closure and promotion evidence bind this Completed owner. |
