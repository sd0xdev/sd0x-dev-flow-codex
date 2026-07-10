---
name: setup
description: Install or refresh sd0x Dev Flow project guidance and custom reviewer agents in the current repository. Use when configuring this Codex plugin for a repo, onboarding a project, or repairing missing sd0x AGENTS.md and .codex/agents files.
---

# Set Up sd0x Dev Flow

Resolve this skill's installed directory from the current `SKILL.md`, then run its bundled installer from the target repository:

```bash
node "<this-skill-directory>/scripts/setup.js"
```

Report which files were created, updated, or left unchanged. Then run:

```bash
node "<this-skill-directory>/../doctor/scripts/doctor.js"
```

The bundled Claude review MCP server is registered automatically by the plugin; do not run `claude mcp add`. Doctor checks that the local `claude` CLI exists and `claude auth status --json` reports an active login. If either check fails, give the user the official platform-appropriate Claude Code install command, then ask them to run `claude auth login`. Never install the CLI or start an account login silently.

Setup also creates `.codex/sd0x-dev-flow.json`; hooks remain inert until this opt-in file has `enabled: true` and a new Codex task observes it at SessionStart. If setup created or updated the config or either agent file, tell the user to start a new task before relying on review. Do not overwrite user-authored content outside the managed `AGENTS.md` block or replace an unowned custom-agent file.
