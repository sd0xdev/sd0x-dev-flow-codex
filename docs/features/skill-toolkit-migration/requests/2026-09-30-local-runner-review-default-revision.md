# Local Runner — review/default

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-09-30
> **Implementation Base SHA**: `ef87084bb820cfd036b1537e685b436ea339d860`
> **Status**: Completed
> **Priority**: P1
> **Depends On**: [Previous completed owner](./2026-09-12-behavior-eval-review-default-revision.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

依使用者要求移除 bundled MCP，`review/default` 改由當前 Codex shell 呼叫本機 allowlisted runner。保留原有 mode、configured primary 與 fingerprint-bound gate 邊界；歷史 owner 與 evidence 保持不變。

## Acceptance Criteria

- [x] 此 unit 的正式 skill 指令使用本機 runner，不需要 bundled MCP tool。
- [x] 原有 mode 與 evidence 邊界保留，routing 與 static preflight 通過。

## Progress

| Phase | Status | Note |
|---|---|---|
| Development | Complete | Native payload `bda5f3af4cd2b4bff03a68e3a8b5412eac99026766fa7f035ac93d965081a5e9`. |
| Testing | Complete | Routing and static checks passed. Preflight `6635036df8b9dd295c0cff6900e3a99d30f5707db7fd7b17dd7a4dfda8288152`. Final audit `b5fd6e729c00094e9b898b4e489015300c46a53f0fbf01c27d4fdbe7588e20c1` passed. |
| Acceptance | Complete | Independent AC verification and runtime-owned durable closure bind this owner. |
