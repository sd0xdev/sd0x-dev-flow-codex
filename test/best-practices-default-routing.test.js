'use strict';
// sd0x-migration-test target=best-practices unit=best-practices/default
const { defineRoutingContractTests } = require('../scripts/skill-routing-test');
defineRoutingContractTests({
  "target": "best-practices",
  "targetPackage": "core",
  "unit": "best-practices/default",
  "registry": [
    {
      "unit": "best-practices/default",
      "routing": {
        "negative_boundaries": [
          "Design a new telemetry architecture from first principles.",
          "Find security vulnerabilities in this authentication diff.",
          "Research possible caching approaches without judging the current implementation."
        ],
        "positive_triggers": [
          "Assess whether our telemetry implementation conforms to current OpenTelemetry best practices.",
          "Audit this caching implementation against the named industry standard and produce a gap roadmap.",
          "Benchmark the service's error handling against authoritative best practices."
        ]
      }
    }
  ],
  "routing": {
    "positive_triggers": [
      "Assess whether our telemetry implementation conforms to current OpenTelemetry best practices.",
      "Audit this caching implementation against the named industry standard and produce a gap roadmap.",
      "Benchmark the service's error handling against authoritative best practices."
    ],
    "negative_boundaries": [
      "Design a new telemetry architecture from first principles.",
      "Find security vulnerabilities in this authentication diff.",
      "Research possible caching approaches without judging the current implementation."
    ]
  }
});
