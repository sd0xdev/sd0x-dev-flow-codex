---
name: seek-verdict
description: "Route seek-verdict using exact migration registry [{\"unit\":\"seek-verdict/default\",\"routing\":{\"positive_triggers\":[\"Get an independent verdict on whether this review finding is valid.\",\"Seek a blind second opinion on this suspected security issue.\",\"Verify whether dismissing this defect is justified using fresh context.\"],\"negative_boundaries\":[\"Fix the defect after assessing it.\",\"Post the verdict to the pull request.\",\"Run the primary code review for the entire dirty worktree.\"]}}]."
---

# Independent Verdict

Obtain a blind, evidence-backed second opinion on a bounded finding while preserving source origin, severity policy, fresh context, and worktree identity.

## Verdict protocol

[Read the deterministic verdict-state helper](scripts/verdict-state.js).

1. Package the claim, origin, affected paths, severity assertion, current commit, relevant diff, and neutral verification question. Exclude the requesting analyst's conclusion.
2. Capture `finding_key + worktree fingerprint + intent`, branch, session, and sorted dismissal records `{evidence_id, binding_hash}`. Hash that exact array. The independent verifier supplies a separate trusted registry keyed by `evidence_id`, with closed `{binding_hash, independence_key, source_id}` records; one `source_id` must map to exactly one independence key, one binding hash cannot identify multiple evidence records, caller-provided independence labels are impossible, binding mismatch fails, and multiple artifacts sharing one trusted source/verifier key count once. Hash the exact registry subset used by the dismissal. Any file, index, commit, branch, session, registry identity, or relevant-evidence change invalidates the verdict.
3. Select the opposite model in a fresh context: a Claude-origin finding goes to native Codex, a native-Codex finding goes to the configured Claude adapter, and a user finding goes to an uninvolved model or both independently when origin is uncertain. Missing opposite-model capability is inconclusive; one model may not impersonate both roles.
4. Apply the exact asymmetric thresholds and state transitions below. A review, test, security, user, or automation finding keeps its original policy obligations.
5. Permit at most one verifier attempt for each `finding_key + fingerprint + intent` and at most one objective rebuttal in that verdict context. New evidence appends the audit trail but cannot reopen a consumed intent.
6. Counter persistence is limited to Git metadata or the .sd0x directory, never tracked payload. Persist each complete load/evaluate/save or load/confirm/save transition under one state lock with a monotonic expected-version check; a stale writer fails and must retry from fresh state. Inconclusive evidence keeps the gate failed.

## Thresholds and state

| Severity | Confirm | Dismiss | Human gate |
|---|---|---|---|
| P2 | confidence ≥ 0.70 and 1 concrete evidence | confidence ≥ 0.85 and 2 independent evidence | none |
| P1 | confidence ≥ 0.65 and 1 evidence | confidence ≥ 0.90 and 3 independent evidence | explicit confirmation on a later user turn |
| P0 | confidence ≥ 0.60 and 1 evidence | confidence ≥ 0.95 and 4 independent evidence | explicit confirmation on a later user turn |
| Nit | confidence ≥ 0.70 and 1 evidence | confidence ≥ 0.70 and 1 independent evidence | none |

Transitions are `ACTIVE --confirm threshold→ CONFIRMED`, `ACTIVE --P2 dismiss threshold→ DISMISS_VERIFIED`, `ACTIVE --P0/P1 dismiss threshold→ DISMISS_CANDIDATE`, and insufficient/conflicting evidence to `UNRESOLVED`. Three consecutive distinct-finding `DISMISS_VERIFIED` results in the same session, branch, and fingerprint raise later dismiss confidence by 0.05 up to 0.99 and evidence by one; confirm, unresolved, or identity drift resets the streak.

A P0/P1 candidate binds `finding_key + fingerprint + dismissal_evidence_hash` plus the sorted evidence IDs and exact trusted-registry-subset hash, and expires when the first subsequent user turn begins. The confirmation handler must consume that turn before any new verdict evaluation and must revalidate the same trusted registry subset; evaluating another finding, rejection, ambiguity, skipped confirmation, registry drift, or fingerprint drift clears the candidate and returns it to `ACTIVE`. Only explicit confirmation of that same binding reaches `DISMISS_VERIFIED`. Only a new fingerprint reopens a consumed confirm/dismiss intent; clarification uses an unconsumed `clarify` intent.

This workflow is read-only. Do not fix code, record gate state, post externally, or substitute the verdict for the primary review process.

## Output

Return fingerprint, neutral claim, evidence inspected, verdict, confidence, origin-aware policy mapping, unresolved risks, and required human decision.

## Pack handoff

This repository payload is research-pack-ready source material only. It remains outside the core plugin manifest and live skill discovery, and it is not released here. A later separate-plugin repository must provide its own manifest, dependency declaration, installation tests, fingerprint-bound review and verification gates, and release authorization.

<!-- sd0x-active-semantic-contract:v1 unit=seek-verdict/default -->
Normative semantic requirements:
- A P0/P1 candidate binds `finding_key + fingerprint + dismissal_evidence_hash`
- Counter persistence is limited to Git metadata or the .sd0x directory
- confidence ≥ 0.95 and 4 independent evidence
- one model may not impersonate both roles
<!-- sd0x-active-semantic-contract:end -->

<!-- sd0x-semantic-contract:v1 unit=seek-verdict/default -->
```json
{
  "required": [
    "A P0/P1 candidate binds `finding_key + fingerprint + dismissal_evidence_hash`",
    "Counter persistence is limited to Git metadata or the .sd0x directory",
    "confidence ≥ 0.95 and 4 independent evidence",
    "one model may not impersonate both roles"
  ],
  "forbidden": []
}
```

<!-- sd0x-routing-contract:v1 unit=seek-verdict/default -->
```json
{
  "positive_triggers": [
    "Get an independent verdict on whether this review finding is valid.",
    "Seek a blind second opinion on this suspected security issue.",
    "Verify whether dismissing this defect is justified using fresh context."
  ],
  "negative_boundaries": [
    "Fix the defect after assessing it.",
    "Post the verdict to the pull request.",
    "Run the primary code review for the entire dirty worktree."
  ]
}
```
