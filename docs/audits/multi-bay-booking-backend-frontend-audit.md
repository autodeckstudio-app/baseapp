# AutoDeck Scheduling and Multi-Bay Booking: Backend and Frontend Handover Audit

**Branch:** `feat/autodeck-multi-bay-booking` (created from `main` @ `40a9abb1`)
**Prepared:** 28 Nov 2026, from the source in this commit
**Status:** implemented and verified against the Firestore emulator (`demo-autodeck-ci`) only. Not deployed. Emulator
results demonstrate behaviour; they do not prove production concurrency safety.

This document is a developer handover. Every contract below is quoted from source; where only backend support exists,
it says so. File paths are repository-relative.

---

## 1. Scope and approved decisions

The commit contains one interdependent scheduling workstream:

1. **Scheduling foundation**: bay occupancy model, stage planner, visit planner, per-bay-type capacity locks, physical
   bay holds, and the `bayReservations` infrastructure.
2. **Mixed-bay ("multi-bay") booking**: one booking whose services need different bay types, with one reservation per
   scheduled stage, plus availability, combined price preview, and cancellation/release handling.
3. **Duplicate-Wash prompt (S2a)**: Admin-set catalogue flags, carried through draft, review, publish and the customer
   snapshot, and consumed by the customer cart.
4. **Shared-visit restriction**: a booking with active stage reservations cannot join a shared visit.

Approved product decisions implemented:

| Decision | Implementation |
|---|---|
| Execution order = customer cart order; no Admin sequence field | `visitStages(...)` over the cart in order (`createBooking.ts`, `getAvailability.ts`) |
| Transfer time between stages = 0 minutes | `planStages({ ..., transferMinutes: 0 })` |
| Collection estimate = scheduled main work only | booking `estimatedEndAt` must equal the last stage `endAt` (asserted in `createBooking.ts`) |
| Mixed bookings cannot be rescheduled; studio coordinates | `lib/reschedule-move.ts:59` |
| Whole-booking cancellation releases all reservations; fee/refund rules unchanged | `lib/cancel-booking.ts` (central) |
| Arrived car: cancelling never frees its physical bay | `heldAfterCancelFields` + `releaseCompletedBay` |
| Mixed booking cannot join a shared visit | `visitJoinProblem` -> `'stage_reservations'` |
| Prep (e.g. PPF/Ceramic prep wash) is staff-managed, never a scheduled stage | no `prep_wash` resource; flags are prompt-only (`packages/core/src/types/service.ts`) |

Out of scope and unchanged: per-service cancellation, cancellation fee/refund policy, the 20% advance rule, delay
reporting, Firebase rules, indexes, CI and package dependencies.

---

## 2. Backend

### 2.1 Data model

**New collection `bayReservations`** (`functions/src/lib/bay-reservations.ts`, `BAY_RESERVATIONS`). Type
`BayReservation` in `packages/core/src/bay-reservations.ts`:

| Field | Meaning |
|---|---|
| `id` | deterministic: `bayReservationId(bookingId, serviceId, stageIndex)` = `${bookingId}__${serviceId}__${stageIndex}` |
| `tenantId`, `studioId`, `bookingId`, `jobId` | ownership |
| `serviceId`, `stageIndex` | the service line and its 0-based stage that own the reservation |
| `bayId`, `bayType` | the allocated bay |
| `startAt`, `endAt` | scheduled work window `[startAt, endAt)` |
| `blockedUntil` | `endAt` + the existing 15-minute turnover |
| `status` | `"active"` or `"released"` (`BayReservationStatus`) |
| `createdAt`, `releasedAt`, `releasedBy` | audit of creation and release |

**New capacity lock documents** in the existing `bayLocks` collection: `bayLocks/{tenantId}__{studioId}__type__{bayType}`
(`bayTypeLockRef` in `functions/src/lib/bay-type-lock.ts`). Per-bay locks keep their existing id
`{tenantId}__{studioId}__{bayId}`.

**New optional fields**

| Document | Field | Source |
|---|---|---|
| `bookings` | `bayReservationIds?: string[]` | `packages/core/src/types/booking.ts` |
| `jobs` | `bayReservationIds?: string[]` | `packages/core/src/types/job.ts` |
| `jobs` | `heldAfterCancel?: boolean`, `heldAfterCancelAt?: string \| null` | `packages/core/src/types/job.ts` |
| `services` | `standaloneExteriorWash?: boolean`, `includesExteriorWash?: boolean` | `packages/core/src/types/service.ts` |

Existing `services.requiredBayType` (`wash` / `protection` / `general`) is the service-to-resource mapping.

**Indexes and rules:** unchanged. Every new query uses equality filters only (`bookingId` + `status`,
`studioId` + `bayId` + `status`, `studioId` + `bayId` + `heldAfterCancel`), which Firestore serves without a composite
index. Firestore security rules were not modified; reservations are written only by Admin SDK callables.

### 2.2 Shared core modules (`packages/core/src`, exported from `index.ts`)

| Module | Key exports | Purpose |
|---|---|---|
| `occupancy.ts` | `bayOccupancy`, `isBayFree`, `isPhysicallyPresent`, `hasReleaseReceipt`, `hasPlannedConflict`, `collectionEstimate` | one model of planned reservations vs physical holds per bay |
| `service-stages.ts` | `serviceStages`, `cartStages`, `planStages`, `RESOURCE_LABEL`; `duplicateWash`, `shouldAskDuplicateWash`, `withoutStandaloneWash`, `DUPLICATE_WASH_PROMPT` | stage planning; duplicate-Wash detection from flags only |
| `visit-plan.ts` | `visitStages`, `orderVisitServices`, `occupiedFromOccupancy`, `planVisit`, `visitCollectionEstimate` | whole-visit planning in cart order |
| `bay-reservations.ts` | `BayReservation`, `bayReservationId`, `reservationsFromPlan`, `activeReservationIntervals`, `reservationsToRelease`, `isReservationBackedPending`, `collectionEstimateOnRead` | reservation model and pure helpers |
| `shared-visit.ts` | `visitJoinProblem` (new problem `'stage_reservations'`), `VisitMember.stageReservations?`, `VISIT_JOIN_STAGE_RESERVATIONS_MESSAGE` | shared-visit join guard |

`isReservationBackedPending(job)`: a `PENDING_VEHICLE` job with non-empty `bayReservationIds` counts for planned
occupancy **only through its reservations**; every occupancy reader skips its own job row to avoid double counting.

### 2.3 Functions libraries

| File | Exports | Notes |
|---|---|---|
| `functions/src/lib/bay-type-lock.ts` | `PRESENT_IN_BAY_STATUSES`, `bayTypeLockRef`, `readBayTypeLocks`, `writeBayTypeLocks`, `runCapacityTransaction`, `isClosedTransactionError`, `physicallyHeldBayIds`, `cancelledHeldJobIds`, `heldAfterCancelFields` | type locks are read sequentially in sorted order; `runCapacityTransaction` retries a transaction the emulator/server closed before commit (gRPC 3 "Transaction is invalid or closed"), bounded; `cancelledHeldJobIds` re-checks every result in memory |
| `functions/src/lib/bay-reservations.ts` | `BAY_RESERVATIONS`, `createBayReservations` (`tx.create`, so an existing id aborts), `activeReservationsForBays`, `activeReservationRefsForBooking`, `releaseReservations` | release writes `status: "released"`, `releasedAt`, `releasedBy` |
| `functions/src/lib/cancel-booking.ts` | `readCancelReads` (now also reads the booking's active reservations, only when `bayReservationIds` is non-empty), `writeCancelRestores` (now also releases them) | the single release point for every whole-booking ending (2.5) |

### 2.4 Callables and contracts

All are exported from `functions/src/index.ts`. Request schemas are strict Zod objects (unknown keys are rejected with
`invalid-argument`).

| Callable | Request (relevant fields) | Response | Behaviour in this commit |
|---|---|---|---|
| `createBooking` (`functions/booking/createBooking.ts`) | `createBookingSchema`: `serviceId`, `extraServiceIds?` (max 4), `vehicleId`, `vehicleCategory`, `studioId`, `scheduledDate`, `scheduledTime`, `idempotencyKey`, `notes?`, `membershipId?`, `giftCode?`, `payMode?`, `advanceFlowVersion?`, quote and `combinedReview` fields | `{ booking }` | Mixed cart: one booking, one job (`job.bayId` = first stage bay, `job.lines`), one reservation per stage, all created atomically. Errors: `failed-precondition` "No bays available for this service type." (a cart type has no active bay); `resource-exhausted` "No bays available for the requested time slot. Please choose another time." |
| `getAvailability` (`functions/booking/getAvailability.ts`) | `getAvailabilitySchema`: `serviceId`, `studioId`, `startDate`, `lookAheadDays?` (1-30), `extraServiceIds?` (max 4) | `{ slots: AvailableSlot[] }`; slot = `date`, `startTime`, `endTime`, `estimatedEndDate`, `startAt`, `estimatedEndAt` | Mixed cart: `mixedVisitSlots` (line 164) offers a start only when `planStages` fits every stage on a free bay of its own type, 0 transfer, future starts only |
| `calculateServicePrice` (`functions/service/calculatePrice.ts`) | `calculatePriceSchema`: `serviceId`, `vehicleCategory`, **new** `extraServiceIds?` (max 4), **new** `studioId?` | `{ breakdown, snapshot, durationMinutes? }` (`durationMinutes` only with extras); `snapshot` stays the main service alone | With extras: same helpers as `createBooking` (`extrasProblem`, `priceExtras`, `addExtrasToBreakdown`, `totalMinutes`). With `studioId`: that studio's tax and currency (`taxFor(config)`, `config.currency`). Without either: unchanged single-service behaviour. Before this commit the strict schema rejected `extraServiceIds`, so every multi-service preview failed |
| `rescheduleBooking` -> `lib/reschedule-move.ts` | unchanged schema | unchanged | Mixed booking refused: `failed-precondition` "This visit uses more than one bay. The studio will coordinate any change to it." |
| `cancelBooking`, `adminCancelBooking` | unchanged schemas | unchanged | Customer and paid/office cancels go through `runCancel` (`adminCancelBooking.ts`); both paths release reservations through the shared pair and keep an arrived car's bay held |
| `releaseCompletedBay` (`functions/job/releaseCompletedBay.ts`) | `{ jobId, confirmWorkCompleteAndBayEmpty: true }` | `{ jobId, released: true, bayReleasedAt, alreadyReleased? }` | Now also releases a `CANCELLED` job with `heldAfterCancel === true` (clears the flag). A repeat returns the same receipt. Ordinary cancelled jobs are refused. Audit `metadata.operation` = `release_cancelled_held_bay` or `release_completed_empty_bay`. Visit jobs and other-studio staff are still refused |
| `joinVisit`, `getVisitJoinOptions` (`functions/visit/`) | unchanged schemas | unchanged | A member with at least one **active** stage reservation is refused with `VISIT_JOIN_STAGE_RESERVATIONS_MESSAGE` ("This booking uses more than one bay, so it cannot join a shared visit. The studio must coordinate it separately."). Released (historical) reservations do not block. `getVisitJoinOptions` omits such candidates |
| `assignBay`, `createWalkinJob`, `standbyBooking`, `advanceJobStatus` (check-in), `moveVisitBay`, `rescheduleVisit` | unchanged schemas | unchanged | Read type locks, stage reservations and physical holds (including cancelled-held jobs) before allocating a bay; skip reservation-backed pending jobs |
| `upsertBay` (`functions/studio/upsertBay.ts`) | unchanged schema | unchanged | Locks old and new bay types; refuses retype/deactivation while the bay has an upcoming booking, an occupant or an active reservation |
| `createService`, `updateService` | `createServiceSchema` / `updateServiceSchema`: **new** `standaloneExteriorWash?`, `includesExteriorWash?` | unchanged | Persist the duplicate-Wash flags (absent = false) |
| `getServiceCatalogue` | unchanged | `{ services, references, cataloguePublication }` | Serves the published customer snapshot, which now carries the two flags (`lib/catalogue-customer-snapshot.ts` field list) |

### 2.5 Transaction behaviour

* **Order inside every capacity transaction:** type locks (sorted, sequential) -> per-bay locks (sorted) -> occupancy
  reads (jobs, physical holds, cancelled-held jobs, active reservations) -> writes. All reads precede the first write.
  This was checked statically for every transaction touched (createBooking, cancelBooking, adminCancelBooking,
  offline-cancel, waiting-cancel, combined-return, booking-hold, missed-bookings, cancelVisitService, reschedule-move,
  assignBay, createWalkinJob, releaseCompletedBay, upsertBay, standbyBooking, joinVisit, visitBay, visitSchedule,
  advanceJobStatus). The textual hits that looked like violations were confirmed false positives (a comment, an
  early-return branch, two functions in one file).
* **Atomic mixed booking:** booking, job, per-bay locks, type locks and every reservation are written in one
  `runCapacityTransaction`; reservations use `tx.create`. A refusal or failure leaves no booking, job or reservation
  (emulator-tested, including partial capacity and concurrent competition for one PPF bay).
* **Central release on every whole-booking ending:** `readCancelReads` / `writeCancelRestores` are used by customer and
  office cancellation (`runCancel`), the studio inline cancel, waiting-cancel resolution, combined return, receipt-funded
  (offline) cancellation, unpaid-hold expiry (`lib/booking-hold.ts`), missed-booking cancellation
  (`lib/missed-bookings.ts`) and visit-service cancellation. Single-bay bookings add no read.
* **Physical hold after cancellation:** `heldAfterCancelFields(job, now)` sets `heldAfterCancel: true` when the job was
  `VEHICLE_RECEIVED` with a bay, in cancelBooking, runCancel, offline-cancel, waiting-cancel, combined-return and
  booking-hold. Readers treat such a job as occupying its bay until `releaseCompletedBay`.

---

## 3. Customer app (`apps/customer`)

| Area | Implemented | Evidence |
|---|---|---|
| Mixed cart is bookable | The "Different bays are needed / Plan one visit / Prices in review" redirect and the `crossBay` state were removed; a mixed cart proceeds to booking with exact ids | `src/ui/ServiceJourney.tsx`, `src/ui/services-experience/LiveCartReview.tsx`, `src/ui/ServiceSelectionBar.tsx`, `src/lib/service-cart.ts` |
| Cart price preview | `previewSelectionPrice(services, category)` makes ONE call: `calculateServicePrice(first.id, category, extraIds, FIRST_STUDIO_ID)`; it rejects non-INR, non-integer or negative totals | `src/lib/selection-price-preview.ts` |
| Price callable client | `calculateServicePrice(serviceId, vehicleCategory, extraServiceIds = [], studioId?)` sends `extraServiceIds` and `studioId` only when given; caches only single-service, studio-less prices | `src/lib/catalogue-service.ts:142` |
| Booking handoff | `onBookSelection` routes to `/(tabs)/book/[serviceId]` with `extras=<ids>` | `src/app/(tabs)/catalogue/index.tsx:137,175` |
| Availability | `getAvailability(serviceId, FIRST_STUDIO_ID, todayIST(), 7, ids)` with the extras | `src/app/(tabs)/book/[serviceId].tsx:101-107`, `src/lib/booking-service.ts:81-88` |
| Booking | `createBooking({ ..., extraServiceIds })` | `src/app/(tabs)/book/confirm.tsx:365` |
| Duplicate-Wash prompt | Native journey asks before Proceed when published flags show a standalone Wash plus a service that includes one; "Yes, remove extra Wash" removes only the standalone Wash line | `src/ui/ServiceJourney.tsx` (`DUPLICATE_WASH_PROMPT`, `shouldAskDuplicateWash`), `src/lib/service-cart.ts` (`removeStandaloneWash`) |

**Remaining customer integration (not done):**

* `book/confirm.tsx:133` calls `calculateServicePrice(params.serviceId, params.vehicleCategory, extraIds)` **without
  `studioId`**, so the confirm screen prices with the default tax and service currency instead of the studio's. It
  matches the persisted price only while the studio's tax settings equal the defaults. The amount actually charged is
  always computed server-side by `createBooking`. Follow-up: pass `FIRST_STUDIO_ID`.
* The web cart review (`LiveCartReview.tsx`) has no duplicate-Wash prompt; only the native `ServiceJourney` shows it.
* No customer screen shows per-stage bays or reservation times; booking detail shows the booking as one visit.
* Rescheduling a mixed booking: `bookings/reschedule.tsx:48` still lists slots (it passes the booking's extras to
  `getAvailability`), then the server refuses the change. The screen's `catch` replaces the server message with its own
  "Your time change was not confirmed. Refresh the booking before trying again.", so the customer never sees that the
  studio will coordinate. Follow-up: hide reschedule for bookings with `bayReservationIds`, or show the server message.
* The `onCoordinate` prop (`ServiceJourney`, `ServiceExperienceProps`, `catalogue/index.tsx`) is now never called by
  the cart. It was left in place to avoid widening the diff; remove it in a cleanup.

---

## 4. Studio app (`apps/studio`)

Studio calls `assignBay`, `getAvailability`, `standbyBooking`, `createWalkinJob`, `cancelWalkinJob`,
`advanceJobStatus`, `joinVisit`, `getVisitJoinOptions`, `moveVisitBay`, `rescheduleVisit` and `releaseCompletedBay`
(`src/lib/studio-service.ts` and visit components). All the server-side protections in 2.4 apply to these calls
automatically; refusals surface as the server error messages.

| Workflow | Status |
|---|---|
| Walk-in, assign bay, standby admission, check-in | Server protected by type locks, reservations and physical holds; no Studio UI change |
| Shared visit join | Server refuses mixed bookings with active reservations; Studio shows the server message |
| **Cancelled-but-held bay release** | **Server only.** `releaseCompletedBay` accepts it, but the Studio release pane renders only for `!job.visitId && job.status === "READY_FOR_DELIVERY"` (`src/app/(tabs)/jobs/[id].tsx:969`). Staff have no UI action to release a bay held by a cancelled arrived car. Until this is built, such a bay stays held |
| Stage visibility | Studio does not read `bayReservationIds` or `heldAfterCancel`; there is no per-stage view of a mixed booking's planned bays |
| Mixed booking reschedule | Refused for customers by the server; no Studio replanning flow (approved: studio coordinates manually) |

---

## 5. Admin app (`apps/admin`)

| Area | Implemented | Evidence |
|---|---|---|
| Service-to-resource mapping | `requiredBayType` (default `general`) edited on the service form and saved through `createService` / `updateService` | `src/app/(admin)/services/page.tsx:136`, `src/lib/catalogue-service.ts:69,77` |
| Bays | `upsertBay` (now refuses unsafe retype/deactivation) | `src/lib/studio-service.ts:53` |
| Duplicate-Wash flags | `standaloneExteriorWash` / `includesExteriorWash` in the service draft, form, save payload and publish review labels ("Standalone Exterior Wash", ...) | `src/experience/services-draft.ts:31-32,68-69,166-167`, `src/experience/ServicesView.tsx`, `src/experience/catalogue-publish-review.ts:8` |
| Publish to customers | Flags are part of the customer snapshot field list; `getServiceCatalogue` serves the published snapshot to the customer app | `functions/src/lib/catalogue-customer-snapshot.ts`, `functions/src/functions/service/getServiceCatalogue.ts:29` |

Emulator evidence: `catalogue-customer-publication.emulator.test.ts`, "duplicate-wash flags survive draft, review, publish
and the customer snapshot exactly as reviewed".

---

## 6. Backend-to-frontend integration matrix

| Capability | Backend | Customer | Studio | Admin |
|---|---|---|---|---|
| Mixed-bay booking | Done (`createBooking`) | Done (cart -> `book/[serviceId]` -> `confirm.tsx`) | n/a | n/a |
| Mixed availability | Done (`getAvailability`, `mixedVisitSlots`) | Done (`book/[serviceId].tsx` passes extras) | Uses `getAvailability` (single service) | n/a |
| Combined price preview | Done (`calculateServicePrice` + `extraServiceIds`, `studioId`) | Cart preview done with studio; **confirm screen omits `studioId`** | n/a | Admin pricing preview unchanged (`calculateServicePrice` without extras) |
| Reschedule refusal (mixed) | Done | **Server message not shown** (generic "not confirmed" text) | n/a | n/a |
| Whole-booking cancel releases reservations | Done (central pair) | Uses existing cancel flow | Uses existing cancel flows | Uses existing cancel flows |
| Arrived-car hold after cancel | Done (`heldAfterCancel`) | n/a | **No release UI** (server supports it) | No UI |
| Release cancelled-held bay | Done (`releaseCompletedBay`) | n/a | **Missing** | **Missing** |
| Shared-visit refusal (active reservations) | Done (`visitJoinProblem`, `readVisitMember`) | n/a | Server message shown | Server message shown |
| Bay retype/deactivate guard | Done (`upsertBay`) | n/a | n/a | Server message shown |
| Duplicate-Wash flags | Done (schemas, snapshot) | Native prompt done; **web review missing** | n/a | Done (draft, save, publish review) |
| Per-stage reservation visibility | Data present | **None** | **None** | **None** |

---

## 7. Verification (emulator `demo-autodeck-ci`, local)

Logs: `~/autodeck-tools/phase0-logs/MixedBay-*` (outside the repository).

| Suite | Result |
|---|---|
| Core (`packages/core`) | 705 / 705 |
| Functions unit | 2,217 passed, 3 failed (see 8) |
| Functions emulator, 41-file affected set | 41 / 41 files, 1,273 passed, 2 skipped |
| Functions emulator, focused (visit join, active-reservation check) | 5 / 5 files, 104 / 104; then 4 / 4 files, 96 / 96 |
| Customer unit | 1,284 passed, 8 failed (see 8) |
| Customer render | 153 / 153 files, 746 / 746 |
| Admin unit / render | 361 / 361; 236 / 236 |
| `pnpm turbo run typecheck --force` | 9 / 9 tasks |

Focused tests added: `functions/src/test/emulator/mixed-bay-booking.emulator.test.ts` (creation in cart order, two
stages of one type, partial capacity leaves nothing, concurrent competition, mixed availability, reschedule refusal,
cancel releases reservations, arrived-car hold and explicit release, replay-safe release, ordinary cancelled job and
other-studio refusal, preview equals persisted price, shared cancel pair ownership, visit-join refusal and the
released-reservation case), `bay-type-locks.emulator.test.ts`, `combo-booking.emulator.test.ts` (updated),
`functions/src/test/unit/bay-type-lock.test.ts`, core `*.test.ts` for the new modules, customer
`selection-price-preview.test.ts`, `calculate-service-price-call.test.ts` and updated cart render tests.

---

## 8. Known test failures (verified unrelated to this commit)

| Test | Cause and evidence |
|---|---|
| Functions `retained-transport-operation-boundary`, `visit-separate-invoice-pdf-boundary` | 5 s default timeout under full-suite load (5,012 / 5,009 ms). Alone with a 60 s timeout they pass in about 6.3-6.5 s |
| Functions `visit-refund-webhook` | Source guard on `functions/src/lib/visit-refund-ingress.ts`; the file and the test are unchanged from `HEAD` |
| Customer `cancel-rules`, `notifications-hang`, `policy-copy` (x2) | Windows path join produces `C:\C:\...` (ENOENT) |
| Customer `vercel-*-guard` (x4) | spawn `bash scripts/vercel-ignore.sh` with stubbed `PATH`; script and tests unchanged |
| Customer `advance-booking` | source-text assertion against `book/confirm.tsx`, which is unchanged from `HEAD` |
| Customer `text-repair` | flags only `packages/core/src/types/notification.ts`, unchanged from `HEAD` |

---

## 9. Partial and outstanding work

1. Studio UI action to release a cancelled-but-held bay (server path ready: `releaseCompletedBay`).
2. Confirm screen should pass `studioId` to `calculateServicePrice` (`book/confirm.tsx:133`).
3. Duplicate-Wash prompt in the web cart review (`LiveCartReview.tsx`).
4. Per-stage visibility of a mixed booking for staff and customers.
5. Mixed-booking change flow: currently refused, coordinated manually by the studio. No partial reschedule or replanning.
   The customer reschedule screen should hide the action or show the server's message (see 3).
6. Per-service cancellation fees and refunds: blocked, no approved policy.
7. Delay reporting: not implemented.
8. Visit flows do not move or release stage reservations; mixed bookings are therefore kept out of shared visits.
9. Remove the unused `onCoordinate` customer prop.

---

## 10. Production-readiness limitations

* Concurrency safety is demonstrated only against the Firestore emulator. Production behaviour under real contention
  (lock contention, retries, latency) has not been measured.
* Before deploy, live data needs a stale "car in bay" check: any job left in a present status (`VEHICLE_RECEIVED` to
  `READY_FOR_DELIVERY`) without a release receipt now blocks its bay for bookings, availability and walk-ins.
* Reservations are released on whole-booking endings only. A mixed booking that completes normally keeps `active`
  reservations, which block only their own past time windows.
* No backfill or migration: existing bookings have no `bayReservationIds` and keep single-bay behaviour.
* Nothing in this commit has been deployed; no production data was read or changed.
