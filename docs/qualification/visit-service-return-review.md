# Service cancellation return review

Local candidate only. No provider call, production route or deployment.

The internal original-method review resolves only the selected service's share of verified money. Cash and online applications retain their original receipt/payment identities. A continuing booked service means zero cancellation fee. The last service uses the existing policy window. Retained money is capped at actual funding, with any remaining fee due shown separately. Sibling service money and issued invoices are never rewritten.

The new review-only journal stores an immutable actor-scoped snapshot and exact reason after the entire review token matches. Exact retries recover the same snapshot. A snapshot is not a booking cancellation, refund approval, return request, collection lock or promise that the review is still current. The eventual execution transaction must reread the saved command and the entire current original-method proof before any writes, and must still use the existing Admin refund approval. No executable return adapter exists yet.

Current qualification: all 144 connected billing emulator tests pass, including nine new journal cases. These cover exact retry, concurrent preparation, no financial/booking effects, stale source and policy-window rejection, foreign tenant/actor/role, malformed commands, corrupted stored funding, map-key reordering and changed owner/benefit/transport. All 78 private-money rules tests pass after adding this collection to the tested default-deny list. Functions typecheck passes. No UI or routed pixels changed in this slice.

Still outstanding: approved return execution and reporting, stale-review recovery in an actual control, retained needed transport and explicit unused-leg review, benefit/zero-price acceptance, provider production adapter under activation hold, complete combined visual review and release approval. These are part of the unfinished connected-visit outcome, not optional extensions.

## Covered-service acceptance

The connected billing review now calls the existing consumed-membership linkage and exact original zero-invoice validators instead of trusting only a paid flag and membership ID. A real membership-covered zero settlement plus a normal paid sibling passes the combined original-invoice/receipt path: only the paid sibling enters the new cash application and shared invoice; no membership use, original zero invoice or fake payment is changed. Missing/changed consumed usage, replaced invoice, unpaid booking and restored benefit all hold the review. All 153 connected billing emulator tests pass, including six new covered-service cases. Gift and benefit cancellation remain separate unfinished paths; this does not authorize reusing or restoring credits.
