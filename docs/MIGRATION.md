# Claude Plugin to Codex Plugin Migration

This document records the high-level migration boundary. For current architecture, development setup, reload rules, troubleshooting, and the continuation checklist, read [PROJECT-MIGRATION-GUIDE.md](PROJECT-MIGRATION-GUIDE.md).

## Migration Goal

Preserve the original engineering invariants, not the original command inventory:

1. Implementation must not certify itself.
2. Review and verification must apply to the exact current change set.
3. Fixes invalidate prior evidence and re-enter the loop.
4. Automation must stop at a bounded safety limit rather than recurse forever.
5. Safety checks should fail closed only where Codex can reliably intercept the action.

## Capability Map

| Claude implementation | Codex-native replacement | Decision |
| --- | --- | --- |
| `.claude-plugin/plugin.json` | `.codex-plugin/plugin.json` | Rebuilt with Codex manifest and install metadata. |
| Slash commands | Curated plugin skills | Consolidated into seven intent-driven workflows to protect context budget. |
| `allowed-tools` skill metadata | Runtime permissions plus narrow skill instructions | Removed because it is not the Codex skill contract. |
| Codex MCP primary review | Bundled Claude MCP primary review | Reverses the host/model boundary with a local read-only adapter around Claude CLI. |
| `Task` secondary reviewer | Native parallel subagents | Uses project-scoped `sd0x_reviewer` and `sd0x_test_reviewer` as independent Codex perspectives. |
| Claude Edit/Write payload fields | Canonical Codex `apply_patch` adapter | Parses `tool_input.command` patch headers. |
| Claude Stop loop | Codex Stop `decision: block` continuation | Reimplemented with bounded continuations and rounds. |
| Session state in project files | Git metadata runtime state | Keeps loop state out of the worktree. |
| Review flags | SHA-256 worktree fingerprint gates | Review and verify evidence expires after any edit. |
| Broad global activation | Project opt-in config | Hooks stay inert until setup creates `.codex/sd0x-dev-flow.json`. |
| Large command/skill catalog | Core plugin plus future packs | Only frequently reusable, high-leverage workflows ship in the core. |

## What Migrated

- Auto-loop completion enforcement through SessionStart, edit, prompt, subagent, and Stop hooks.
- Claude MCP primary review plus independent implementation and test review using two observed read-only Codex subagents.
- Deterministic verification with project-aware commands and recorded exit-code evidence.
- Protected-path checks for Codex `apply_patch` operations.
- Idempotent repository setup that preserves user-authored `AGENTS.md` content.
- Bounded retry and escalation behavior.

## What Did Not Migrate

- Claude-only tool names, frontmatter, prompt routing, and `.claude/` filesystem assumptions.
- One-to-one copies of low-use or overlapping skills.
- General nested model calls through MCP. The only MCP model boundary is the curated Claude primary-review adapter, which supplies the cross-model perspective requested by this workflow.
- Claims that hooks are a security boundary. Codex hooks are workflow guardrails and do not intercept every equivalent shell operation.
- Automatic activation in every repository where the plugin is installed.

## Why the Codex Version Is Stronger

The original flow could conceptually pass a gate and then modify the worktree. This implementation binds each gate to a content fingerprint that includes separate HEAD-to-index and index-to-worktree changes, deletions, modes, symlinks, dirty nested repositories, and non-ignored untracked file bodies. It observes the structured Claude MCP PostToolUse result plus reviewer lifecycle hooks and terminal reviewer output rather than trusting only model-supplied reviewer counts.

The distributable plugin payload is isolated under `plugin/sd0x-dev-flow-codex/`, so local marketplace installation does not copy repository Git metadata or tests into the Codex cache.

## Expansion Rule

Do not migrate another Claude skill merely because it exists. Add it to the Codex core only when it is broadly reusable, materially changes execution quality, cannot be expressed by an existing skill, and justifies its discovery/context cost. Otherwise ship it in a separate domain plugin pack.

## Official Codex Contracts

- [Build plugins](https://learn.chatgpt.com/docs/build-plugins)
- [Hooks](https://learn.chatgpt.com/docs/hooks)
- [Build skills](https://learn.chatgpt.com/docs/build-skills)
- [Subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents)
- [AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md)
