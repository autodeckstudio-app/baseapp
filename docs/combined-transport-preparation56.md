# Combined transport preparation, private and inactive

Current checkpoint 16:52, 9 November 2026. This is a historical preparation note. The old unresolved statements below do not describe current implementation. Customer choice is now 20% or full combined total. Atomic booking and directed transport snapshots, advance/balance/cash reconciliation, single invoice allocation, separate original-method return approval and actual cash-return records are implemented privately and locally tested. Bigger-service late cancellation uses service including GST, excluding unused transport, under the owner's 16:43:44 approval; no-show keeps its independently approved service-only basis. Pending-link waiting cancellation, transport-only decline adjustments, benefits/custom quotes and provider/native/connected acceptance remain open. Flags remain OFF. No release or real financial action.

## Historical preparation record


Current checkpoint16:12: owner choice resolved15:26 as customer-selected20% orfull combinedservice+selectedtransport. Private implementation remainsinactive; neither flags nor production money/provider/scheduler activation changed. Core amounts, atomic create seam and clientconfirm are wired; verified advance+balance, receipts, oneinvoice allocation and service-only noShow private qualification progressed. Cancellation/refund accounting, transport adjustment, membership/gift/customquote paths, actual signed provider/native/connected acceptance remain open. Earlier unresolved statements below are historical source findings, not current decision gaps.


This file records source-grounded integration work, not adopted payment/refund policy or completed combined online billing. The owner wants transport in the online service/final bill. The unresolved proportion is20%of combined total versus fullcombined online. No production data, payment, publish or deployment was performed.

## Confirmed source paths and gaps

- `functions/src/functions/booking/pickupQuote.ts`: customer-owned30minute server quote, separate directed pickup/drop legs with road metres, aggregate fee and consumption marker. The road tariff already exists. A quote is not a booking.
- `functions/src/schemas/booking.ts`: strict createBooking input has no transport quote/address. `createBooking.ts` builds service/membership/gift snapshot and writes identical breakdown to booking/job in one transaction. Transport currently happens after this commit through a separate client request. Therefore booking and transport can disagree or partially succeed.
- `pickupRequests.ts`: validates/consumes a quote, saves request aggregate fee, but does not preserve directed legs. Confirmation later invokes `legFees(kind,total)` which divides both equally. Asymmetric road fees are lost in accounting even though the aggregate stays equal. Transaction recheck only tests consumed marker, not every earlier quote condition.
- `lib/pickup-fee.ts`: absolute fee replacement, recomputes tax using snapshot's own rate and preserves service membership discount. Reapplying same amounts is idempotent. No new tax rule required or invented by this preparation.
- Existing pickup update deliberately refuses repricing once invoice/payment/offline receipt/job finality locks exist, and flags unbilled fee. Combined prepayment cannot safely reuse this late mutation as its first billing step.
- `lib/invoice-builder.ts`: emits distinct pickup/drop lines from job snapshot. Correct atomic per-leg snapshot lets invoice read rather than recalculate distance.
- `functions/payment/initiatePayment.ts`: uses immutable job.totalAmount and rechecks it before creating pending payment. Existing service-only job total is why changing display alone cannot charge combined total.
- `requestAdvancePayment.ts` and `lib/advance-payment.ts`: deterministic payment identity and displayed-amount guard exist, but current policy explicitly excludes transport from20%basis. Flag remainsfalse. This policy cannot be silently reused for the owner's new combined intention.
- Customer cancel path uses booking.totalAmount for cancellation bands. Refund outbox reserves only captured/refundable amounts and production reservation remains held. Adding transport to total must not silently change cancellation-fee/refundable transport policy.

## Prepared seam

`lib/booking-transport-snapshot.ts` is pure and UNIMPORTED by callables. It binds server-read quote to tenant/customer/kind/pin, rejects unknown consumption/invalid expiry, requires exactly selected directed legs, reconstructs each existing tariff fee from stored road metres, verifies aggregate/road totals and returns a detached immutable snapshot. It never selects payment proportion, member-free pickup, cancellation treatment or refund amount.15focused tests pass, including asymmetric25+50, ownership/kind/expiry/replay, duplicate/missinglegs, malformed totals, andfree distance.

## Reversible integration sequence, not executed

1. Add an optional versioned transport reference/address to createBooking and the client request. No client amount is authoritative. Bind reviewed expectedtotal or snapshot digest so a changed quote cannot charge unseen money.
2. Inside the existing booking transaction read canonical owner/studio/car/service/credits and server transport quote before writes. Revalidate every quote condition in that transaction. Consume/bind quote, create transport request, and create booking/job using one exact breakdown. Same idempotency key must resolve the same payload; retries must not consume twice or create a second request.
3. Carry exact directed leg fees plus quoted/charged state separately. Preserve old records and routes. Staff acceptance updates logistics only for already billed snapshot, not charge again. Decline/refund/transport changes use an explicit reviewed adjustment, never late unconditional reprice of paid jobs.
4. Use existing absolute fee helper with actual snapshotted tax rate and unchanged service discount. Show the server-returned canonical grandtotal, not service plusuntaxed transport guessed by the client.
5. Select the payment split only after the owner answers. Both request/display/provider/webhook receipts must bind the same selected snapshot and exact expectedamount; balance must reconcile to canonical total. No flag activation is covered by code review.
6. Exercise concurrent booking/quote replay, expiry/race, changed pin/kind/owner, asymmetric legs, zero fee, membership/gift cases, declined logistics, invoice locks, payment retry/settlement/refund/outside-return and cancellation-band effects with emulators before integration completion.

## Decisions or grants still required

Payment proportion is unresolved. Existing free-pickup membership consumption, fully gifted visits, transport cancellation/decline/refund allocation, unknown-distance selection and old-native capability behavior must be reconciled to original grants or surfaced as precise gaps, not invented from an attractive UI. Current new helper refuses incomplete legs rather than mutating historical aggregate records. Any compatibility migration needs evidence-backed handling; no historical cleanup here.

Actual linked runtime implementation remains open. A passing pure validator is preparation, not a finished atomic transaction or financial acceptance.
