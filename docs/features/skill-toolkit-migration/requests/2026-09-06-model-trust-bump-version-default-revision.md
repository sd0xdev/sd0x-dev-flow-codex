# Model Trust Instruction Revision — bump-version/default

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-09-06
> **Implementation Base SHA**: `d6f7e3968881e54c73a73365ad63a9e2b7cc1ba0`
> **Status**: Candidate Complete
> **Priority**: P1
> **Depends On**: [Previous unit owner](./2026-07-28-wave5-bump-version-default-promotion.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

全面指令改版：精簡 discovery、移除舊流程微管理與重複規則、沿用範圍內既有使用者授權。保留 canonical routing、領域知識、具體操作限制與 fingerprint-bound review → verify。歷史 owner 與來源封存保持不變。

## Acceptance Criteria

- [x] 此 unit 的用途與真實操作邊界已核對，且正式 candidate preflight 成功。
- [x] 更新後的 payload 與 preflight identity 已記錄；完成宣告仍依本次 review 與 verify。

## Progress

| Phase | Status | Note |
|---|---|---|
| Development | Complete | Native payload `1920f1115c34934fd42230fed7c65ebac6ea1f06ec12ad587bd70b4aa3fc538e`. |
| Testing | Complete | Preflight `421310d82e757a742039614dbc81990bbaf10066c5fae4166f158a1d026db6f9`; static routing, operation and test-identity audit passed. Full repository verification remains pending. |
| Acceptance | Candidate Complete | Pending current fingerprint primary review and deterministic verification; no final completion claim. |
