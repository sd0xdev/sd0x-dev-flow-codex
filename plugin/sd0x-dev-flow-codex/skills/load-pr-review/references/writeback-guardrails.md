# Publication Handoff Guardrails

Load PR Review never publishes. A publication handoff to `$sd0x-dev-flow-codex:pr-comment` contains exactly one repository, pull-request number, current head object ID, thread identifier, numeric first-comment reply target, source-comment digest, reply bytes and digest, and whether resolution was separately requested.

Missing or nonnumeric reply targets remain plan-only. The publishing workflow must re-fetch the thread, reject head or comment drift, preview one atomic mutation, transmit the body as structured data without shell interpolation, read back the posted comment, and treat thread resolution as a separate result. No handoff is executed automatically.
