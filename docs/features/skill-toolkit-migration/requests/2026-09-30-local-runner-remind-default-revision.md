# Local Runner — remind/default

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-09-30
> **Implementation Base SHA**: `ef87084bb820cfd036b1537e685b436ea339d860`
> **Status**: Completed
> **Priority**: P1
> **Depends On**: [Previous completed owner](./2026-09-06-model-trust-remind-default-revision.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

依使用者要求移除 bundled MCP，`remind/default` 改由當前 Codex shell 呼叫本機 allowlisted runner。保留原有 mode、configured primary 與 fingerprint-bound gate 邊界；歷史 owner 與 evidence 保持不變。

## Acceptance Criteria

- [x] 此 unit 的正式 skill 指令使用本機 runner，不需要 bundled MCP tool。
- [x] 原有 mode 與 evidence 邊界保留，routing 與 static preflight 通過。

## Progress

| Phase | Status | Note |
|---|---|---|
| Development | Complete | Native payload `0200e52facdfb91e082149e9609a9b10b8eb6eaeedebcb6c5c841b48eface3fa`. |
| Testing | Complete | Routing and static checks passed. Preflight `533742994748ab2f02e98de6e77c3cdc244721dcad53164bb34e1f2493edaea7`. Final audit `53db6f39d266efda4ba4eee2993c6e90de4f59be15b9dcb8ac06de8ecd409ace` passed. |
| Acceptance | Complete | Independent AC verification and runtime-owned durable closure bind this owner. |
