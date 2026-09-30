# Local Runner — setup/hooks

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-09-30
> **Implementation Base SHA**: `ef87084bb820cfd036b1537e685b436ea339d860`
> **Status**: Completed
> **Priority**: P1
> **Depends On**: [Previous completed owner](./2026-09-06-model-trust-setup-hooks-revision.md); [Current default mode](./2026-09-30-local-runner-setup-default-revision.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

依使用者要求移除 bundled MCP，`setup/hooks` 改由當前 Codex shell 呼叫本機 allowlisted runner。保留原有 mode、configured primary 與 fingerprint-bound gate 邊界；歷史 owner 與 evidence 保持不變。

## Acceptance Criteria

- [x] 此 unit 的正式 skill 指令使用本機 runner，不需要 bundled MCP tool。
- [x] 原有 mode 與 evidence 邊界保留，routing 與 static preflight 通過。

## Progress

| Phase | Status | Note |
|---|---|---|
| Development | Complete | Native payload `5fc0bd35ec4d174d8bb326e9e41b3fc614311e226d9e271a2ce66d1d93df7a5a`. |
| Testing | Complete | Routing and static checks passed. Preflight `7ae4dbb29712b12445aff214000bf0d81cfde2ce117586497f7c2eba43f39fcc`. Final audit `78d6002a4746258f9ccb0a58c9441c9c35032de39ba8f87aa2d8f26ad17418e5` passed. |
| Acceptance | Complete | Independent AC verification and runtime-owned durable closure bind this owner. |
