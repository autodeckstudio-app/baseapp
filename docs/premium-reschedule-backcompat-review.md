# Premium reschedule request - stored-state backcompat review (preview, not activated)

Scope: bookings written BEFORE the premium reschedule request flow existed carry
no `rescheduleRequest`, `rescheduleRequestCount`, or decision fields. Activation
must not break them, and no data migration may be assumed. Reviewed against the
current tree; conclusion: **no migration needed**, every reader tolerates absence.

## Stored-state additions (new fields, all optional)

- `Booking.rescheduleRequest?` (object): requestedDate/requestedTime/requestedAt/
  status/baseScheduledAt/idempotencyKey (+ decidedBy/decidedAt/decisionNote/
  decisionIdempotencyKey after a decision). Written only by
  requestBookingReschedule / decideBookingRescheduleRequest.
- `Booking.rescheduleRequestCount?` (number). Absent = 0 everywhere it is read.

## Reader audit (absence tolerance)

- `apps/customer/src/lib/booking-rules.ts` (`rescheduleEntry`): `req?.status`
  and `(count ?? 0)` - legacy booking (both absent) evaluates to mode
  "request" for premium / "direct" otherwise, i.e. pre-feature behavior.
- `apps/customer/.../bookings/reschedule.tsx`: same `?? 0` / `?.` pattern.
- `apps/admin/src/components/BookingPanels.tsx`: request section renders only
  when `booking.rescheduleRequest` exists; customer note reads `note`,
  decision reason is stored separately in `decisionNote` (never overwrites).
- Server callables: the request flow's guards treat absent request/count as
  "no request made" (canRequestReschedule), which is the correct legacy
  reading.
- No strict zod schema parses stored Booking documents in customer/admin apps,
  so the presence of the new fields cannot break older reads either
  (Firestore documents are passed structurally, not parsed `.strict()`).
- Firestore rules: client writes to bookings are server-authoritative already;
  the new fields arrive only via callables, so no rules change is required.

## Behavioral (non-data) change on activation, by design

- Existing CONFIRMED premium bookings: the customer entry point switches from
  direct reschedule to the request flow (one request per booking). That is the
  adopted policy change, not a migration artifact.
- Wash rule (category "washing" only): 1 free move >=4h replaces 2/24h for NEW
  decisions; existing bookings keep their stored rescheduleCount and are
  evaluated against the new rule from activation. Flagged as transitional,
  not adopted-final.

## Deploy-ordering note

Clients rendering the request entry must not ship before the callables exist;
the customer UI already degrades to "contact the studio" when a booking is not
eligible, and the callables reject non-premium/legacy misuse fail-closed.
