# Close the Review Gate

1. Resolve the repository root. Read the [review theory](review-theory.md); it defines independent judgment, behavioral coverage, actionable evidence, and severity. The deterministic [provider](../scripts/provider.js), [snapshot](../scripts/snapshot.js), [round](../scripts/round.js), and [gate](../scripts/gate.js) wrappers implement the workflow. Resolve `<plugin-root>` as two directories above this skill's installed directory, from the current `SKILL.md` location. The current Codex shell supplies `CODEX_HOME` and `CODEX_THREAD_ID` for this task. The runner returns JSON with `exit_code`, `stdout`, and `stderr`; parse the script's JSON from `stdout` and respect failures. Required ordered invocations:

`node "<plugin-root>/scripts/runtime/runner.js" '{"entrypoint":"review/provider.js","cwd":"<repository-root>","args":[]}'`

`node "<plugin-root>/scripts/runtime/runner.js" '{"entrypoint":"review/snapshot.js","cwd":"<repository-root>","args":[]}'`

Parse and retain the configured provider, primary agent, root, fingerprint, and changed files. Stop if the worktree is clean. Immediately before dispatch, run:

`node "<plugin-root>/scripts/runtime/runner.js" '{"entrypoint":"review/round.js","cwd":"<repository-root>","args":["begin"]}'`

On Codex surfaces with persistent collaboration agents, the round wrapper records a fingerprint-bound transcript boundary for the explicit Codex JSONL adapter. If `spawn_agent` has no `agent_type` and the host cannot authenticate a configured role, set the runner args to `["begin","--profile-dispatch"]` instead. This explicit compatibility transport loads the project's unchanged managed read-only primary profile and review theory before the round, binds their hashes and the exact message to its fingerprint/round, and returns `dispatch`. The `collaboration.spawn_agent` tool receives exactly those arguments, including full-history inheritance; do not add overrides, shorten the message or substitute a task name. Import still requires the matching fresh direct child metadata, host receipt and terminal. It does not adopt old unnamed reviews or overwrite custom profiles. If profile preparation fails, use native configured dispatch after restoring host discovery; do not invent a profile or clear evidence to force progress.

The compatibility reviewer must first execute the prepared `profile-load` command in its own child shell. This owning helper loads the actual configured instructions and theory, records a bounded receipt for that child/round, and returns `terminal_suffix`. The reviewer reads those instructions and appends that suffix to its terminal verdict (before a commit-subject suffix, when present). This is its sole permitted runtime write, through the official helper; it never sets a gate. Hosts that encrypt spawn text are supported by validating the host's matching encrypted NEW_TASK delivery plus this independent profile load and ack. Ciphertext equality alone does not prove the profile. Missing/changed load, wrong child/round or missing ack refuses import; never decrypt opaque host content or replace it with parent claims.

If neither supported adapter is available, each round requires a fresh native configured subagent with authoritative native start and terminal lifecycle evidence. Following up with a completed agent does not emit a new native start and cannot establish that round's evidence.
2. Dispatch exactly one `sd0x_codex_primary_reviewer` against the fingerprint-bound snapshot. Its project profile is read-only and omits model/effort pins. The default is the **current parent session's model and reasoning effort**, including live session changes, not a fixed plugin model or a guessed config-file default.
   - On a collaboration surface whose full-history fork guarantees parent model/effort inheritance, use that fork without model overrides.
   - On a native custom-agent surface, unset profile values inherit through the host. If `[agents]` defaults would override the parent, pass both actual current parent settings explicitly. An explicit user reviewer override takes precedence; never silently lower effort or switch models.
   - The profile-bound compatibility transport instantiates the configured primary through the plugin's verified instructions when the host exposes only an untyped child. Host-role selection and plugin-bound profile selection are distinct evidence sources; both must preserve parent settings and read-only review. Without either authenticated path, report reviewer unavailability. Parent prose never substitutes for terminal evidence.
   - The reviewer performs no repository-content mutations even when the parent's live permission mode is permissive. Only the compatibility profile-load helper may write its bounded load receipt. `sandbox_mode = "read-only"` remains the profile default; host permission overrides are not proof that writes are impossible.
3. Observe the dispatched primary until it produces a terminal result or authoritative evidence establishes failure. An observation timeout is not reviewer failure: continue observing the same live agent or runner session; do not restart, replace, or reset it merely because a polling call timed out. It must return an explicit terminal result; a lifecycle start and end without final assistant output does not count. When clean, the reviewer returns exactly `No actionable findings remain.` Before recording a pass, run:

`node "<plugin-root>/scripts/runtime/runner.js" '{"entrypoint":"review/round.js","cwd":"<repository-root>","args":["import"]}'`

The local runner executes only allowlisted deterministic scripts. The configured native Codex subagent performs review. The passing gate wrapper rescans from the original boundary and finalizes the marker. Only exact direct reviewer paths and terminal messages after the recorded boundary count for the unchanged fingerprint and runtime epoch.
4. Findings must meet the theory's evidence and assurance criteria. Normalize them to `[P0|P1|P2] file:line description → root cause → recommendation → regression protection`. Deduplicate by canonical issue rather than incidental line drift, preserving the highest severity and source attribution.
5. Aggregate only discrete actionable findings with file and line evidence. Any P0, P1, or P2 finding blocks this strict gate.
6. If findings exist, record failure and address their root causes with appropriate recurrence protection. Fixes create a new fingerprint, invalidate the prior result, and require a new round from step 1. If the reviewer is confirmed unavailable, cancelled, or terminal without final output, record failure; do not replace or retry that reviewer type on the same fingerprint without a user-authorized reset. Existing explicit reset authorization, including ongoing authorization covering this recovery, suffices; ask only when that authority is absent. After the formal reset, restart from step 1. A genuine implementation change also requires a fresh round; do not manufacture edits to evade the ledger.
7. Record pass only when the configured primary reviewer reports no actionable findings for the same fingerprint.

Record failure with compact JSON evidence:

`node "<plugin-root>/scripts/runtime/runner.js" '{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["fail","--evidence","{\"provider\":\"<provider>\",\"reviewers\":1,\"agents\":[\"<primary-agent>\"],\"findings\":1,\"summary\":\"actionable findings or reviewer failure remain\"}"]}'`

For unavailable reviewer infrastructure, record `findings: 0` and `reviewer_failure: true`. This keeps the gate failed while allowing the review lifecycle to yield. On the same fingerprint, use the reset skill under existing explicit authorization before retrying; request authorization only if none covers this recovery. Restoring reviewer identities may additionally require a new Codex task, but process restart alone does not clear the failed gate or stale ledger. Corrupt-state quarantine requires the new session activation reported by reset.

Record pass only after all provider-plan evidence has been observed:

`node "<plugin-root>/scripts/runtime/runner.js" '{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass","--evidence","{\"provider\":\"codex\",\"reviewers\":1,\"agents\":[\"sd0x_codex_primary_reviewer\"],\"findings\":0,\"summary\":\"no actionable findings\"}"]}'`

Claude and other substitute reviewers have no gate authority.

Do not weaken, bypass, or manually edit runtime state when the gate rejects evidence.
