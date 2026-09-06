---
name: update-readme
description: "Regenerate owned README catalog sections from canonical skill and manifest evidence while preserving all other content. Report locale changes for readme-i18n-sync."
---

# README Catalog Update

Regenerate repository-owned README catalog sections from the canonical plugin manifest and skill frontmatter while preserving all unrelated README content.

## Catalog sources

The workflow binds repository fingerprint, canonical plugin payload root, plugin manifest, public skill inventory, each selected frontmatter digest, existing README digest, managed marker boundaries, and locale registry. Mapping-only aliases are counted as mappings rather than duplicate public skills.

Only repository-defined managed sections may be regenerated. Missing or duplicate markers, ambiguous catalog ownership, invalid frontmatter, duplicate canonical names, orphan manifest entries, symbolic links, or README drift stop the write plan.

## Deterministic rendering

Catalog rows are sorted by the repository's documented bytewise order and contain canonical name, concise description, supported modes, and package status derived from current payload evidence. Counts are calculated from the same captured inventory. No prose outside managed markers is reformatted.

The preview includes source digests, managed section identifiers, old and new section digests, count deltas, added and removed entries, and locale sections affected by the English change. Locale content is not translated by this workflow.

## Write and validation

Immediately before one contained atomic replacement, all source and destination identities are revalidated. The resulting README is checked for marker uniqueness, catalog completeness, stable ordering, count consistency, links to existing skills, balanced Markdown structures, and identical bytes outside managed sections.

The result reports the changed English sections and hands actual locale translation to the independent README internationalization workflow. It never edits arbitrary README prose, creates skills, or claims documentation review.

<!-- sd0x-routing-contract:v1 unit=update-readme/default -->
```json
{
  "positive_triggers": [
    "Apply the canonical update-readme workflow and report its evidence.",
    "Help me run the update-readme workflow for this repository.",
    "I need the canonical update-readme procedure with its safety boundaries."
  ],
  "negative_boundaries": [
    "Do not run update-readme; only execute deterministic repository verification.",
    "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
    "Only review the current code changes for correctness and defects."
  ]
}
```
