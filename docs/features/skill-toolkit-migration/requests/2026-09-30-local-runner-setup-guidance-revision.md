# Local Runner — setup/guidance

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-09-30
> **Implementation Base SHA**: `ef87084bb820cfd036b1537e685b436ea339d860`
> **Status**: Completed
> **Priority**: P1
> **Depends On**: [Previous completed owner](./2026-09-06-model-trust-setup-guidance-revision.md); [Current default mode](./2026-09-30-local-runner-setup-default-revision.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

依使用者要求移除 bundled MCP，`setup/guidance` 改由當前 Codex shell 呼叫本機 allowlisted runner。保留原有 mode、configured primary 與 fingerprint-bound gate 邊界；歷史 owner 與 evidence 保持不變。

## Acceptance Criteria

- [x] 此 unit 的正式 skill 指令使用本機 runner，不需要 bundled MCP tool。
- [x] 原有 mode 與 evidence 邊界保留，routing 與 static preflight 通過。

## Progress

| Phase | Status | Note |
|---|---|---|
| Development | Complete | Native payload `5fc0bd35ec4d174d8bb326e9e41b3fc614311e226d9e271a2ce66d1d93df7a5a`. |
| Testing | Complete | Routing and static checks passed. Preflight `2af4d318b61f51691ecdd5adbebbf6440bfc08262922b7262a6417bcb47f5896`. Final audit `5d02d59509f4c11caf4fe740afcc31deac508bcd655e45767d4cc613042728f8` passed. |
| Acceptance | Complete | Independent AC verification and runtime-owned durable closure bind this owner. |
