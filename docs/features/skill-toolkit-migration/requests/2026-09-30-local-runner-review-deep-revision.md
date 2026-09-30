# Local Runner — review/deep

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-09-30
> **Implementation Base SHA**: `ef87084bb820cfd036b1537e685b436ea339d860`
> **Status**: Completed
> **Priority**: P1
> **Depends On**: [Previous completed owner](./2026-09-12-behavior-eval-review-deep-revision.md); [Current default mode](./2026-09-30-local-runner-review-default-revision.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

依使用者要求移除 bundled MCP，`review/deep` 改由當前 Codex shell 呼叫本機 allowlisted runner。保留原有 mode、configured primary 與 fingerprint-bound gate 邊界；歷史 owner 與 evidence 保持不變。

## Acceptance Criteria

- [x] 此 unit 的正式 skill 指令使用本機 runner，不需要 bundled MCP tool。
- [x] 原有 mode 與 evidence 邊界保留，routing 與 static preflight 通過。

## Progress

| Phase | Status | Note |
|---|---|---|
| Development | Complete | Native payload `bda5f3af4cd2b4bff03a68e3a8b5412eac99026766fa7f035ac93d965081a5e9`. |
| Testing | Complete | Routing and static checks passed. Preflight `6de45fe351a3217fce72736da0e326577d2d7a1a5abfe0b3482dfaebcc6b8ae7`. Final audit `63009dd648fe300634a482327c2fc94e8aabdb7ee5f07161863b284a4655de29` passed. |
| Acceptance | Complete | Independent AC verification and runtime-owned durable closure bind this owner. |
