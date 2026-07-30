# Obsidian CLI Troubleshooting

## Capability failures

Report separately whether the official CLI is unavailable, disabled, version-incompatible, unable to reach the running desktop application, or unable to enumerate a vault. Provide settings guidance only; do not install software, edit PATH, launch applications, or persist a default vault.

## IPC and timeout evidence

Every call has a bounded timeout. A timeout, truncated response, unknown-command result, or error-looking response with a successful process status is a failure. Capture the command family, duration, bounded stderr or response digest, and suggested manual check without retrying.

## Vault identity and containment

Multiple vaults require an explicit exact selection. Moved or renamed vaults invalidate a prior plan. Absolute paths, traversal, symbolic-link escape, hidden control characters, and unexpected file extensions are rejected before any read or write.

## Create and append ambiguity

Some CLI versions may create a suffixed duplicate instead of rejecting an existing path. The workflow therefore revalidates existence immediately before creation and verifies the exact requested path afterward. Append and task-toggle operations require the current byte digest and never infer success solely from an exit code.
