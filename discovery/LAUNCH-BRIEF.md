# REG Discovery — GTM launch brief (DRAFT, not a deployed website)
Updated: 2026-10-21
Product issue: https://github.com/skiredj-prog/reg-conformance/issues/37
Technical draft: https://github.com/skiredj-prog/reg-conformance/pull/38
Tracking: https://github.com/skiredj-prog/tenir-reg-demo/issues/1

## Positioning
REG is an **on-demand assumption-discovery service**, optionally embeddable. Never call it a mandatory governance layer, an implementation audit, a legal compliance checker, a certification or a deployment authorization.

### Hero (English)
**REG — Beyond the checklist.**
**Your policies describe what should happen. What are they quietly assuming?**
Select the frameworks you're using. Discover the hidden conditions your expected behavior depends on.
CTA: **Reveal the hidden assumptions** (free exploratory report; no account).
Secondary: **Challenge one real system behavior** (scoped paid service).

### Hero (French)
**REG — Au-delà de la checklist.**
**Vos référentiels décrivent ce qui devrait arriver. Sur quelles hypothèses reposent-ils ?**
Sélectionnez vos textes. Découvrez les conditions invisibles dont dépend le comportement attendu.
CTA : **Révéler les hypothèses invisibles**
Secondaire : **Soumettre un comportement à l'épreuve**

### 3-step experience
1. **Select** official, clearly classified cards (binding law / voluntary framework / management standard / recommendation; not all necessarily applicable). Selection is not a finding of applicability.
2. **Focus** (optional): What behavior are you relying on? E.g. “human can intervene before a consequential decision takes effect.” No backend, credentials, infrastructure inventory, or personal data required.
3. **Discover**: 3–5 assumption questions or contextualized conditional dependencies, how the intended behavior could fail, what to clarify, source links and limitations. Export a shareable exploratory report. **No compliance score**.

### Demonstration A (90 seconds): human oversight, too late
Input: AI Act Article 14 + NIST MAP, expected behavior “a human can stop a consequential decision before effect.”
Reveal: An interface may permit review but does the effect commit before or after intervention? What is the exact intervention window? Who owns authority?
Output: A critical *engineering inference* and candidate invariant. No legal applicability / violation asserted.
Payoff: “An approval button is not always a prevention mechanism.”

### Demonstration B (90 seconds): ambiguous commit
Input: NIST MAP + one behavioral claim “a retry cannot duplicate the external effect.”
Reveal: Operation identity across retries, provider idempotency horizon, concurrent paths, state UNKNOWN, reconciliation after lost acknowledgement.
Output: Conditionality / unresolved assumptions; no claim of unique solution, no guaranteed exactly-once behavior.
Payoff: “Your API may be idempotent. Is your business effect?”

### CTA and paid offer (experiment, not established pricing)
**Hidden Assumptions Challenge** — scoped contradiction analysis, no mandatory code/infra access. **Focused:** one behavior / one workflow / up to 3 references, 4–5 working days, **€2,500** trial price. **Extended:** up to 2 related behaviors/workflows / up to 5 references, 6–7 working days, **€5,000** trial price. Includes declared assumptions, conditional failure paths, candidate invariants, decision brief and executive debrief. Delivery begins after agreed scope and necessary information; **prices and times are hypotheses to validate commercially**, not binding quotations.
**No fabricated findings guarantee:** if no decision-relevant discovery, explicitly report the negative result and offer one additional behavior within the same agreed perimeter at no additional fee. No subjective 'no invoice unless critical defect' condition. Does NOT include infra audit, legal opinion, product certification or runtime deployment. Public one-pager: [OFFER-HIDDEN-ASSUMPTIONS-CHALLENGE-FR.md](OFFER-HIDDEN-ASSUMPTIONS-CHALLENGE-FR.md).
Optional TENIR-Gov engagement quoted separately if selected runtime controls are actually needed.

### Targeting
- Risk/compliance heads facing frameworks and new deployments: acquisition language “before the checklist, challenge the assumptions”.
- CTO/platform/enterprise architects: “what hidden assumption can invalidate the behavior at system scale?”
- Advisory/integration firms: white-label discovery *only after* contractual, source-licensing and quality review.
Do not imply all customers must use TENIR or REG software.

### 30-day GTM checkpoints
- Days 1–5: five short discovery conversations + message comprehension test; gather initial objection list.
- Days 6–12: test demos A/B with 5 engineers and 5 governance people, track whether findings change a decision.
- Days 13–21: release a **private** working preview when the technical source contracts and anti-overclaim gates pass; invite 10 qualified contacts without scraping.
- Days 22–30: propose 1–2 paid challenges. Track qualified intent, objections, pricing, *false positives*, and cases where REG added nothing. No fabricated conversion claims.

### Funnel (aggregate events only)
Landing viewed → source selected → behavior described (optional) → first report viewed → exported → challenge requested → qualified meeting → paid proposal → paid pilot.
Optional client descriptions **must stay local to browser by default** until explicit consent and data handling terms exist.

### Release gate
- Credible official source links, scope/law classification, no copied paywalled ISO content or unlicensed CSA mapping.
- No claims of `compliant`, `demonstrated`, `certified`, `safe`, or `approved` for exploratory selection.
- Accessibility + bilingual checks, offline HTML preview, no broken external links, correct generated report.
- No site deployment, no public badge, no usage telemetry without consent, no production automation until explicit authorization.
