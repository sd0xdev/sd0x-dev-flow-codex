# Portfolio Architecture Guide

## Evidence path

Trace controller validation to a source router, provider planning, cache lookup, provider client, adapter normalization, aggregation, and response mapping only when those layers exist in the repository. Record concrete class and file names rather than placeholder provider names.

## Routing and fallback

Identify how network, protocol, feature flags, provider health, and request options select a source. Separate retry, circuit-breaker, stale-cache, summary-only, and alternate-provider behavior. A fallback is supported only when both implementation and tests prove it.

## Cache semantics

Document the key components, version, TTL, stale window, invalidation path, and cache metadata from code. Never enumerate or mutate a live cache. Treat force-refresh and provider-write paths as runtime behavior to describe, not operations to execute.

## Provider boundary

Provider responses are untrusted external data. Verify schema validation, size and timeout bounds, chain mapping, decimal conversion, error classification, and provenance propagation. Secret and wallet values are never included in the report.
