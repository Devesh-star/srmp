# CyberRisk Dashboard & Metrics Guide

This document specifies the core definitions, calculations, chart purposes, and operational limits of the CyberRisk dashboard and asset risk views.

## 1. Core Definitions

- **Included Risks**: All risks belonging to the active organization whose status is not `"Closed"`. 
  - *Included*: Open, In Treatment, Mitigated, Accepted.
  - *Excluded*: Avoided risks (which automatically resolve to Closed status) and manually closed risks.
- **Evaluation Basis**:
  - `residual` (Default): Evaluates risks using their `residualScore`.
  - `inherent`: Evaluates risks using their `inherentScore`.
  - *Scope of Basis Toggle*: The basis toggle dynamically affects the overall score, severity counts, level distribution, threat category distribution, top 10 risks, and asset rankings. It does **not** affect the Inherent-vs-Residual comparison chart, the Control Implementation breakdown, or historical assessment trend snapshots.
- **Overall Score**: Computed as `summarize(scores).overall` on a scale of 0–100, mapped to a severity tier via `overallLevel(overall)`. 
  - *Pairing with Max Score*: Because arithmetic averages can obscure a single critical exposure among many low risks, the overall score is **always** displayed alongside the maximum risk score (`max`) and its corresponding tier (`level(max)`).
- **Asset Risk Level ("Worst Risk" Rule)**: The risk level of an asset is defined as `level(maxScore)` among that asset's included risks.
  - Assets with no included risks have `level: null` and display as `"Not assessed"`.
  - Aggregations also expose `totalScore` and `riskCount`.
  - Asset criticality is displayed purely as an arithmetic number (`(C + I + A) / 3`); no qualitative labels are invented.
- **Projected Overall Score**: Estimates what the organization's overall risk would be if *every planned control* on mitigate-treatment risks were successfully implemented.
  - For each included risk with treatment `"mitigate"`, planned controls are evaluated as implemented in memory via `computeResidual()`.
  - Risks with treatments of Accept, Transfer, or Avoid retain their current stored residual score.
  - The resulting scores are aggregated via `summarize()`.
  - Controls are batch-loaded once, with zero database mutations.
- **Dynamic Threshold Bands**:
  - Thresholds are never hard-coded in UI components.
  - Risk item boundaries (`bands.risk`) come directly from `levelRange(level)` (`Low: [0, 5)`, `Medium: [5, 10)`, `High: [10, 17)`, `Critical: [17, 25]`).
  - Overall boundaries (`bands.overall`) are computed dynamically by scanning `overallLevel(0..100)` to detect transition points (`Low: [0, 20)`, `Medium: [20, 40)`, `High: [40, 68)`, `Critical: [68, null)`).
- **Multi-Tenant Isolation**: The `organizationId` is always derived strictly from the authenticated user session. Every database query filters by `organizationId` (or `{ $in: [null, ctx.organizationId] }` for shared library catalogs).

---

## 2. Dashboard Charts & Business Questions Answered

1. **Risk Distribution** (Bar Chart):
   - *Question Answered*: What is the balance of risks across Low, Medium, High, and Critical tiers?
2. **Risk by Threat Category** (Stacked Bar Chart):
   - *Question Answered*: Which operational domains (Cyber, Physical, Environmental, Human) carry our highest-severity risks?
3. **Top 10 Risks** (Horizontal Bar Chart):
   - *Question Answered*: Which specific risk scenarios demand immediate executive and remediation priority?
4. **Most Vulnerable Assets** (Ranked Bar Chart):
   - *Question Answered*: Which institutional assets or databases exhibit the highest single points of failure?
5. **Inherent vs Residual Comparison** (Grouped Bar Chart):
   - *Question Answered*: How effectively are existing controls compressing risk from baseline inherent severity down to current residual severity for our top exposures?
6. **Control Implementation Progress** (Stacked Bar Chart):
   - *Question Answered*: What percentage of attached risk controls have transitioned from planned to implemented across Technical, Administrative, and Physical controls?
7. **Risk Trend Over Time** (Historical Line Chart + Live Point):
   - *Question Answered*: Is our overall risk posture trending downward across official snapshot milestones, and where does our current live posture stand?
8. **Compact Heatmap Matrix** (Interactive Grid):
   - *Question Answered*: How do active risks cluster across the Likelihood × Impact 5×5 decision space?

---

## 3. Operational Limits & Performance Guardrails

- **5,000 Risk Limit**: Generating the real-time aggregated dashboard is capped at organizations with up to 5,000 active non-closed risks. Workspaces exceeding 5,000 active risks receive an `AppError(409, "Too many risks to build the dashboard")` prompting archival or assessment snapshotting.
- **Single-Pass Parallel Fetching**: The dashboard service loads risks, assets, threats, vulnerabilities, and controls in a single parallel step with strict field projection, executing aggregation in memory in `< 2 seconds`.

---

## 4. Modeling Limitations

1. **Control Independence**: Projected risk calculations assume security controls reduce likelihood and impact independently without compounding synergies or negative interference.
2. **Estimated Control Effectiveness**: Effectiveness percentages originate from standard security library estimates and require qualitative validation.
3. **Averaging Masking**: Because `summarize().overall` computes a mean across all risks, large numbers of low-severity risks can mathematically dilute a critical exposure. Decisions must always review the accompanying `maxScore` and `Critical` count cards.
