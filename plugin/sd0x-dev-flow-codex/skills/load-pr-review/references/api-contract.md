# API Contract — Load Pull-Request Review

## Primary Query

The primary read-only GitHub query returns pull-request number, title, URL, head and base names, head object ID, state, review decision, and review-thread pages. Each thread includes stable identifier, resolution and outdated state, path, line range, side, and up to 20 bounded comments with database identifier, author, body, and creation time.

Thread pages contain at most 100 entries. Follow explicit cursors until no next page or the 200-thread hard cap is reached. Detect repeated or missing cursors and report truncation rather than looping.

## REST Fallback

REST review comments may be read when thread GraphQL data is unavailable. Group only by stable reply relationships and path/position evidence; never invent resolution state. Mark every fallback result degraded and retain the original comment identifiers.

## Preflight

Require a real repository identity, a positive decimal pull-request number, bounded response sizes, and a pull request returned by GitHub. Closed or merged pull requests may be displayed as historical evidence but cannot produce a current-fix readiness claim.
