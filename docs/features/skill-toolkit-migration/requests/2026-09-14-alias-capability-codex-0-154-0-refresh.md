# Alias Capability Refresh for Codex 0.154.0

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-09-14
> **Implementation Base SHA**: `95f7106cf87d996d298fca91f65be70472787a08`
> **Status**: Candidate Complete
> **Priority**: P0
> **Depends On**: [Codex 0.153.4 Refresh](./2026-09-05-alias-capability-codex-0-153-4-refresh.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

<!-- sd0x-alias-capability-owner:v1 {"codex_version":"codex-cli 0.154.0","decision":"mapping-only","registry_mechanism":null,"tested_at":"2026-09-14T09:54:17.210Z","decision_sha256":"6268f033d67e2c5ab42a577c8cfcaaf8a8cb07dd672ec6f8dab588f1dc1a918f"} -->

## Background

發布 v0.5.3 前的實測發現主機 CLI 已更新為 0.154.0，既有 0.153.4 證據不再符合版本綁定要求。以 repository-only home 執行 canonical probe，保留其實際 normalized 輸出；舊 owner 原始 bytes 與完整歷史鏈保持不變。

## Requirements

重新驗證目前 registry capability，維持證據的版本綁定與 mapping-only 決策。

## Acceptance Criteria

- [x] 0.154.0 schema 與 explicit／neutral catalogs 由本專案 .codex-dev-home probe 取得。
- [x] Isolated ephemeral read-only invocation 回傳 exact fixture marker。
- [x] 兩份 catalog 均包含 alias，automatic exclusion fields 為空。
- [x] Normalized dump、decision、disposition、initializer 與測試同步版本。
- [x] 保留完整 prior owner chain，新增 0.153.4 owner 原始 bytes hash，直接 Depends On 前任。

## Progress

Probe 已執行並成功清理本次 fixture。Candidate Complete 僅表示 acceptance-ready，不宣稱 review、verify、發布或本 session 的新版 manifest activation。

## References

- [Decision](../../../../migration/alias-capability.json)
- [Normalized dump](../../../../migration/evidence/alias-registry-dump.json)

## Probe identity

- Codex version: `codex-cli 0.154.0`
- Tested at: `2026-09-14T09:54:17.210Z`
- Alias decision: `mapping-only`
- Registry mechanism: `null`
