# Multi-service booking tray: plan (DRAFT, nothing built yet)

Goal: a customer picks several services for one car, sees one tray, one slot, one price, one booking.
Today: a booking has exactly one `serviceId` (packages/core/src/types/booking.ts), one `PriceBreakdown`, one bay, one `durationMinutes`.
Existing building block: job approvals already add a service to a running job (ApprovalRequest). The tray reuses its price and time maths.

## Data model (additive, old bookings keep working)
Booking gets `lines?: BookingLine[]` where BookingLine = { serviceId, name (snapshot), unitPrice (paise snapshot), durationMinutes (snapshot), requiredBayType, priceOnRequest }.
- `serviceId` stays and equals lines[0] (the primary), so every old reader, report and job keeps working.
- `lines` absent or length 1 means a normal booking. No migration.
- PriceBreakdown: `addOns` already exists and is empty. Lines 2..n go there (id, name, price). subtotal, tax, total already derive from it. No new money fields.
- `durationMinutes` = sum of line durations (+ one buffer, not one per line). `estimatedEndAt` follows.
- Invoice lines are built from the lines, so "first + N more" display is unchanged.

## Server
- createBookingSchema: `serviceIds: string[]` (1..5) replaces single `serviceId` (accept both for old app builds).
- createBooking: load all services, same tenant and active; vehicle category price per line via calculatePrice; sum into one breakdown; one idempotency key.
- Bays: allowed only when all lines share one bay type, or the slot is found for the longest chain in one bay. Mixed bay types (wash bay plus garage) is NOT booked as one slot in v1: the tray shows "Book these separately".
- Price-on-request lines: a booking with any such line becomes a quote booking (quoteStatus requested); priced lines are shown but the total waits for the quote.
- Membership: wash credit applies to ONE wash line only (the primary wash). Percent discount, if any, applies to the whole subtotal. No double credit use. Gift: single gift wash line only; gift plus extras is blocked in v1.
- Pickup fee: once per booking, not per line. GST off stays (tax 0).
- Priority hold and Platinum slot: unchanged, applies to the booking.
- Availability: getAvailability takes the summed duration (`durationMinutes` or `serviceIds`).
- Job creation: one job per booking, primary serviceId, the other lines carried as `jobLines` so the studio sees the full list. Studio board shows "Service + N more".
- cancel/reschedule: unchanged (booking-level).
- Guardrails: unit tests for price sum, tax 0, duration sum, single-credit rule, mixed-bay rejection, quote path, old single-service payload still works.

## App (customer)
- Service detail: "Add to tray" next to "Book now". A slim tray bar (count and total) above the tab bar, only when the tray is not empty.
- Tray screen: lines with remove, one total, car picker, then the existing slot and confirm screens with the combined duration and price.
- Rules in the tray: same car for all lines; max 5; mixed-bay and gift blocks show a plain reason.
- Confirm screen: one price card, lines listed, single total (as built for confirm today).
- Bookings list and detail already render "first + N more" from invoice lines.
- Tests: tray reducer (add, remove, dedupe, cap), mixed-bay rule, total equals server maths.

## Order of work
1. core types + schema + pricing helper + tests (local).
2. createBooking, getAvailability, job carry-over + tests.
3. Customer tray UI + tests.
4. Studio board shows lines (small).
5. Deploy only on Meet's go with the function list sent first; test on the TEST customer only.

## Open decisions for Meet (defaults assumed, flagged)
1. Mixed wash plus garage in one visit: default NOT allowed in v1 (separate bookings).
2. Membership wash credit on a tray: default one wash credit on the first wash line; extras paid.
3. Gift wash plus extras: default blocked in v1.
4. Max lines per booking: default 5.
