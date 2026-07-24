'use strict';
// sd0x-migration-test target=tech-spec unit=tech-spec/deep
const { defineRoutingContractTests } = require('../scripts/skill-routing-test');
defineRoutingContractTests({
  "target": "tech-spec",
  "targetPackage": "core",
  "unit": "tech-spec/deep",
  "registry": [
    {
      "unit": "tech-spec/deep",
      "routing": {
        "positive_triggers": [
          "Apply tech-spec deep mode to docs/features/billing/2-tech-spec.md and synthesize verified findings into its design.",
          "Deeply analyze the proposed Redis cache by validating assumptions, tracing repository patterns, comparing alternatives, and producing an implementation roadmap.",
          "Investigate competing architectures for multi-tenant billing with independent challenge before refining the canonical technical specification."
        ],
        "negative_boundaries": [
          "Implement the selected architecture, modify production code, and update execution status.",
          "Research the external market and produce a research brief without designing this repository.",
          "Write a straightforward technical specification from already-approved requirements without deep comparative investigation."
        ]
      }
    },
    {
      "unit": "tech-spec/default",
      "routing": {
        "positive_triggers": [
          "Create a technical specification for the authentication feature from its approved requirements.",
          "Design the default solution architecture, risks, work breakdown, and test strategy for payment retries.",
          "Update docs/features/billing/2-tech-spec.md after reviewing the current requirements and code."
        ],
        "negative_boundaries": [
          "Analyze the underlying product need with a 5-Why and write functional requirements.",
          "Implement the approved technical specification and update execution ticket status.",
          "Perform a deep comparative investigation before refining the selected technical design."
        ]
      }
    }
  ],
  "routing": {
    "positive_triggers": [
      "Apply tech-spec deep mode to docs/features/billing/2-tech-spec.md and synthesize verified findings into its design.",
      "Deeply analyze the proposed Redis cache by validating assumptions, tracing repository patterns, comparing alternatives, and producing an implementation roadmap.",
      "Investigate competing architectures for multi-tenant billing with independent challenge before refining the canonical technical specification."
    ],
    "negative_boundaries": [
      "Implement the selected architecture, modify production code, and update execution status.",
      "Research the external market and produce a research brief without designing this repository.",
      "Write a straightforward technical specification from already-approved requirements without deep comparative investigation."
    ]
  }
});
