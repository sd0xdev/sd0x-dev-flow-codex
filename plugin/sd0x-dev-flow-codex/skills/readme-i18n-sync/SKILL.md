---
name: readme-i18n-sync
description: "Translate changed canonical English README sections into maintained locale files while preserving unchanged content, links, identifiers, and glossary terms. Does not edit the canonical English source."
---

# README Internationalization Sync

This workflow synchronizes changed canonical English README sections into the repository's existing maintained locale READMEs while preserving all unchanged bytes and protected technical tokens.

## Registry and scope

Discover the canonical README and locale registry from repository documentation or the existing language switcher. The optional locale selector must match one exact registered locale. Full synchronization requires an explicit request; otherwise resolve changed English sections from a verified base-to-worktree comparison and heading boundaries.

Bind the plan to canonical README digest, each locale digest, base object ID, section identifiers, and the [translation glossary](references/glossary.md). Reject duplicate headings, missing locale sections, structural drift that prevents a unique mapping, symbolic links, unsupported encodings, or source drift.

## Translation

For each selected locale, inspect sufficient current locale context and the glossary to preserve established voice, but translate only the selected English section bodies. Preserve heading hierarchy, anchors, tables, links and destinations, code fences, inline code, HTML, badges, image URLs, product names, skill names, file paths, placeholders, identifiers, version strings, and glossary-protected terms exactly.

Each locale draft is derived independently as data and returned to the parent workflow. The parent applies contained replacements only after verifying that unchanged prefix, suffix, and non-selected section digests are identical. No translation worker writes files or expands scope.

## Verification

Re-read every changed locale and compare section order, heading and anchor inventory, link targets, fence balance, table shape, protected tokens, glossary terms, locale-specific terminology, and unchanged-section digests with the plan. Exact source and locale digests must still match immediately before each atomic write.

Line-count similarity is diagnostic only and never proof of correctness. Translation uncertainty, missing glossary entries, and source-locale structural conflicts are reported for human review. The canonical English README is read-only in this workflow.

## Result

Return canonical source identity, selected sections and locales, before-and-after digests, updated paths, structural checks, glossary findings, translation uncertainties, and documentation-review handoff. Documentation review is not auto-dispatched and this skill claims no review gate.

<!-- sd0x-routing-contract:v1 unit=readme-i18n-sync/default -->
```json
{
  "positive_triggers": [
    "Apply the canonical readme-i18n-sync workflow and report its evidence.",
    "Help me run the readme-i18n-sync workflow for this repository.",
    "I need the canonical readme-i18n-sync procedure with its safety boundaries."
  ],
  "negative_boundaries": [
    "Do not run readme-i18n-sync; only execute deterministic repository verification.",
    "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
    "Only review the current code changes for correctness and defects."
  ]
}
```
