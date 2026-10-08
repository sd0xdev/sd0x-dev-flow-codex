# Native manifest map

The installed local runner accepts entrypoint workflow/manifest-map.js, repository cwd and literal argument strings. Select --format md or json, --top N, --include-candidates, --reverse selector or --cycles. Reverse and cycles are mutually exclusive. Invalid values or ambiguous/missing selectors exit 2; enumeration failure is an error, never an empty corpus.

The graph covers package.json, composer.json, go.mod/go.work, Cargo.toml and pyproject.toml using bounded built-in parsers. Unsupported syntax stays partial. Workspace controllers establish membership; nearby examples/fixtures remain candidates unless explicitly included. Local, external and unresolved dependencies remain distinct, with declaration evidence and runtime/development/peer scopes. Reverse queries are direct dependents; iterative strongly connected components include self-loops and scope classification.

The default budget is 500 manifests and 1 MiB per manifest. Oversized/unreadable/malformed files carry coverage and omission evidence. JSON is a complete bounded artifact: top-N only controls Markdown display. Dependency declarations do not prove imports, execution paths or downstream runtime impact. Output credentials are redacted. No project install/build script or Git fsmonitor helper is executed.

Source: sd0x-harness v5 snapshot 7805e985. The algorithm is distributed in the native payload, with upstream MIT attribution; it does not depend on a sibling source checkout or Claude transport.
