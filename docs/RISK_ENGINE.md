# CyberRisk Engine Explanation

## Core Philosophy and Formulas
The CyberRisk engine is designed as a pure, deterministic function library for calculating cybersecurity risk scores.
- **Inherent Score**: `likelihood × impact` (integers 1–5). Maximum score is 25.
- **Criticality**: `(confidentiality + integrity + availability) / 3` (arithmetic mean).
- **Residual Calculation**: Applies active security controls to reduce the inherent likelihood and impact. Each implemented control applies a multiplier of `(1 - effectiveness)` to its respective dimension. 
  - *Example*: Likelihood 4 with a 0.25 effectiveness control becomes `4 × 0.75 = 3`. 
  - Multiple controls compound multiplicatively: `Likelihood × (1 - eff1) × (1 - eff2)`.

## The Floor at 1
To reflect that risk can never be perfectly eliminated without avoiding the activity altogether, residual likelihood and impact calculations are hard-floored at `1` using `Math.max(1, value)`. A control effectiveness of 1.0 will instantly floor its dimension to 1. 

## Treatments
The engine handles four standard risk treatments:
1. **Mitigate**: Applies the residual calculation using implemented controls.
2. **Accept**: Reverts to the inherent score. Controls are ignored.
3. **Transfer**: Ignores controls. Instead, it scales the impact using a `transferFactor` (e.g., insurance coverage percentage), leaving likelihood untouched. Impact is floored at 1.
4. **Avoid**: The activity is ceased. The risk is completely removed, returning a score of 0, likelihood 0, impact 0, and level "Low". This is the only scenario where scores below 1 are possible.

## Why Decimals?
While inherent risk is rated using integers [1, 5], applying percentage-based control effectiveness creates floating-point results. We store and calculate residual dimensions and scores as full-precision unrounded decimals to avoid cascading rounding errors in complex chains. Rounding is reserved exclusively for the UI layer (using the `roundTo` helper).

## Thresholds
- **Score (0-25)**: Low `< 5`, Medium `< 10`, High `< 17`, Critical `17-25`.
- **Overall (0-100)**: Low `< 20`, Medium `< 40`, High `< 68`, Critical `68-100`.
- *Note*: Floating point noise (e.g., `4.999999999`) is safely normalized to its intended boundary via rounding to 9 decimal places before threshold evaluation.

## ABC University Worked Example
Given a "Data Breach" threat scenario:
- **Inherent Likelihood**: 4
- **Inherent Impact**: 5
- **Inherent Score**: 20 (Critical)

**Applied Controls**:
- RBAC (Likelihood, 0.30 effectiveness)
- MFA (Likelihood, 0.25 effectiveness)
- Access Monitoring (Likelihood, 0.10 effectiveness)
- DB Encryption (Impact, 0.20 effectiveness)

**Calculations**:
- *Residual Likelihood*: `4 × (1 - 0.30) × (1 - 0.25) × (1 - 0.10)` = `4 × 0.70 × 0.75 × 0.90` = **1.89**
- *Residual Impact*: `5 × (1 - 0.20)` = **4.0**
- *Residual Score*: `1.89 × 4.0` = **7.56** 
- *Level*: **Medium** (since 7.56 < 10)

## Limitations
1. **Qualitative Foundation**: The initial 1–5 scale is subjective; the outputs are only as accurate as the inputs.
2. **Subjective Effectiveness**: Control effectiveness percentages are estimates, not empirical statistical probabilities.
3. **Control Independence**: The engine assumes controls are perfectly independent and their effects compound cleanly. In reality, controls often overlap.
4. **Averages Hide Extremes**: The `summarize` function's `overall` metric averages out risks. A dashboard with one Critical risk and fifty Low risks will show a Low overall average, which can be dangerously misleading without looking at the `max` score or severity counts.
