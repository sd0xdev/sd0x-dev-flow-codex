# Local Runner — verify/fast

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-09-30
> **Implementation Base SHA**: `ef87084bb820cfd036b1537e685b436ea339d860`
> **Status**: Completed
> **Priority**: P1
> **Depends On**: [Previous completed owner](./2026-09-12-behavior-eval-verify-fast-revision.md); [Current default mode](./2026-09-30-local-runner-verify-default-revision.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

依使用者要求移除 bundled MCP，`verify/fast` 改由當前 Codex shell 呼叫本機 allowlisted runner。保留原有 mode、configured primary 與 fingerprint-bound gate 邊界；歷史 owner 與 evidence 保持不變。

## Acceptance Criteria

- [x] 此 unit 的正式 skill 指令使用本機 runner，不需要 bundled MCP tool。
- [x] 原有 mode 與 evidence 邊界保留，routing 與 static preflight 通過。

## Progress

| Phase | Status | Note |
|---|---|---|
| Development | Complete | Native payload `e0a8adc4b72525181f86937b76dc76fbfd264d83d8f50b731f4b7c425a1602e1`. |
| Testing | Complete | Routing and static checks passed. Preflight `f474f1c9835a0afa1a9303a9a4bba1d89bc591f2993c370681ef9ecd9b63238d`. Final audit `f7bfc018a523e83da4ae5eb9168b2dc6e7882748e7c7cbc886e48e9eaa12a1db` passed. |
| Acceptance | Complete | Independent AC verification and runtime-owned durable closure bind this owner. |
