# Alias Capability Refresh for Codex 0.161.0

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-10-08
> **Implementation Base SHA**: `6782d7f0e3c38bc48b60b7002dd2343796ef0374`
> **Status**: Candidate Complete
> **Priority**: P1
> **Depends On**: [Previous owner](./2026-10-03-alias-capability-codex-0-160-0-refresh.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

<!-- sd0x-alias-capability-owner:v1 {"codex_version":"codex-cli 0.161.0","decision":"mapping-only","registry_mechanism":null,"tested_at":"2026-10-08T04:21:19.791Z","decision_sha256":"7a01954e835fb0f32dceefaa6b016bfe3c226142db2cfdbf70aa30b94d0d1d20"} -->

## Background

0.5.5 發布續接使用 repository-only Codex 0.161.0。正式 verifier 拒絕仍綁定 0.160.0 的 alias evidence，因此依既有 canonical probe 更新目前版本的實測紀錄；前任 owner 的 bytes 與所有歷史 evidence 保留。

## Acceptance Criteria

- [x] 以 repository-only 0.161.0 執行 canonical probe，取得 schema、explicit/neutral catalogs 與 ephemeral invocation marker，fixture cleanup 成功。
- [x] 新 registry dump 沒有 automatic exclusion mechanism，維持 mapping-only。
- [x] 新 decision 延續前任 owner 完整 bytes hash 與 Depends On，歷史 owner 不改寫。

## Progress

`node scripts/probe-alias-capability.js` exit 0；normalized evidence 位於 `migration/evidence/alias-registry-dump.json`。此狀態只記錄版本綁定 probe，不宣稱正式 review、完整 verifier 或 GitHub 發布完成。

## Version-bound Probe

- Codex version: `codex-cli 0.161.0`
- Tested at: `2026-10-08T04:21:19.791Z`
- Alias decision: `mapping-only`
- Registry mechanism: `null`
