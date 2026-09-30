# Local Runner Alias Capability Refresh

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-09-30
> **Implementation Base SHA**: `ef87084bb820cfd036b1537e685b436ea339d860`
> **Status**: Candidate Complete
> **Priority**: P1
> **Depends On**: [Previous owner](./2026-09-30-alias-capability-codex-0-159-2-refresh.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

<!-- sd0x-alias-capability-owner:v1 {"codex_version":"codex-cli 0.159.2","decision":"mapping-only","registry_mechanism":null,"tested_at":"2026-09-30T08:49:36.743Z","decision_sha256":"5f7145fbb56fa1c9ad45b06df5c69a7252fa9ac70c8d23d46b0f42bbdcca3342"} -->

## Background

移除 plugin manifest 的 MCP 註冊後，以 repository-only home 實際重跑 canonical alias probe。Normalized registry dump 與既有 evidence 相同，決策仍為 mapping-only；新的 decision 綁定目前 manifest，保留前一 owner 原始 bytes 與完整歷史鏈。

## Acceptance Criteria

- [x] Canonical probe --check 通過；explicit invocation marker 與兩份 catalogs 均符合既有 normalized dump。
- [x] Decision 綁定更新後 plugin manifest；歷史 owner bytes 不變。

## Progress

Probe 與 cleanup 成功。本 ticket 不宣稱 repository gates 或發行已完成。

## Probe identity

- Codex version: `codex-cli 0.159.2`
- Tested at: `2026-09-30T08:49:36.743Z`
- Alias decision: `mapping-only`
- Registry mechanism: `null`
