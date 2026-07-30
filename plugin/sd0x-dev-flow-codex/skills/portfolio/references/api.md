# Portfolio API Model Guide

## Endpoint discovery

Treat route names and methods in this reference as examples to verify against the current controller. For each discovered endpoint, record method, path, request type, validation rules, feature flags, response type, and source file.

## Position model

A position commonly carries network and owner identity, protocol and category, asset, debt and reward collections, metrics, provider provenance, fetch time, cache state, and an optional grouping identifier. Verify actual field names and optionality in current data-transfer and domain types.

## Aggregation checks

Trace total asset value, rewards, debt, net worth, protocol count, position count, currency conversion, decimal normalization, and group merging to their implementation and tests. Report rounding, missing-price, unsupported-currency, stale-data, and partial-provider behavior instead of filling gaps with assumptions.
