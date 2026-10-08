# Alias Capability Refresh for Codex 0.160.0

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-10-03
> **Implementation Base SHA**: `6782d7f0e3c38bc48b60b7002dd2343796ef0374`
> **Status**: Candidate Complete
> **Priority**: P0
> **Depends On**: [Previous owner](./2026-09-30-alias-capability-local-runner-refresh.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

<!-- sd0x-alias-capability-owner:v1 {"codex_version":"codex-cli 0.160.0","decision":"mapping-only","registry_mechanism":null,"tested_at":"2026-10-03T00:59:33.561Z","decision_sha256":"2f8e0af623a9159240f56ffd189a5d4f2248b90b905b2369938cec2d53e7673a"} -->

## Background

新會話與本專案 daemon 使用 0.160.0；shell 預設 CLI 指向 0.156.1。以 repository-only 0.160.0 binary 執行 canonical probe，未更動全域安裝。

## Acceptance Criteria

- [x] 真實 schema、explicit/neutral catalogs 與 ephemeral invocation marker 重新取得，fixture ownership cleanup 成功。
- [x] Normalized dump 仍無 automatic exclusion mechanism，維持 mapping-only。
- [x] 新 decision 延續前一 owner 的完整 bytes hash 與 Depends On，歷史紀錄不改寫。

## Progress

Canonical probe exit 0；證據見 migration/evidence/alias-registry-dump.json。此狀態不宣稱本輪完整 v5 遷移或 gates 已完成。

## Version-bound Probe

- Codex version: `codex-cli 0.160.0`
- Tested at: `2026-10-03T00:59:33.561Z`
- Alias decision: `mapping-only`
- Registry mechanism: `null`
