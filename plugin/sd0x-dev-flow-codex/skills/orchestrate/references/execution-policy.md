# Orchestrate Execution Policy

## Backend and waves

Only Codex collaboration roles named by the typed admission allowlist are eligible. Dependency waves proceed sequentially and independent tasks within one wave proceed concurrently, bounded by the plan budget. No fallback role is inferred when an admitted role is unavailable.

## Fail-closed outcomes

- Missing context: investigate the current request and repository signals, then prepare the supported plan with explicit gaps. Ask only if the remaining ambiguity materially changes the intended outcome; continue independent work.
- A malformed plan or unknown role or skill blocks dispatch, not correction: repair the plan using supported schema values and admitted capabilities, then revalidate before dispatch. Never reinterpret rejected data as an executable instruction or substitute an unadmitted role.
- Repository drift after baseline: stop and report the changed identity; do not restore or refresh the baseline.
- An observation timeout: continue observing the same live worker; do not duplicate it. Confirmed worker failure or unresolved conflicting evidence leaves the step incomplete.
- A proposed mutation: return a handoff to the canonical workflow without dispatching it.
- A review or verification need: name the independent gate without recording or claiming it.

## Evidence limits

Every worker receives only the validator-rendered message for its exact role and step. The message is derived from the objective and plan digests, a closed task operation, concern and selectors, captured redacted source bytes, validated upstream envelopes, and completion data; no free-form question or fetched instruction is appended. Later waves require fingerprinted result envelopes with closed observations and gaps from the current admissible wave, with dependencies and completion criteria enforced. No run state or report is written by this skill.

The read-only baseline now hashes tracked, untracked and ignored file contents, directory nodes, links, modes, Git local metadata/refs/config/stash and worktree registration. Enumeration/read failure refuses certification. Runtime-owned Git metadata, Git object storage, installed dependency directories and the repository-local Codex host home are excluded from this observation; they remain outside worker mutation authority. The 512 MiB byte budget fails closed. Baselines stay in memory, so source-platform disk FIFO cleanup has no native equivalent to perform.
