# Native Auto Loop Revision — ask/default

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-09-05
> **Implementation Base SHA**: `d6f7e3968881e54c73a73365ad63a9e2b7cc1ba0`
> **Status**: Candidate Complete
> **Priority**: P0
> **Depends On**: [Latest durable owner](./2026-07-28-wave2-ask-default-formal-promotion.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

使用者要求優先移除 Auto Loop 的 Claude MCP review，改用 GPT subagent，
預設繼承 parent model／reasoning effort。來源 `6f221ad` 的 redaction 修正亦
保留於本批。此票接續既有 owner，歷史 payload 與 closure evidence 不改寫。

## Acceptance Criteria

- [x] 此 unit 保留 canonical routing 與原生安全／gate 邊界。
- [x] 此 unit 的修改由實際 runtime／routing／behavior tests 驗證。

## Progress

| Phase | Status | Note |
|---|---|---|
| Development | Complete | Native payload `3714af6f05913c3ac7f9ee079ce021725950e67a97340b3a1dd0356e45b0cb33`. |
| Testing | Complete | Preflight `4314c06064275356245a248be19b0ead8c20604279731a953077f4dd1e051fe5`; behavioral checks passed. |
| Acceptance | Candidate Complete | Pending fingerprint-bound review and verification; no completion claim. |
