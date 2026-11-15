# Funded visit service cancellation: local, dormant

This is a local implementation checkpoint, not release approval. No production
route imports `visit-service-cancellation.ts`. No provider transport, callable,
refund approval or outbox activation is added.

The writer consumes an exact saved original-method review, with the same Admin,
tenant, operation, reason and explicit cancellation confirmation. It checks the
review again in the cancellation transaction before any writes. The supported
slice is a funded, non-benefit service without a physical transport request. An
outstanding policy fee is still held rather than disappearing from the bill.

The transaction cancels only that service and booking, increments the physical
visit revision and creates one private `visitServiceReturns` record. Its status
is `awaiting_admin`, including on an exact lost-response retry. It does not mean
Admin approved a refund or that money was returned. Concurrent sibling removals
cannot both claim the same no-fee sibling waiver.

Original payments, receipt applications, shared receipts and issued invoices stay
unchanged. The billing reader separately checks the saved review and the exact
original financial evidence before accepting a cancelled funded member. The
internal `returnReviews` projection keeps its original funding, retention,
awaiting-approval amount and zero returned amount separate from the sibling's
collectible balance. It is not yet connected to the visible Admin/Customer UI.

Remaining before a connected release:

- Original-method Admin approval and return execution, including one global
  online capture's separate service applications, reconciliation and retries.
- Explicit retained transport and unused-leg decisions. This writer refuses any
  target physical request and never calls the single-booking restore shortcut.
- Benefit/gift cancellation and outstanding cancellation fee settlement.
- All affected live baselines, complete routed before/after visual review and
  owner approval. No UI copy or layout is changed by this slice.

The recovery distinction in `recovery-state.md` remains unchanged. This work is
new local engineering after qualified recovery, not recovered old git history.

Current local verification: Functions types and build pass. The full real-Firestore
billing file passes 170 tests, including 17 new cancellation cases; private-money
rules pass 85 tests. This is transaction evidence, not pixel verification.
