# Retained transport list integration: exact remaining work

Investigation only, not an implemented adapter, screen preview or current-live
pixel inspection. Repository checkpointf56c62d is the code baseline. No UI,
listener, backend rule, public collection or production route changed here.

## Current source paths

- Customer `ui/PickupCard.tsx` subscribes through `lib/pickup-service.ts` to one
  direct pickupRequests document. All CONFIRMED requests read as approved.
  Listener errors set request=null, and null renders nothing: missing transport
  and unavailable transport are currently indistinguishable.
- Admin `app/(admin)/pickups/page.tsx` subscribes through `lib/pickup-service.ts`
  to tenant pickupRequests and separately to a capped bookings list. Tabs/counts
  use raw REQUESTED/CONFIRMED/DONE/DECLINED. Listener error sets rows=[] with an
  alert. Booking state annotates legacy closure eligibility, not retained proof.
- Studio `app/(tabs)/pickups.tsx` subscribes to studio requests and per-booking
  changes. It filters active/history by raw status before legacy eligibility,
  so a retained request on cancelled booking is hidden from actionable lists.
  Error/loading and principal/generation guards already exist and must survive.
- All three mutation controls still call legacy updatePickupRequest, whose
  closed-booking/billed-transport guards must not be relaxed to accommodate a
  new read projection. Read state is not execution permission.

## Staleness trap

Explicit private closure currently writes closure+retention+carVisits revision,
not original pickup request or booking. carVisits/private proof collections have
no direct-client read grant (default deny). A new callable overlay fetched only
when the existing request or booking listener fires would not refresh after
closure. A fresh server result during one load is not a live lifecycle.

Do not add a staff note, fake completion or changed request status just to wake
listeners: closure binds the exact request hash. Do not expose private closure
or weaken rules to let clients subscribe to original finance evidence.

## Preferred next local path

Use the existing scoped booking as a minimal revision signal, not a second copy
of physical truth: write a bounded explicit transport-read revision atomically
with closure and bind its exact visit/request identity. No money/status/fee or
request field changes. Customer needs a scoped booking listener too; Studio's
existing per-booking listener already invalidates on any booking change. Admin
must use each visible request's actual booking rather than depend on a capped
recent-bookings list. The revision is a cache invalidator, never closure proof.
Actual disposition always comes from the authenticated full source reader.

Before choosing this field, qualify that booking source hashes/issued reads
remain unchanged and no consumer interprets it as a financial/work transition.
The actual local adapter must subscribe before its initial fetch, invalidate
while fetching, drop out-of-order results, reset on principal/tenant/studio/
booking change, unsubscribe on unmount and never retain a ready result under
another principal. Latest failed read is unavailable, not empty or history.

A visit identity must be resolved from the exact original request/booking. A
single-visit query repeated for every row cannot silently truncate list state:
use a bounded server batch that verifies each requested row, with explicit
no-retention versus unavailable distinctions and no partial green list. Do not
interpret an unavailable retained row as a normal legacy request. Lists and
counts must be derived from the same verified disposition result.

## Required qualification before visible integration

- Closure in another open surface triggers refresh even when request untouched.
- Pending closure, failed overlay, missing marker, deleted invoice and duplicate
  visits cannot disappear into empty lists or false completed history.
- Needed future drop on cancelled anchor stays visible, but legacy confirm/
  decline/DONE actions cannot become enabled through read-only placement.
- Closed-unused row moves to truthful history without DONE or a drop stamp;
  actual completed row remains distinguishable from unused closure.
- Live principal switch, request switch, unmount, overlapping loads and late
  rejected responses cannot leak or overwrite the current audience's state.
- Customer, Admin and Studio source/mounted suites plus direct-rule and server
  scope tests pass. Full affected read/write/report regression remains required.

Then capture current-live before pixels and exact navigation, build the real
routed local after pages at320/390/1280in existing shell/theme and inspect all
pixels. Keep labels short, no paragraphs, no layout redesign. Propose final
status labels/count placement/action treatment together; a test helper or this
plan is not owner visual review. No visible integration/live deployment before
that gate. Hosted r5 remains unchanged and undelivered.

Broader unsupported retained funding/final-fee/online/tax, benefit-extra slices,
provider activation and combined connected preview remain separate open work.
No owner business-policy question was found in this investigation; the next
step is engineering plus the already-required visual gate, not an invented
approval request or permission to release.
