# Alias Capability Refresh for Codex 0.153.4

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-09-05
> **Implementation Base SHA**: `d6f7e3968881e54c73a73365ad63a9e2b7cc1ba0`
> **Status**: Candidate Complete
> **Priority**: P0
> **Depends On**: [Codex 0.145.0 Refresh](./2026-07-23-alias-capability-codex-0-145-0-refresh.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

<!-- sd0x-alias-capability-owner:v1 {"codex_version":"codex-cli 0.153.4","decision":"mapping-only","registry_mechanism":null,"tested_at":"2026-09-05T13:06:35+00:00","decision_sha256":"4412b1d5616d89df2c076f2f94ed0ee0cd0aad6ce934e73d4683f6ef67a30724"} -->

## Background

本機 CLI 已更新為 `codex-cli 0.153.4`；原本 `npm run check` 因版本綁定的
0.145.0 alias 證據過期而失敗。以既有 repository-only overlay 與新工作階段執行
`node scripts/probe-alias-capability.js`，保留實際 normalized 輸出。

## Requirements

重新驗證目前 registry capability，保留 mapping-only 與完整 immutable owner chain。

## Acceptance Criteria

- [x] 0.153.4 schema 與 explicit／neutral catalogs 由本專案 `.codex-dev-home` probe 取得。
- [x] 隔離 ephemeral read-only invocation 實際回傳 exact fixture marker。
- [x] Explicit 與 neutral catalog 均包含 alias；automatic exclusion fields 為空。
- [x] Normalized dump、decision、disposition、initializer 與測試使用同一版本。
- [x] 保留所有歷史 owner bytes，新增 0.145.0 hash，並直接 Depends On 前任 owner。

## Progress

Probe 已執行，acceptance-ready；此票的 Candidate Complete 不代表 review 或 verify 通過。
未建立 live alias，未修改全域 Codex home。新 schema 增加 pluginId、icon URL 與
skill input name 等欄位；這些欄位並未提供 automatic-candidate exclusion。

## References

- [Decision](../../../../migration/alias-capability.json)
- [Normalized dump](../../../../migration/evidence/alias-registry-dump.json)

## Probe identity

- Codex version: `codex-cli 0.153.4`
- Tested at: `2026-09-05T13:06:35+00:00`
- Alias decision: `mapping-only`
- Registry mechanism: `null`
