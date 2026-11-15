# Pickup/drop: one booking total

Private implementation plan, 9 November2026,14:27 IST. No provider, flag, production record or release effect.

Current checkpoint16:52: the original proportion question below is RESOLVED as customer-selected20% orfull combined total. Combined booking/settlement/return implementation progressed in the cumulative private source; the older dependency map is historical, not a current task list. Pending-link cancellation, transport adjustments, benefits/custom quotes and real provider/native/connected acceptance remain open. FlagsOFF; no release.

## Original latest intent

14:24 WhatsApp asks for Pickup, Drop-off and Both in one row, short attractive explanation not led by a charge.14:25 voice asks selected pickup/drop to be included in the online service charge and final bill rather than a separate studio-only payment. Whether online means20% of the combined total or full combined total is awaiting the owner's explicit answer.

## Implemented presentation delta

PickupOptions is mounted in booking review. Three equal buttons stay on one line,48px height,8px gaps, labels intact at320/390/1280 light/night using actual shared glass and theme. After the owner rejected the first preview as unpolished, all three labels use the same Inter600/14px/20px metrics and centered baseline; selection changes the rim, never weight. Selection still calls the existing choosePickupKind handler, including deselection and stale-quote clearing.

Copy: "A little help getting here and home." Selected disclosure: "First 3 road km free each way, then ₹25 per extra km. Your confirmed price is included in the booking total."

This is not completion of online billing. The current page already adds the quote to its displayed total, but the existing backend snapshot is not updated until later staff pickup acceptance. Old studio-only copy elsewhere must change with the coordinated financial implementation, not be left contradictory.

## Current dependency map

- getPickupQuote stores current customer/tenant/kind/location, distinct directional road legs, exact fee and30-minute expiry. Request-time quote is consumed under transaction checks. No new routing/price should be computed silently after customer consent.
- createBooking currently has no selected pickup quote payload. The client creates booking, sends requestPickupDrop separately, then opens checkout. A pickup-request failure currently does not fail booking.
- pickupRequests staff acceptance currently applies fees to job and booking via applyPickupFees only when not locked by payment/invoice. A customer paying first can lock the old service-only snapshot and leave transport unbilled. This needs an atomic combined snapshot, not a display-only fix.
- initiatePayment charges server job.totalAmount, never a client amount. Preserve that boundary. The reviewed exact total/revision should also be checked before opening a provider link.
- invoice-builder already creates pickup and drop line items when the snapshot includes them. It should continue to produce one invoice, not a second transport charge.
- advancePreviewFromParts and server advance-payment currently deliberately exclude pickup/drop from the20% basis. Both need the same final owner decision. Do not change one side first or infer full-payment approval.
- The old legFees(kind,total) splits Both equally; new atomic preparation must retain the quote's actual per-leg amounts. Opposite road directions can differ, so preserving only a combined amount is insufficient for exact pickup/drop cancellation/refund attribution.

## Safe implementation sequence after the policy answer

1. Add an optional selected-transport intent with quoteId, exact reviewed expected amount/revision, address and requested pickup time to createBooking. Preserve no-transport old clients; reject stale partial coordinates, wrong customer/tenant/kind, expired/consumed quote and mismatched amount.
2. Transactionally read the quote and identity alongside booking guards. Bind/consume it to the exact created booking and pickup request. Include exact per-leg fees in the single immutable priceBreakdown before checkout. Exact idempotent retry returns the same booking, never consumes/creates another transport request.
3. Compute one tax/discount snapshot from the existing studio rule; do not add a second tax or silently replace the shown quote. Check what quote fees represent in the review total against actual tax composition, and re-review on a changed grand total.
4. Derive full-online or20%combined from that same snapshot, according to the owner's answer. Keep activation OFF. Preserve existing service-specific gift/membership/quote exceptions and free pickup entitlement without granting a benefit twice.
5. Update later staff accept/decline to avoid double billing the already attached quote. A refusal after collection needs a grounded return/owed balance, not mutation of a paid invoice. Do not invent a new refund policy.
6. Reconcile client review, held-payment retry, payment sheet, booking detail, pickup card, final invoice, admin/staff amounts and cancellation/no-show/refund association. No screen should still promise separate studio-only transport while online checkout includes it.
7. Add focused emulator/race tests: asymmetric Both legs; free boundary; exact quote expiry/replay/scope; simultaneous duplicate booking; provider initiation after price revision; staff accept retry no double fee; decline before/after payment; covered/member/quote flows; cancellation/full-refund mapping and exact invoice lines. Visually check itemized total/advance/balance labels at narrow widths. Real provider/device acceptance remains separately held.

This plan is prep, not approval of missing commercial terms or cancellation changes. Existing rule/policy authority must be preserved except for the explicit new online inclusion and the owner's pending choice.

14:28 owner expressly includes typography/alignment correction in the next deploying batch. This is batch inclusion, not a separate release or resolved advance/full-payment choice.14:30 qualification: all89customer mounted files/254tests pass, customer types/lint and real web export pass after scoped typography changes.
