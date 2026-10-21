# Two market demo scripts (90 seconds each; no fictional customer proof)

## A — When oversight arrives too late

**0–15s**: Open REG Discovery. Select **EU AI Act Article 14** and **NIST AI RMF MAP**. Frameworks are labeled: law vs voluntary.
**15–30s**: Enter: “A human can stop an automated credit-related decision before its consequences occur.”
**30–55s**: REG asks: “When does the external effect become irreversible? Does the human approval happen before that point, or after?”
**55–75s**: Show failure path: approval UI can exist but be after-effect. Show candidate invariant as an *engineering hypothesis*, not a legal requirement, plus applicability unknown.
**75–90s**: CTA: “Want us to challenge one claim in your actual workflow? Request a Hidden Assumptions Challenge.”

Objections to welcome: “Our approval is synchronous”; “Article 14 isn't in our scope”; “You're guessing our architecture.” Treat each as a chance to **narrow** or **close** the finding, not to sell more.

## B — When a retry repeats a business effect

**0–15s**: Enter expected behavior: “Retries cannot charge the customer twice.”
**15–35s**: REG surfaces adjacent questions: Stable identity across retries? Multiple execution paths? External provider retention horizon?
**35–55s**: Show lost acknowledgment: client sees UNKNOWN, but provider may have committed.
**55–75s**: Explain: local idempotency is not enough to substantiate end-to-end exactly-once. Show condition and counterexample possibility.
**75–90s**: CTA: “Challenge your assumptions before you rely on the guarantee.”

Objections to welcome: “Our provider guarantees idempotency”; “We reconcile”; “Our request identity is already stable.” Ask for exact boundary/horizon, not an infrastructure audit.

## What qualifies as success?
The viewer can name an **actionable question they had not asked**, says which decision might change, and is willing to share one redacted behavioral claim to test.

## What disqualifies the demo?
Generic AI ethics summary, fabricated regulatory obligation, ungrounded claims of actual defects, product installation requirement, implied certification, or a presentation that only counts how many policies were selected.
