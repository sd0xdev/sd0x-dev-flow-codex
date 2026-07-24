# Requirements document template

```markdown
# Requirements: <Feature Name>

> **Doc class**: Lifecycle — Phase 1 feature-level problem analysis, not a task ticket
> **Created**: <YYYY-MM-DD>
> **Updated**: <YYYY-MM-DD>
> **Tier**: <quick|standard|deep>
> **Tech Spec**: <relative link to `./2-tech-spec.md`>
> **Request tickets**: See `./requests/` for per-task execution tracking

## 1. Problem Statement

<Root user or business need, without solution design.>

### 5-Why Trace

1. Surface: <what was requested>
2. Why: <underlying problem>
3. Root: <driver and success condition>

## 2. Goals / Non-Goals

| Goals | Non-Goals |
|---|---|
| <Outcome in scope> | <Explicit exclusion> |

## 3. Stakeholders

| Stakeholder | Role | Key Concern |
|---|---|---|
| <Name or group> | Developer / User / Operator / Dependent | <Primary concern> |

## 4. Scenarios

| ID | Actor | Action | Expected Outcome |
|---|---|---|---|
| UC-1 | <Who> | <Does what> | <Observable result> |

## 5. Functional Requirements

| ID | Requirement | Priority | Rationale |
|---|---|---|---|
| FR-1 | <Testable requirement> | Must | <Reason> |

## 6. Non-Functional Requirements

| ID | Category | Requirement | Metric or validation |
|---|---|---|---|
| NFR-1 | Security | <Requirement> | <Threshold or method> |

## 7. Constraints & Assumptions

| Type | Description | Source |
|---|---|---|
| Assumption | <Believed true> | <User / repository / citation / inference> |

## 8. Acceptance Signals

- <Observable outcome tied to FR-N or NFR-N>

## 9. Open Questions

- [ ] <Question requiring stakeholder input>
- [ ] <Solution concern; continue in feasibility-study>

## 10. References

- <Repository file with line reference or external source>
```

Omit the Tech Spec line when `2-tech-spec.md` does not exist. Omit the Request tickets line when `requests/` does not exist. `quick` mode may omit Use Cases and Non-Functional Requirements only when they add no decision value; all other sections remain required.
