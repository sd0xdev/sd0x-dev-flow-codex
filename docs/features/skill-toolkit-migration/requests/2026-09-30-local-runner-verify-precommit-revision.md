# Local Runner — verify/precommit

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-09-30
> **Implementation Base SHA**: `ef87084bb820cfd036b1537e685b436ea339d860`
> **Status**: Completed
> **Priority**: P1
> **Depends On**: [Previous completed owner](./2026-09-12-behavior-eval-verify-precommit-revision.md); [Current default mode](./2026-09-30-local-runner-verify-default-revision.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

依使用者要求移除 bundled MCP，`verify/precommit` 改由當前 Codex shell 呼叫本機 allowlisted runner。保留原有 mode、configured primary 與 fingerprint-bound gate 邊界；歷史 owner 與 evidence 保持不變。

## Acceptance Criteria

- [x] 此 unit 的正式 skill 指令使用本機 runner，不需要 bundled MCP tool。
- [x] 原有 mode 與 evidence 邊界保留，routing 與 static preflight 通過。

## Progress

| Phase | Status | Note |
|---|---|---|
| Development | Complete | Native payload `e0a8adc4b72525181f86937b76dc76fbfd264d83d8f50b731f4b7c425a1602e1`. |
| Testing | Complete | Routing and static checks passed. Preflight `d223dc75387adf937d030e6833b2b5b26d95210468153b89be3a0c36e0086550`. Final audit `d5cbbcd362d03de4aea5f64355efb7a59ec9b0e76a8597a63a0a02990c55efd6` passed. |
| Acceptance | Complete | Independent AC verification and runtime-owned durable closure bind this owner. |
