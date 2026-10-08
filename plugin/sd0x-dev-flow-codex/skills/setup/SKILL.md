---
name: setup
description: "Install or refresh project-local managed sd0x guidance, opt-in hook configuration, and the configured primary reviewer through the bundled setup script. Preserve user-authored content and report activation requirements."
---

# Set Up sd0x Dev Flow

Select the mode that matches the requested project-local surface. One allowlisted bundled entrypoint preserves user-authored content.

## Modes

- Default uses the empty args list and refreshes managed guidance, opt-in config, and configured primary reviewer files.
- Guidance uses the closed args value --guidance and updates only the managed AGENTS.md block. The block installs the versioned Anchor/Default/Guidance contract: hooks provide facts, the model owns reversible in-scope execution choices, and user-authored guidance outside the block remains intact.
- Hooks uses the closed args value --hooks and updates only .codex/sd0x-dev-flow.json; plugin hooks remain bundled and require a new task plus /hooks trust when their hash changes.
- Scripts uses the closed args value --scripts and verifies bundled runtime entrypoints, including the canonical workflow contract, without copying them into the project.

## Bounded runtime

Resolve `<plugin-root>` as two directories above this skill's installed directory, from the current `SKILL.md` location. The runner inherits `CODEX_HOME` and `CODEX_THREAD_ID` from the current Codex shell. The runner returns JSON with `exit_code`, `stdout`, and `stderr`; parse the script's JSON from `stdout` and respect failures.

The bundled [setup entrypoint](scripts/setup.js) is the only project-writing implementation for all four modes.

`node "<plugin-root>/scripts/runtime/runner.js" '{"entrypoint":"setup/setup.js","cwd":"<repository-root>","args":[]}'`

For a non-default selected mode, the args array in this same allowlisted call is replaced only by its closed value listed above.

After default or hooks mode changes activation state, start a new Codex task. After setup, run the doctor skill and report created, updated, removed, preserved, and unchanged paths.

Do not install external model CLIs or begin authentication as part of setup. Never replace unowned agent files or content outside the managed guidance block.

<!-- sd0x-routing-contract:v1 unit=setup/default -->
```json
{
  "positive_triggers": [
    "Apply the canonical setup workflow and report its evidence.",
    "Help me run the setup workflow for this repository.",
    "I need the canonical setup procedure with its safety boundaries."
  ],
  "negative_boundaries": [
    "Do not run setup; only execute deterministic repository verification.",
    "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
    "Only review the current code changes for correctness and defects."
  ]
}
```

<!-- sd0x-routing-contract:v1 unit=setup/guidance -->
```json
{
  "positive_triggers": [
    "Apply the canonical setup guidance mode workflow and report its evidence.",
    "Help me run the setup guidance mode workflow for this repository.",
    "I need the canonical setup guidance mode procedure with its safety boundaries."
  ],
  "negative_boundaries": [
    "Do not run setup guidance mode; only execute deterministic repository verification.",
    "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
    "Only review the current code changes for correctness and defects."
  ]
}
```

<!-- sd0x-routing-contract:v1 unit=setup/hooks -->
```json
{
  "positive_triggers": [
    "Apply the canonical setup hooks mode workflow and report its evidence.",
    "Help me run the setup hooks mode workflow for this repository.",
    "I need the canonical setup hooks mode procedure with its safety boundaries."
  ],
  "negative_boundaries": [
    "Do not run setup hooks mode; only execute deterministic repository verification.",
    "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
    "Only review the current code changes for correctness and defects."
  ]
}
```

<!-- sd0x-routing-contract:v1 unit=setup/scripts -->
```json
{
  "positive_triggers": [
    "Apply the canonical setup scripts mode workflow and report its evidence.",
    "Help me run the setup scripts mode workflow for this repository.",
    "I need the canonical setup scripts mode procedure with its safety boundaries."
  ],
  "negative_boundaries": [
    "Do not run setup scripts mode; only execute deterministic repository verification.",
    "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
    "Only review the current code changes for correctness and defects."
  ]
}
```

<!-- sd0x-v5-native-guidance -->
Load the git-policy and git-authorization contract topics through the installed native reader with the exact installed version before dependent work. Missing, unreadable, changed-manifest or wrong-version contracts leave the dependent action unresolved; recover the installation or context instead of inferring the omitted rules. Contract delivery is not proof of model understanding or gate acceptance. The optional Git policy scaffold is absent-only and preserves user settings byte-for-byte; detect existing custom flow before suggesting typed deployment declarations. Setup never executes the declared flow.

For Git integration, init/sync also invokes the native git-hooks-install action: commit-msg is the default noninteractive attribution guard, and with_push_gate explicitly opts in to pre-push. The latter requires exact terminal confirmation for protected/history-changing ref updates and refuses noninteractive use for those updates; it has no environment bypass. This is separate from Codex event hooks. Discovery selects Husky, repository-contained core.hooksPath, direct Git hooks, or an explicitly selected fallback directory. Foreign files, modified managed blocks, malformed markers and unbounded legacy wiring remain pending without overwrites. Existing installed/pending opt-in survives sync; a declined push guard stays declined unless explicitly selected. External hooksPath ownership remains a reported dependent action.

After wiring, the native git-hooks-doctor action reports Git-resolved identity, ownership, executability and recognized Husky routing separately from current bytes. Written fallback files remain pending until Git actually resolves them; setup does not change core.hooksPath. Static routing is not an observed hook execution. Validate actual message rejection and preservation of downstream Husky commands/ref stdin in a disposable repository before asserting those behaviors. Native installation records live only in Git metadata.

An explicitly requested push-gate removal uses git-hooks-remove-push. It removes only the intact owned Husky block or exact owned dedicated file, preserves all user bytes and records declined so later sync does not silently reinstall it. Edited or ambiguous ownership remains unresolved; removal is never implied by omitting an opt-in flag.
