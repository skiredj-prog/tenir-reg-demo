# Hidden Assumptions Challenge — economic value model (pilot, NOT a proven ROI)

**Purpose:** discover buyer-specific willingness-to-pay and calibrate pricing using counterfactuals, not fabricated avoided incidents or copied audit benchmarks. Never say "REG saved €X" unless a customer-verified post-decision intervention and attribution supports that statement.

## Four distinct units — do not mix them

1. **Exposure:** A possible incident costs €X **if** it happens. This is not an annual expected loss or REG benefit.
2. **Expected reduction:** A client estimates baseline probability p, and the fraction q of that exposure it may actually remove **after** implementing a mitigation prompted by the Challenge. `p × q × X` is an illustrative expectation, not audited risk reduction.
3. **Operational value:** Avoided *incremental* rework / elapsed approval cycle bottlenecks evidenced by the client's own workflow (hours and attributable contribution margin, not unqualified delayed revenue).
4. **Total engagement cost:** Challenge fee + buyer effort + remediation/verification, not the fee alone.

`Expected gross benefit = (p_incident × mitigation_fraction × incident_impact) + (avoided_rework_hours × loaded_hourly_cost) + validated_incremental_contribution`

`Total cost = Challenge fee + remediation_cost + client_hours × loaded_hourly_cost`

`Illustrative net value = Expected gross benefit − Total cost`

`Illustrative ROI = Illustrative net value / Total cost` (only if total cost > 0).

**Attribution gates:** The premise must be (a) newly surfaced or materially clarified by REG, (b) relevant to the stated global behavior, (c) accepted by the buyer, (d) trigger an actual mitigation or decision change, and (e) have independently estimated incremental benefit. A discovered condition alone earns no "avoided loss."

## Three sensitivity cases — illustrative assumptions, NOT industry benchmarks

| Input | MIN | REGULAR | HIGH |
|---|---:|---:|---:|
| Impact *if* event occurs | €10,000 | €30,000 | €100,000 |
| Assumed incident probability (next 12 months) | 10% | 20% | 15% |
| Assumed risk fraction reduced by action | 50% | 50% | 50% |
| Expected avoidable exposure | €500 | €3,000 | €7,500 |
| Attributable rework avoided | 4h × €125 = €500 | 12h × €150 = €1,800 | 30h × €150 = €4,500 |
| **Illustrative gross benefit** | **€1,000** | **€4,800** | **€12,000** |
| Challenge fee | €2,500 | €2,500 | €2,500 |
| Remediation + client effort | €1,000 | €1,300 | €3,500 |
| **Total cost** | **€3,500** | **€3,800** | **€6,000** |
| **Illustrative net value** | **−€2,500** | **+€1,000** | **+€6,000** |
| **Illustrative ROI** | **−71.4%** | **+26.3%** | **+100%** |

This table intentionally includes a **negative return**; it must not be published as observed impact. Risk incidence, mitigation efficacy, costs, and time savings are entirely arbitrary teaching inputs.

Original draft arithmetic: emergency engineering 15h × €150 = €2,250; direct loss €3,000–€10,000; support €1,000 ⇒ **€6,250–€13,250** conditional incident impact, not €5,000–€7,500 in REG savings.

## Quick break-even test

For **impact L** and **mitigation share q**, and absent independently validated time savings:

`break_even_probability = total_cost / (L × q)`

Example: €2,500 fee + €1,000 remediation/effort = €3,500; L=€20,000; q=50% ⇒ 35% chance in the stated horizon needed just to break even. This is not an estimate that a customer faces that likelihood. If the threshold exceeds 100%, prevention alone cannot justify the proposed spend under those assumptions.

## Why we do NOT price against regulatory fines

GDPR Article 83 sets **legal ceilings**, not expected fines; Article 22 applicability / violation is not determined by selecting a card. The EU GDPR's higher maximum is **up to €20m or 4% of total worldwide annual turnover, whichever is higher**, for relevant tiers. An exploratory structural hypothesis challenge cannot claim it prevents a regulatory breach or reduces a fine. This category is an unpriced strategic/risk consideration unless the client and qualified counsel provide a causal, legally scoped model.

Sources:
- EU GDPR (official EUR-Lex): https://eur-lex.europa.eu/legal-content/FR-EN/ALL/?uri=CELEX%3A32016R0679
- European Commission on GDPR enforcement: https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/enforcement-and-sanctions_en
- Forrester Total Economic Impact conceptual framework (cost, benefit, risk): https://www.forrester.com/policies/tei/
Forrester's methodology is context, **not a Forrester endorsement of REG**.

## Minimum buyer interview (4 questions)

1. **What exact behavior is your team relying on, and what goes wrong if it fails?**
2. **Have you measured similar incident and remediation costs, or are they estimates?** Request internal incident ticket IDs *not confidential contents*, if available.
3. **What decision would change if REG finds a critical adjacent assumption? Who would implement that change?**
4. **If a scoped Challenge helped you resolve this before rollout, what spend could you authorize without new procurement?**

Record inputs as `Observed`, `Client estimate`, `Consultant scenario`, or `Unknown` for each line. A buyer's willingness to pay is evidence about **price**, not evidence about avoided incidents.

## Post-Challenge evidence ledger

| Field | Required evidence |
|---|---|
| Claimed system-level behavior | Signed-off behavioral statement and boundary |
| Previously unexamined assumption | Before/after discovery notes, acknowledgment by technical owner |
| Decision affected | Written go/no-go / architecture ADR update / mitigation ticket |
| Implemented change | Owner, date, status; do not count if not implemented |
| Measured outcome | Ticket/metrics, actual rework hours or independently reviewed probability model |
| Attribution and uncertainty | Counterfactual, other simultaneous changes, review date, caveats |

Publishing an anonymized case study requires explicit client approval. **No fabricated ROI, "typical savings", average incident cost, 72-hour timeline, or equivalence to 4–8 week certification/audit.**

## Positioning usable in a sales call (no numeric guarantee)

"**The costliest failure may come from an assumption nobody thought to challenge.** For a fixed, scoped fee, REG pressure-tests one behavior, identifies the conditions it relies on, and tells you exactly what to verify before you commit. We quantify the potential decision value together using *your* data — not hypothetical industry averages."

**Pricing remains experimental:** €1,500 Express (smaller scope); €2,500 Focused; €5,000 Extended. No country-based price discrimination for identical work. REG standalone service; TENIR integration is optional and separately contracted.
