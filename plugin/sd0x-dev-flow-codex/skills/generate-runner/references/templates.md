# Per-Ecosystem Runner Templates

Every template emits one Node.js 24 CommonJS file under the generated runtime contract. These are closed step descriptors, not shell fragments.

## Node.js

| Template | Executable | Eligible argv sequence |
|---|---|---|
| `node-npm` | npm | Existing conventional scripts invoked one at a time |
| `node-yarn` | yarn | Existing conventional scripts invoked one at a time |
| `node-pnpm` | pnpm | Existing conventional scripts invoked one at a time |

Script selection order is `check`; otherwise existing `lint`, existing `build`, and one of `test:ci` or `test`. Duplicate stages are removed. The manifest supplies only membership evidence; its script bodies are not copied into generated argv.

## Python

| Evidence | Fixed read/check step |
|---|---|
| Ruff configuration or executable already available | Ruff check without fix mode |
| Pytest configuration or tests directory | Python module invocation of pytest with the contained tests path |

## Rust

The fixed sequence is metadata validation, compiler check, Clippy with warnings denied, and tests. No fix, install, publish, or network-fetch step is generated.

## Go

The fixed sequence is module-aware vet and test across contained packages. No get, install, generate, publish, or formatting mutation is generated.

## Header Contract

| Field | Requirement |
|---|---|
| `@plugin_version` | Exact generating plugin semantic version |
| `@template` | One identifier from this reference |
| `@ecosystem` | Detected or explicitly selected ecosystem |
| `@source_plan_sha256` | Digest binding manifests, steps, output, and plugin version |

The header marks the file as user-owned after generation. Setup and verify may inspect it but never replace it.
