# sd0x Review Theory

The configured Codex primary provides independent judgment over the complete
changed-file set and its behavioral effects. The reviewer chooses how much
context and which evidence are needed; an implementer's conclusions or a prior
clean verdict cannot establish correctness at the current fingerprint.

## Review Contract

- Cover implementation, security, reliability, tests, and acceptance criteria
  relevant to the selected change. Where requirements or request documents exist,
  trace changed behavior and its tests to their concrete acceptance criteria.
- Report defects caused or exposed by the selected subject. Inspect surrounding code and dependencies to establish or refute a concrete failure. Evidence may come from unchanged code.
- Findings need repository-relative file and line evidence, a concrete failure or
  violated invariant, impact-based severity, an actionable recommendation, and
  recurrence protection. Do not expose secrets. Protection can be an existing
  control; it does not require another guard artifact.
- Any edit requires the configured primary to review the new fingerprint before
  deterministic verification. Re-evaluate the entire current changed set and fix
  impacts; valid contextual knowledge may be reused, stale verdicts may not.
  Prior finding identities are hypotheses to check, not authoritative conclusions.
- Only runtime-recorded evidence from the configured primary can pass review.
  Missing, stale, malformed, cancelled, or failed reviewer evidence cannot pass.
  Runtime epoch and fingerprint changes invalidate evidence. No substitute
  reviewer, parent summary, or degraded pass satisfies the gate.

## Evidence and Severity

An actionable finding demonstrates a real failure on the selected subject's
behavioral path. Its evidence accounts for the relevant surrounding contracts,
intentional platform behavior, and existing protections. Unverified suspicions
are omitted, not assigned a lower severity.

| Severity | Credible impact |
| --- | --- |
| P0 | System outage, data loss/corruption, critical security vulnerability, authentication bypass, or similarly catastrophic impact. |
| P1 | Functional anomaly, broken acceptance criterion, serious reliability or concurrency defect, or severe performance regression. |
| P2 | Bounded but real correctness, coverage, performance, maintainability, or testability defect with a concrete failure or recurrence risk. |
| Nit | Style and preference feedback; excluded from findings. |

Every P0/P1/P2 finding blocks until fixed and re-reviewed. Normalize and
deduplicate by canonical issue while retaining the strongest severity and source
attribution. The terminal clean output is exactly `No actionable findings remain.`;
this is a parser interface, not a general prose convention. The optional
`test-review` skill is a separate read-only assessment with no gate authority.

## Behavioral Coverage

Coverage is an outcome, not a fixed reading sequence. Assess affected behavior across all changed files, including relevant boundaries, state
transitions, failure paths, security and data-integrity invariants, concurrency,
and performance or reliability regressions. Inspect surrounding code, guidance,
and specifications where they change that assessment.

Tests should demonstrate the changed behavior and acceptance criteria with
meaningful assertions. Consider relevant malformed input, unavailable resources,
permissions, cancellation, ordering, or repeated-call cases. Assess whether mocks,
timing assumptions, or test-layer choices hide a credible defect. Naming and
style preferences are not findings; maintainability concerns need a concrete
failure or recurrence risk.

## Assurance Boundary

Review material defects. A representative accepting and rejecting case through
the actual runtime path establishes a property's ordinary assurance boundary.
Further hardening needs an unmet acceptance criterion, a security/data-integrity
invariant, or a concrete counterexample showing that existing evidence misses a
real defect. Hypothetical attacks on a test's own guard strength are not P2
findings merely because another layer could be added. This boundary never
dismisses a demonstrated P0/P1/P2 defect or weakens a gate.

Stop expanding a dependency path once its contract and protections settle the
question. This does not omit changed files or lower acceptance/test scrutiny.
Unrelated pre-existing improvements may be recorded separately.

Prefer existing regression coverage and observable outcomes over redundant
assertions that pin wording, helper names, or another test's source text. Preserve
routing/schema contracts and real refusal/acceptance cases at trust boundaries.
Do not introduce meta-tests solely to enforce this rubric.

## Dispatch and Recovery

The primary uses the current parent model and reasoning effort by default. Its
profile pins neither value; host dispatch must preserve both unless the user
explicitly overrides them. Host permission overrides do not authorize reviewer
writes. Historical Claude evidence is immutable provenance only and has no
current gate authority.

The review skill owns the evidence-sensitive wrapper order and host lifecycle
requirements. A transport observation timeout does not prove that a running
reviewer failed. Observe the same live work until terminal evidence or confirmed
unavailability establishes the next action.

Keep dispatch grounded in the original task, comparison baseline, acceptance
criteria, user-supplied focus, current fingerprint, changed paths, and this review
contract. Do not progressively add implementer-authored attack lists or stronger
guard demands between rounds. The primary judges independently.

When fixes stop improving the result, diagnose the concrete obstacle and choose
a bounded adjustment based on observed evidence. Record the cause, adjustment,
and outcome so that the next round can use what was learned. Repeating an
unsuccessful adjustment, adding a round cap, automatically committing/stashing,
replacing the reviewer, or clearing an aged ledger does not resolve the obstacle.

A failed reviewer ledger at the same fingerprint requires formal reset before a
retry. Existing explicit user authorization, including ongoing authorization for
this recovery, is sufficient; ask only when authority is absent. Reset never
passes a gate. Corrupt runtime state is quarantined and requires the new
session activation reported by reset. Fixing remains separate from verification:
completion requires current configured-primary review followed by deterministic
verification at that same fingerprint.

## Source and Research Context

This Codex-hosted contract adapts `sd0x-dev-flow`'s independent review,
acceptance traceability, root-cause repair, and evidence-based convergence. It
uses one configured primary covering implementation and tests. Unlike the source
workflow's merge-ready sentinel, all P0/P1/P2 findings block, and there is no
fixed round cap or stale-verdict shortcut.

The bounded-assurance and rules-residency direction comes from sd0x-harness v4.4
(`c087245` and `add1f9c`).
[IFScale](https://arxiv.org/abs/2507.11538) measures instruction-density effects
on a keyword-following benchmark; [Chroma's context-rot report](https://www.trychroma.com/research/context-rot)
measures context-length and distractor effects;
[Vercel's evaluation](https://vercel.com/blog/agents-md-outperforms-skills-in-our-agent-evals)
compares documentation delivery in its own Next.js tasks. They motivate concise
contracts and accessible references, but do not establish this repository's
defect-detection rate or justify relaxing its evidence anchors.
