# Model Trust Instruction Revision — tech-spec/default

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-09-06
> **Implementation Base SHA**: `d6f7e3968881e54c73a73365ad63a9e2b7cc1ba0`
> **Status**: Completed
> **Priority**: P1
> **Depends On**: [Previous unit owner](./2026-07-14-wave1-tech-spec-promotion.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

全面指令改版：精簡 discovery、移除舊流程微管理與重複規則、沿用範圍內既有使用者授權。保留 canonical routing、領域知識、具體操作限制與 fingerprint-bound review → verify。歷史 owner 與來源封存保持不變。

## Acceptance Criteria

- [x] 此 unit 的用途與真實操作邊界已核對，且正式 candidate preflight 成功。
- [x] 更新後的 payload 與 preflight identity 已記錄；完成宣告仍依本次 review 與 verify。

## Progress

| Phase | Status | Note |
|---|---|---|
| Development | Complete | Native payload `aa27b87681dbdaadba6c75241e2be5d237d220ea483d1e1f7b514bd47e24d425`. |
| Testing | Complete | Preflight `98a9a415f1bc6f40dffa5c2a85d0b75c8534ad078e10ed5fa6ee86c77fd23e92`; Final audit `2912d20b17a62f373273824696babc2baf48677e0109733e39403c25c54bbae5` passed. Fingerprint-bound repository verification passed. |
| Acceptance | Complete | Runtime-owned request closure and promotion evidence bind this Completed owner. |
