# OWASP Top 10:2025 review coverage

Edition checked 2026-10-03 against the [official OWASP list](https://top10.owasp.org/2025/). This awareness taxonomy organizes investigation; it does not establish compliance or certify an application.

| Category | Review focus |
|---|---|
| A01 | Access-control enforcement, object ownership, SSRF trust boundaries |
| A02 | Deployment and security configuration |
| A03 | Dependencies, build systems and distribution supply chain |
| A04 | Cryptographic design and key lifecycle |
| A05 | Untrusted data reaching interpreters |
| A06 | Missing abuse-case controls in design |
| A07 | Authentication and session protections |
| A08 | Software/data authenticity and integrity |
| A09 | Security event visibility and actionable alerts |
| A10 | Exceptional conditions, fail-open paths and sensitive errors |

A01 includes SSRF in the [official category](https://top10.owasp.org/2025/A01_2025-Broken_Access_Control/). Trace attacker-controlled destinations, redirects, internal endpoints and enforcement placement. [A03](https://top10.owasp.org/2025/A03_2025-Software_Supply_Chain_Failures/) extends beyond known vulnerable packages. [A10](https://top10.owasp.org/2025/A10_2025-Mishandling_of_Exceptional_Conditions/) covers unexpected-condition handling. For each applicable category cite concrete code, exploit prerequisites and regression evidence; label uninspected areas and justified exclusions.
