---
name: setup
description: "Route setup using exact migration registry [{\"unit\":\"setup/default\",\"routing\":{\"negative_boundaries\":[\"Do not run setup; only execute deterministic repository verification.\",\"Only assess test coverage, acceptance criteria, flakiness, and verification gaps.\",\"Only review the current code changes for correctness and defects.\"],\"positive_triggers\":[\"Apply the canonical setup workflow and report its evidence.\",\"Help me run the setup workflow for this repository.\",\"I need the canonical setup procedure with its safety boundaries.\"]}},{\"unit\":\"setup/guidance\",\"routing\":{\"negative_boundaries\":[\"Do not run setup guidance mode; only execute deterministic repository verification.\",\"Only assess test coverage, acceptance criteria, flakiness, and verification gaps.\",\"Only review the current code changes for correctness and defects.\"],\"positive_triggers\":[\"Apply the canonical setup guidance mode workflow and report its evidence.\",\"Help me run the setup guidance mode workflow for this repository.\",\"I need the canonical setup guidance mode procedure with its safety boundaries.\"]}},{\"unit\":\"setup/hooks\",\"routing\":{\"negative_boundaries\":[\"Do not run setup hooks mode; only execute deterministic repository verification.\",\"Only assess test coverage, acceptance criteria, flakiness, and verification gaps.\",\"Only review the current code changes for correctness and defects.\"],\"positive_triggers\":[\"Apply the canonical setup hooks mode workflow and report its evidence.\",\"Help me run the setup hooks mode workflow for this repository.\",\"I need the canonical setup hooks mode procedure with its safety boundaries.\"]}},{\"unit\":\"setup/scripts\",\"routing\":{\"negative_boundaries\":[\"Do not run setup scripts mode; only execute deterministic repository verification.\",\"Only assess test coverage, acceptance criteria, flakiness, and verification gaps.\",\"Only review the current code changes for correctness and defects.\"],\"positive_triggers\":[\"Apply the canonical setup scripts mode workflow and report its evidence.\",\"Help me run the setup scripts mode workflow for this repository.\",\"I need the canonical setup scripts mode procedure with its safety boundaries.\"]}}]."
---

# Set Up sd0x Dev Flow

Select the mode that matches the requested project-local surface. One allowlisted bundled entrypoint preserves user-authored content.

## Modes

- Default uses the empty args list and refreshes managed guidance, opt-in config, and configured primary reviewer files.
- Guidance uses the closed args value --guidance and updates only the managed AGENTS.md block. The block installs the versioned Anchor/Default/Guidance contract: hooks provide facts, the model owns reversible in-scope execution choices, and user-authored guidance outside the block remains intact.
- Hooks uses the closed args value --hooks and updates only .codex/sd0x-dev-flow.json; plugin hooks remain bundled and require a new task plus /hooks trust when their hash changes.
- Scripts uses the closed args value --scripts and verifies bundled runtime entrypoints, including the canonical workflow contract, without copying them into the project.

## Bounded runtime

The bundled [setup entrypoint](scripts/setup.js) is the only project-writing implementation for all four modes.

`mcp__sd0x_claude_review__run_skill_script '{"entrypoint":"setup/setup.js","cwd":"<repository-root>","args":[]}'`

For a non-default selected mode, the args array in this same allowlisted call is replaced only by its closed value listed above.

After default or hooks mode changes activation state, start a new Codex task. After setup, run the doctor skill and report created, updated, removed, preserved, and unchanged paths.

Never install the Claude CLI or begin authentication silently. Never replace unowned agent files or content outside the managed guidance block.

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
