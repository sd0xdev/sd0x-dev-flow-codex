# Pull-request Comment API and Guardrails

<!-- sd0x-operation-evidence:v1 operation=pr-write provider=github action=create-pull-request-review -->

## Atomic review shape

The publisher creates one GitHub review with event fixed to COMMENT, the exact pull-request head commit ID, an empty summary body, and a bounded ordered collection of inline comments. policy-block decision and request-changes events are unsupported.

## Transmission

The request body is built as an in-memory structured value. Comment text is supplied only as data to a fixed API argument or request-body field; it is never interpolated into a shell, executable, endpoint, option, temporary filename, or log. Authentication remains in the GitHub capability and is never printed.

## Validation

- Repository and pull-request identifiers resolve exactly and remain unchanged between prepare and submit.
- Head object ID, changed paths, diff positions, side, line, payload order, byte length, and digest are revalidated.
- At least one and at most the configured hard-cap comments are valid; one invalid item rejects the atomic batch.
- A binary, truncated, unavailable, or drifting patch cannot receive an inline comment.
- Response status alone is insufficient; exact review and comment identifiers must be read back.

## Failure behavior

Input, authentication, network, validation, or platform errors return a structured failure. Head or diff drift returns a fresh-prepare requirement. No failure triggers an automatic retry, second review, resolution action, or deletion.
