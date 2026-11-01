# Desktop Review Compatibility — review/branch

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-11-01
> **Implementation Base SHA**: `b7d413aac0558f3450b19227b703284c5c69cb6a`
> **Status**: Completed
> **Priority**: P1
> **Depends On**: [Previous durable owner](./2026-10-03-review-branch-v5-native-delivery.md); [review/default](./2026-11-01-review-default-desktop-compatibility.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

The user reported legal project switches and a desktop collaboration schema without role selection. The user explicitly approved plugin-bound loading of the configured primary profile. This owner accounts for the shared review payload revision in `review/branch`; only default mode writes gates. Historical owner bytes and evidence remain immutable. The compatibility child uses the official profile-load helper; its bounded receipt is the sole runtime write before assessment, and does not pass a gate.

## Acceptance Criteria

- [x] Preserve branch as a configured-primary read-only report mode with unchanged routing, subject freshness and no worktree gate writes.
- [x] Carry the shared default-mode compatibility revision without granting branch authority to adopt arbitrary task names, old results or unverified profile evidence.

## Related Files and Validation

- `plugin/sd0x-dev-flow-codex/skills/review/references/default.md`
- `plugin/sd0x-dev-flow-codex/skills/review/references/review-theory.md`
- `plugin/sd0x-dev-flow-codex/skills/review/scripts/round.js`
- `test/review-branch-routing.test.js`
- `test/collaboration-review.test.js`

Real local desktop roleless/encrypted dispatch, child profile load, terminal ack, import and gate pass were observed before this owner revision. The reporting user's separate host has not been tested directly. Fixture cases cover context switches, inherited fork history, invalid identity, stale rounds, changed profile, encryption delivery and missing ack. Canonical preflight additionally runs this mode's registered routing test. Independent AC verdicts and current-fingerprint gates remain separate obligations.

## Progress

| Phase | Status | Note |
|---|---|---|
| Development | Complete | Native payload `23aff818e00dd0c33215717a9049673d3a3380951714a57aaac2b2d57850e631`. |
| Testing | Complete | Routing and static checks passed. Preflight `29f6ec85e5ab0bb7202a4c2b96749e0f4beec3119257b24fa2f082ece19277c7`. Final audit `66487822ca86a60cb27ba9a0367a62b60a94d593be422f37e83e07b6ed799a77` passed. |
| Acceptance | Complete | Independent AC verification and runtime-owned durable closure bind this owner. |
