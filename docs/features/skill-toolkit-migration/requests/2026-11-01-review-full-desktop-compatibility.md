# Desktop Review Compatibility — review/full

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-11-01
> **Implementation Base SHA**: `b7d413aac0558f3450b19227b703284c5c69cb6a`
> **Status**: Completed
> **Priority**: P1
> **Depends On**: [Previous durable owner](./2026-10-03-review-full-v5-native-delivery.md); [review/default](./2026-11-01-review-default-desktop-compatibility.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

The user reported legal project switches and a desktop collaboration schema without role selection. The user explicitly approved plugin-bound loading of the configured primary profile. This owner accounts for the shared review payload revision in `review/full`; only default mode writes gates. Historical owner bytes and evidence remain immutable. The compatibility child uses the official profile-load helper; its bounded receipt is the sole runtime write before assessment, and does not pass a gate.

## Acceptance Criteria

- [x] Preserve full as a configured-primary read-only report mode with unchanged routing, subject freshness and no worktree gate writes.
- [x] Carry the shared default-mode compatibility revision without granting full authority to adopt arbitrary task names, old results or unverified profile evidence.

## Related Files and Validation

- `plugin/sd0x-dev-flow-codex/skills/review/references/default.md`
- `plugin/sd0x-dev-flow-codex/skills/review/references/review-theory.md`
- `plugin/sd0x-dev-flow-codex/skills/review/scripts/round.js`
- `test/review-full-routing.test.js`
- `test/collaboration-review.test.js`

Real local desktop roleless/encrypted dispatch, child profile load, terminal ack, import and gate pass were observed before this owner revision. The reporting user's separate host has not been tested directly. Fixture cases cover context switches, inherited fork history, invalid identity, stale rounds, changed profile, encryption delivery and missing ack. Canonical preflight additionally runs this mode's registered routing test. Independent AC verdicts and current-fingerprint gates remain separate obligations.

## Progress

| Phase | Status | Note |
|---|---|---|
| Development | Complete | Native payload `23aff818e00dd0c33215717a9049673d3a3380951714a57aaac2b2d57850e631`. |
| Testing | Complete | Routing and static checks passed. Preflight `11cf34aa2f0c17b877900e7569d479fe5540fb18b1922e91195f9aa6cb143c87`. Final audit `29844e4e1b66da57894e6e032f15c3e4f7f71d1df6e38056308abe86ecd53181` passed. |
| Acceptance | Complete | Independent AC verification and runtime-owned durable closure bind this owner. |
