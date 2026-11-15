# Original service refund protocol, local and dormant

RazorpayVisitRefundProtocol implements the existing injected return port. It
has no global network transport, credential lookup, provider factory, callable,
scheduler, webhook registration or production import. Construction does nothing.
It cannot activate a refund by itself. No actual provider request was made.

The existing transaction runner commits submitting before its one create call.
The protocol includes the exact positive original-source amount, normal speed,
the durable vor_ receipt and the same X-Refund-Idempotency key. It does not send
customer contact, internal notes or a fabricated sibling booking identity. Even
a create response saying processed yields only a candidate ID. The independent
GET must supply the actual refund entity, payment, amount, INR, exact receipt and
pending/processed/failed state. Notes, acquirer data and embedded payment values
never fill a missing identity, amount, currency or receipt. Only the runner's
existing exact processed proof can recognize actual returned money.

Discovery is one GET scoped to the original payment, count=100 and skip=0. The
collection count must match the actual rows. Duplicate refund IDs, a foreign
payment, unknown pagination fields or malformed rows hold. A full page is
incomplete and causes no follow-up paging loop. A shorter page can provide one
exact candidate, independently fetched afterward. An empty, ambiguous or
incomplete page NEVER proves absence, releases the reservation or permits a
second submit. The provider's current list freshness is not an absence grant.
409, throttling, errors and lost responses also hold. Pending and failed do not
release or manufacture returned money. There is no automatic retry here.

Official contracts inspected on 15 November 2026:
- https://razorpay.com/docs/us/api/refunds/create-normal
  Explicit amount is required locally even though the provider permits its
  omission to mean full refund. The provider receipt is the merchant reference.
- https://razorpay.com/docs/api/refunds/normal-refunds-idempotent
  X-Refund-Idempotency permits letters, numbers, hyphens and underscores with a
  minimum length of ten; unchanged payload/key required. Provider retry support
  does not relax this runner's stricter one-submit rule.
- https://razorpay.com/docs/us/api/refunds/fetch-with-id
  GET /v1/refunds/:id provides the independently read refund entity fields.
- https://razorpay.com/docs/us/api/refunds/fetch-multiple-refund-payment
  The payment-scoped list defaults to ten; count max100 and skip are documented.

The documents did not establish a maximum receipt/idempotency-key length. The
adapter preserves the existing 68-character durable reference exactly rather
than silently truncating, aliasing or inventing a new identity. This length and
provider acceptance still need explicit validation before activation. There is
no real-provider success claim. A provider rejection stays held, never retried.
The injected HTTP transport, authenticated factory, signed-event routing and
production integration remain unfinished and held. No credentials or payment
methods were accessed. No UI, copy, issued invoice or historic record changed.

Qualification: 45 protocol units plus35existing visit-provider units and19ledger
units pass. Nineteen new real-Firestore connected protocol cases pass through
reservation, committed submit, raw response decoding, independent fetch, return
state and report recognition. They cover processed, pending, failed, wrong/missing
fields, lost response, empty/full/duplicate/conflicting discovery,409/429/500,
exact retry and unchanged original invoice. Functions type check passes. Wider
current-tree regression is pending at this checkpoint. Actual routed combined
owner preview is still required before live changes.

Follow-up regression: see current-local-checkpoint-2026-11-15.md. All329billing
cases and286connected/privacy/Accountant/legacy-owed cases pass on d732917.
