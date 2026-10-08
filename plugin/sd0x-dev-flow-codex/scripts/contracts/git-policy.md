# Project policy and overrides

Anchors take precedence over every project setting and annotation. Project prose may refine Defaults and Guidance; unknown headings do not create new authority. Explain a material conflict and preserve the user's original file. Never silently delete, replace or downgrade user-authored AGENTS sections, custom agents, or policy settings during setup.

The native Git override is user-owned `.codex/sd0x-git.json`, parsed by `scripts/runtime/git-policy.js`. Missing files use documented defaults; malformed, unreadable, symlinked or raced files fail closed. Use the parser before interpreting or editing settings. Its closed schema accepts naming conventions, additive protected branches, offer_mode, goal_commit and typed deploy/run settings. It rejects unknown fields rather than accepting Anchor overrides. Defaults always protect main, master, develop and release/*; additions use exact names or prefix/*, with no negation/removal.

Setup may offer an example scaffold when requested or when a custom flow is discovered; create it only within the user's local setup scope and only when absent. Existing files are never regenerated. A naming convention describes payload form, not permission to commit, stage, push or publish. A deploy declaration selects steps, not authority to execute them. Retired Claude rule filenames have no native files to delete.
