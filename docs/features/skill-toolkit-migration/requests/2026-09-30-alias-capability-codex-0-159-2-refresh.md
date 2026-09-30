# Alias Capability Refresh for Codex 0.159.2

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-09-30
> **Implementation Base SHA**: `ef87084bb820cfd036b1537e685b436ea339d860`
> **Status**: Candidate Complete
> **Priority**: P0
> **Depends On**: [Codex 0.154.0 Refresh](./2026-09-14-alias-capability-codex-0-154-0-refresh.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

<!-- sd0x-alias-capability-owner:v1 {"codex_version":"codex-cli 0.159.2","decision":"mapping-only","registry_mechanism":null,"tested_at":"2026-09-30T07:06:51.186Z","decision_sha256":"db834be4877d53b92b7aaa8a238aa5854536ff2b53371b577dbd50ce5507fb6c"} -->

## Background

本機 Codex 升至 0.159.2 後，source audit 正確拒絕沿用 0.154.0 證據。本次以 repository-only home 重新執行 canonical probe；不修改歷史 owner bytes，也不由版本字串推定 capability。

## Requirements

以當前 schema、實際 catalogs 與隔離 invocation 重新綁定 alias 決策；保留完整 provenance。

## Acceptance Criteria

- [x] 0.159.2 schema 與 explicit／neutral catalogs 由本專案 .codex-dev-home probe 取得。
- [x] Isolated ephemeral read-only invocation 回傳 exact fixture marker，probe fixture 與 lease 正常清理。
- [x] 兩份 catalog 均包含 alias，automatic exclusion fields 仍為空，維持 mapping-only。
- [x] Normalized dump、decision、disposition、initializer 與 current-version 測試同步。
- [x] 新增 0.154.0 owner 原始 bytes hash 與直接 Depends On；完整歷史鏈保持不變。

## Progress

Canonical probe 成功。Candidate Complete 表示 capability evidence 已備妥，不宣稱 runtime review、deterministic verify 或發行已完成。

## References

- [Decision](../../../../migration/alias-capability.json)
- [Normalized dump](../../../../migration/evidence/alias-registry-dump.json)

## Probe identity

- Codex version: `codex-cli 0.159.2`
- Tested at: `2026-09-30T07:06:51.186Z`
- Alias decision: `mapping-only`
- Registry mechanism: `null`
