# Desktop Review Compatibility — review/default

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-11-01
> **Implementation Base SHA**: `b7d413aac0558f3450b19227b703284c5c69cb6a`
> **Status**: Completed
> **Priority**: P1
> **Depends On**: [Previous durable owner](./2026-10-03-review-default-v5-native-delivery.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

The user reported legal project switches and a desktop collaboration schema without role selection. The user explicitly approved plugin-bound loading of the configured primary profile. This owner accounts for the shared review payload revision in `review/default`; only default mode writes gates. Historical owner bytes and evidence remain immutable. The compatibility child uses the official profile-load helper; its bounded receipt is the sole runtime write before assessment, and does not pass a gate.

## Acceptance Criteria

- [x] Support legal same-chat project switching and full-history child contexts using current host evidence while rejecting caller-only or conflicting project identity.
- [x] Support explicit plugin-bound configured-primary loading on roleless/encrypted hosts while preserving fingerprint, direct-child, round, receipt, terminal, profile integrity and review-before-verification gates.

## Related Files and Validation

- `plugin/sd0x-dev-flow-codex/skills/review/references/default.md`
- `plugin/sd0x-dev-flow-codex/skills/review/references/review-theory.md`
- `plugin/sd0x-dev-flow-codex/skills/review/scripts/round.js`
- `test/review-default-routing.test.js`
- `test/collaboration-review.test.js`

Real local desktop roleless/encrypted dispatch, child profile load, terminal ack, import and gate pass were observed before this owner revision. The reporting user's separate host has not been tested directly. Fixture cases cover context switches, inherited fork history, invalid identity, stale rounds, changed profile, encryption delivery and missing ack. Canonical preflight additionally runs this mode's registered routing test. Independent AC verdicts and current-fingerprint gates remain separate obligations.

## Progress

| Phase | Status | Note |
|---|---|---|
| Development | Complete | Native payload `23aff818e00dd0c33215717a9049673d3a3380951714a57aaac2b2d57850e631`. |
| Testing | Complete | Routing and static checks passed. Preflight `40061787c35b0d2a67236b1709a7ef9fa2eb7e54eea123a52999594993050f36`. Final audit `7446bd0c271948f90456262fd87414885335120725525cc7cdb701c986930ed0` passed. |
| Acceptance | Complete | Independent AC verification and runtime-owned durable closure bind this owner. |
