# sd0x Review Theory

This rubric adapts the reviewer model from `sd0x-dev-flow` to a Codex-hosted,
fingerprint-bound workflow. Review quality comes from independent research and
orthogonal perspectives, not from reviewer count alone.

## Invariants

1. **Independent research, not anchoring.** Give each reviewer the changed-file
   scope, then let it inspect the diff, full files, callers, tests, repository
   guidance, and relevant specifications itself. Never seed one reviewer with
   another reviewer's conclusions.
2. **Change causality plus full context.** Report only defects caused or exposed
   by this worktree, but follow dependencies far enough to prove the runtime
   effect. Evidence may live in unchanged surrounding code.
3. **Orthogonal perspectives.** Claude covers both implementation and tests;
   native Codex reviewers independently emphasize implementation risk and
   test/acceptance adequacy. Their union is the useful result.
4. **Impact-based severity.** Severity describes credible user or engineering
   impact, not reviewer confidence. Unverified suspicions are omitted rather
   than downgraded.
5. **Evidence before judgment.** Every finding must survive the deliberate
   checks below and include a repository-relative file, line, concrete evidence,
   violated invariant or root cause, actionable recommendation, and regression
   protection without exposing secrets.
6. **Convergence is re-observation.** Fixing is not verifying. Any edit changes
   the fingerprint and requires all three perspectives to review again.
7. **Fail closed.** A missing, stale, malformed, cancelled, or failed reviewer
   cannot contribute clean evidence.

## Review Dimensions

Implementation perspective:

- Correctness: logic, boundaries, nullability, type contracts, error handling,
  state transitions, regressions, and data integrity.
- Security: injection, authorization/authentication bypass, sensitive-data
  exposure, unsafe trust boundaries, and other concrete exploit paths.
- Performance and reliability: severe regressions, blocking work, leaks,
  unbounded growth, concurrency races, cancellation, timeouts, and retries.
- Maintainability and testability: actionable design defects such as duplicated
  invariants, hidden coupling, or brittle abstractions that create a credible
  defect risk. Naming or style preferences are not findings.

Test and acceptance perspective:

- Acceptance traceability: when repository requirements or request documents
  exist, connect changed behavior to their concrete acceptance criteria.
- Coverage completeness: changed public behavior, branches, state transitions,
  and regression paths have meaningful assertions.
- Boundaries and errors: empty, missing, extreme, malformed, timeout, permission,
  unavailable-resource, and external-failure cases relevant to the change.
- Concurrency and state: repeated calls, ordering, cancellation, races, and state
  invalidation are covered where applicable.
- Test quality: assertions prove behavior, mocks do not make the test tautological,
  the unit/integration/end-to-end layer matches the risk, and timing/environment
  assumptions do not create avoidable flakiness.

## Deliberate Checks

Before reporting each finding, answer all five:

1. Evidence: what exact repository code or missing behavioral assertion proves it?
2. Context: were the full changed file and relevant callers, dependencies, tests,
   comments, guidance, or specs inspected?
3. False positive: could this be intentional, platform-specific, or already
   protected elsewhere?
4. Severity: what credible impact makes this P0, P1, or P2?
5. Gap: what adjacent branch, failure mode, or acceptance criterion could expose
   the same root cause?

Only findings that survive all five checks are actionable.

## Severity and Gate

- **P0:** credible system outage, data loss/corruption, critical security
  vulnerability, authentication bypass, or similarly catastrophic impact.
- **P1:** functional anomaly, broken acceptance criterion, serious reliability or
  concurrency defect, or severe performance regression.
- **P2:** bounded but real correctness, coverage, performance, maintainability, or
  testability defect with a concrete failure or recurrence risk.
- **Nit:** intentionally excluded. Pure style and preference feedback adds noise.

This Codex-native implementation is deliberately stricter than the source
workflow's merge-ready sentinel: every P0/P1/P2 blocks until fixed and re-reviewed.
All three perspectives are blocking; there is no degraded pass. Re-review starts
with a fresh full scan on the new fingerprint. A reviewer may receive only its own
prior finding identities as non-authoritative hypotheses so it can verify the
root-cause fix without being anchored by another perspective.
