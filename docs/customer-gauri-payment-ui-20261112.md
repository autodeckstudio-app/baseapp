# Customer Gauri payment/booking UI batch, 12 November 2026

Approved by Meet ("Yes to all", 12 November 2026) for items 1-13B; item 14 covered by Meet's standing approval for Gauri's app UI work. Refund admin-approval step (13C) was explicitly declined and is untouched: the refund workflow is unchanged.

New immutable tariff base20-road12-v3: same bands as base20-road12-v2 (up to 3000m free; 3000-5000m 2000paise; beyond 5000m 2000 + (metres-5000)*1200/1000 per independently directed leg then sum), but each leg rounds half-up to whole rupees. v2 is unchanged; existing v2/v1 quotes keep their amounts through original expiry; unknown ID fails closed. Existing bookings remain unchanged. The round-off line stays on the review.

Customer app changes: full-width Pay CTA reads "Pay <actual amount> now" without "& confirm" (held advance retries show the advance amount); duplicate amount sublines under payment options removed; payment refresh icon removed in all states (the status listener stays); pickup-time chevron vertically centered; the middle "Check pickup/drop" warning card removed (payment stays disabled until a valid quote, with the quote error shown as a caption beside the disabled choices); address field first with empty/short-address guidance and a "Check your location to see the final pickup/drop fee." note; the "A little help getting here and home." helper removed; createBooking and the payment sheet are blocked on every path when pickup/drop is selected without a full address (8+ trimmed characters) with the field highlighted; booking detail drops the floating call action; the bookings list Next-visit card carries Reschedule/Cancel as small icon buttons inside the card with the floating call/directions row removed; Original-method returns compact to Return amount, Status, and a Fee retained row only when a fee exists (cash-owed row and "Awaiting Admin approval" wording kept); Back from a booking opened from Notifications returns to Notifications.

No provider or paid routing tests. No production booking or transport record writes. No old-booking repricing. No refund execution.

Backend artifacts deployed 13 November 2026 to project autodeck-studio, region asia-south1, with only the tariff constant addition; one upload served all three functions, so the source archive and built image hashes are shared. sha256 is the deployed source archive, bundleSha256 the built image digest. Deployed revisions: createbooking-00031-qiq, getpickupquote-00004-xow, requestpickupdrop-00012-vod. The deployed bundle was verified to contain base20-road12-v3 and the whole-rupee rounding.
{
  "getPickupQuote": {
    "sha256": "89bd6b538502a84ca6d5609c76ab3928d5ebcc5ee789fcccf991b5e98baa8815",
    "bundleSha256": "a15bb169081608688ae2fcd2fa15df1e198d81b04fe3b4e51e89883cc16a64eb"
  },
  "createBooking": {
    "sha256": "89bd6b538502a84ca6d5609c76ab3928d5ebcc5ee789fcccf991b5e98baa8815",
    "bundleSha256": "a15bb169081608688ae2fcd2fa15df1e198d81b04fe3b4e51e89883cc16a64eb"
  },
  "requestPickupDrop": {
    "sha256": "89bd6b538502a84ca6d5609c76ab3928d5ebcc5ee789fcccf991b5e98baa8815",
    "bundleSha256": "a15bb169081608688ae2fcd2fa15df1e198d81b04fe3b4e51e89883cc16a64eb"
  }
}
