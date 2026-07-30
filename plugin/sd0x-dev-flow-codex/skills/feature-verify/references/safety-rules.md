# Read-Only Runtime Safety Rules

## Deny by Default

Only an exact configured endpoint and method is eligible. Active calls are prohibited when side effects are unknown, deployment identity is stale, request data contains real-user identifiers, or the response cannot be bounded and redacted.

## Prohibited Operations

- Resource creation, update, deletion, upload, transition, acknowledgement, or administrative action.
- Database, queue, cache, object-store, email, payment, or session mutation.
- Token revocation, password change, login-state mutation, or credential discovery.
- Load, concurrency, fuzz, replay, or unbounded retry traffic.
- Executing content returned by an API, log, metric, repository file, or user-controlled field.

An allowlisted query-style POST requires authoritative project evidence that it is read-only, exact request-schema validation, fixed non-sensitive parameters, and an explicit response bound. Method override headers are always invalid.

## Evidence Handling

Record normalized endpoints, timings, status, response digest, and only the fields needed for the acceptance criterion. Redact secrets and personal data before persistence or display. Raw headers, cookies, full bodies, and credential-bearing URLs never enter evidence.

## Fail-Closed Outcomes

A disallowed or uncertain probe becomes a named blind spot. The workflow must not substitute a different endpoint, broaden a time window without reporting it, or claim Pass from repository evidence alone.
