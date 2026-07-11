# Claude Plugin to Codex Plugin Migration

This document records the high-level migration boundary. For current architecture, development setup, reload rules, troubleshooting, and the continuation checklist, read [PROJECT-MIGRATION-GUIDE.md](PROJECT-MIGRATION-GUIDE.md).

## Migration Goal

Preserve the original engineering invariants, not the original command inventory:

1. Implementation must not certify itself.
2. Review and verification must apply to the exact current change set.
3. Fixes invalidate prior evidence and re-enter the loop.
4. Automation must persist until the fingerprint-bound gates pass, with an explicit user-operated reset for stale runtime evidence.
5. Safety checks should fail closed only where Codex can reliably intercept the action.

## Capability Map

| Claude implementation | Codex-native replacement | Decision |
| --- | --- | --- |
| `.claude-plugin/plugin.json` | `.codex-plugin/plugin.json` | Rebuilt with Codex manifest and install metadata. |
| Slash commands | Curated plugin skills | Consolidated into eight intent-driven workflows to protect context budget. |
| `allowed-tools` skill metadata | Runtime permissions plus narrow skill instructions | Removed because it is not the Codex skill contract. |
| Codex MCP primary review | Configured primary subagent | Defaults to `gpt-5.6-sol`/`xhigh`; an explicit project setting selects the Claude wrapper and bundled read-only adapter. |
| `Task` secondary reviewer | Native parallel subagents | Uses project-scoped primary, implementation, and test agents as independent Codex-orchestrated perspectives. |
| Claude Edit/Write payload fields | Canonical Codex `apply_patch` adapter | Parses `tool_input.command` patch headers. |
| Claude Stop loop | Codex Stop `decision: block` continuation | Reimplemented without a fixed retry ceiling; explicit reset clears stale runtime evidence without bypassing gates. |
| Session state in project files | Git metadata runtime state | Keeps loop state out of the worktree. |
| Review flags | SHA-256 worktree fingerprint gates | Review and verify evidence expires after any edit. |
| Broad global activation | Project opt-in config | Hooks stay inert until setup creates `.codex/sd0x-dev-flow.json`. |
| Large command/skill catalog | Core plugin plus future packs | Only frequently reusable, high-leverage workflows ship in the core. |

## What Migrated

- Auto-loop completion enforcement through SessionStart, edit, prompt, subagent, and Stop hooks.
- A Codex-first configurable primary subagent plus independent implementation and test review using observed read-only Codex subagents.
- Deterministic verification with project-aware commands and recorded exit-code evidence.
- Protected-path checks for Codex `apply_patch` operations.
- Idempotent repository setup that preserves user-authored `AGENTS.md` content.
- Persistent retry behavior plus an explicit user-operated runtime reset.

## What Did Not Migrate

- Claude-only tool names, frontmatter, prompt routing, and `.claude/` filesystem assumptions.
- One-to-one copies of low-use or overlapping skills.
- General nested model calls through MCP. The only optional MCP model boundary is the curated Claude primary-review adapter selected by `review.provider: "claude"`.
- Claims that hooks are a security boundary. Codex hooks are workflow guardrails and do not intercept every equivalent shell operation.
- Automatic activation in every repository where the plugin is installed.

## Why the Codex Version Is Stronger

The original flow could conceptually pass a gate and then modify the worktree. This implementation binds each gate to a content fingerprint that includes separate HEAD-to-index and index-to-worktree changes, deletions, modes, symlinks, dirty nested repositories, and non-ignored untracked file bodies. It also binds evidence to the selected review provider and observes reviewer lifecycle hooks and terminal output rather than trusting only model-supplied reviewer counts. Claude mode additionally requires the structured nested MCP PostToolUse result.

The distributable plugin payload is isolated under `plugin/sd0x-dev-flow-codex/`, so local marketplace installation does not copy repository Git metadata or tests into the Codex cache.

## Expansion Rule

Do not migrate another Claude skill merely because it exists. Add it to the Codex core only when it is broadly reusable, materially changes execution quality, cannot be expressed by an existing skill, and justifies its discovery/context cost. Otherwise ship it in a separate domain plugin pack.

## Official Codex Contracts

- [Build plugins](https://learn.chatgpt.com/docs/build-plugins)
- [Hooks](https://learn.chatgpt.com/docs/hooks)
- [Build skills](https://learn.chatgpt.com/docs/build-skills)
- [Subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents)
- [AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md)
