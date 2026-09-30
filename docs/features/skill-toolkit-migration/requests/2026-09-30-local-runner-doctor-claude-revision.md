# Local Runner — doctor/claude

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-09-30
> **Implementation Base SHA**: `ef87084bb820cfd036b1537e685b436ea339d860`
> **Status**: Completed
> **Priority**: P1
> **Depends On**: [Previous completed owner](./2026-09-07-remove-claude-mcp-doctor-revision.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

依使用者要求移除 bundled MCP，`doctor/claude` 改由當前 Codex shell 呼叫本機 allowlisted runner。保留原有 mode、configured primary 與 fingerprint-bound gate 邊界；歷史 owner 與 evidence 保持不變。

## Acceptance Criteria

- [x] 此 unit 的正式 skill 指令使用本機 runner，不需要 bundled MCP tool。
- [x] 原有 mode 與 evidence 邊界保留，routing 與 static preflight 通過。

## Progress

| Phase | Status | Note |
|---|---|---|
| Development | Complete | Native payload `7d42cb7a8941801b874775d9e4b012954926a99659f0977a70d1cbe019689e5e`. |
| Testing | Complete | Routing and static checks passed. Preflight `03b2cfaa63c1a514c4d1c51e30a371459cb32fbb74b08fb3277890075d5f19c0`. Final audit `5388856e075969fa0e4cea9042efe1e34d58b3921c24b3512205000042454efa` passed. |
| Acceptance | Complete | Independent AC verification and runtime-owned durable closure bind this owner. |
