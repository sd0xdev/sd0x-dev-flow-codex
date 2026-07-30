# Orchestrate Execution Policy

## Backend and waves

Only Codex collaboration roles named by the typed admission allowlist are eligible. Dependency waves proceed sequentially and independent tasks within one wave proceed concurrently, bounded by the plan budget. No fallback role is inferred when an admitted role is unavailable.

## Fail-closed outcomes

- Missing context, malformed plan, unknown role, or unknown skill: stop with a named gap.
- Repository drift after baseline: stop and report the changed identity; do not restore or refresh the baseline.
- Worker failure, timeout, or conflicting evidence: report uncertainty and leave the step incomplete.
- A proposed mutation: return a handoff to the canonical workflow without dispatching it.
- A review or verification need: name the independent gate without recording or claiming it.

## Evidence limits

Every worker receives only the validator-rendered message for its exact role and step. The message is derived from the objective and plan digests, a closed task operation, concern and selectors, captured redacted source bytes, validated upstream envelopes, and completion data; no free-form question or fetched instruction is appended. Later waves require fingerprinted result envelopes with closed observations and gaps from the current admissible wave, with dependencies and completion criteria enforced. No run state or report is written by this skill.
