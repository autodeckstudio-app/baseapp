# 07 — Booking Engine Design

**Status:** Architecture specification. Not implemented.  
**Scope:** Single-studio with multi-studio extension points designed in from day one.

---

## 7.1 Principles

- Slot availability is computed server-side only (Cloud Function). Client never decides availability.
- Bay assignment happens inside a Firestore transaction. No double-booking by construction.
- Customer selects a time slot. Studio assigns the specific bay — customers never pick bays.
- Duration includes a 15-minute turnover buffer after every job on the same bay.
- Multi-day jobs (PPF, major ceramic) hold the bay continuously across calendar days.
- Opening hours, holidays, and blocked time are all enforced server-side.
- Walk-in jobs count against capacity the moment they are created.
- All price computation is server-side. Client shows a preview; server decides the amount.

---

## 7.2 Resource Model

The engine tracks three resource types:

### Bays
```
Bay {
  id: string
  studioId: string
  name: string          // e.g. "Protection Bay 1", "Wash Bay A"
  type: 'protection' | 'wash' | 'general'
  capacity: 1           // always 1 for now (one job at a time per bay)
  active: boolean
  disabledUntil?: Timestamp  // maintenance window
}
```

### Studio Schedule
```
Studio {
  operatingHours: {
    monday: { open: "09:00", close: "19:00" } | null  // null = closed
    tuesday: ...
    ...
    sunday: ...
  }
  holidays: string[]    // ISO date strings, e.g. ["2026-01-26", "2026-08-15"]
  timezone: string      // IANA timezone — configurable per studio; default "Asia/Kolkata" (IST)
                        // All slot generation, opening hours, and cancellation windows use this value
}
```

### Blocked Time
Admin can block individual bays or all bays for a time window:
```
BlockedTime {
  id: string
  studioId: string
  bayId?: string        // null = all bays
  from: Timestamp
  to: Timestamp
  reason: string
}
```

---

## 7.3 Availability Query Algorithm

**Input:**
- `serviceId` — determines requiredBayType and estimatedDurationMinutes
- `studioId`
- `requestedDate` — first date to search from (or "earliest")
- `lookAheadDays` — how many days to search (default 14)

**Steps:**

```
1. Fetch service → { requiredBayType, estimatedDurationMinutes }
   Add 15-minute buffer: slotDuration = estimatedDurationMinutes + 15

2. Fetch studio → { operatingHours, holidays, timezone }

3. Fetch active bays where type = requiredBayType AND active = true AND not disabled

4. For each candidate date (requestedDate to requestedDate + lookAheadDays):
   a. If date is in studio.holidays → skip
   b. Fetch operatingHours for that weekday → if null (closed) → skip
   c. Compute available window: [openTime, closeTime - slotDuration]
      (a job must START early enough to FINISH before close)
   d. For each bay of the required type:
      - Query jobs/bookings on this bay for this date
        (status not in [cancelled, expired])
      - For each occupied job: block [startTime, endTime + 15min buffer]
      - Collect free windows = available window minus all blocked intervals
   e. Find valid start times within free windows
      (slot granularity: 30-minute increments)
   f. Collect up to maxSlotsPerDay available slots per day

5. Return first availableSlots entries across all days
   Each slot: { date, startTime, estimatedEndDate, estimatedEndTime }
   Do NOT return which bay — bay is assigned at commit time.
```

**Performance note:** Queries should be bounded by date range (not full collection scans). Index: `jobs` by `(studioId, bayId, scheduledDate)`.

---

## 7.4 Booking Commit Transaction

All steps execute inside a single Firestore transaction:

```
Transaction: createBooking(input)

1. VALIDATE input schema (Zod)
2. CHECK idempotency: read bookingIntents/{idempotencyKey}
   → if exists: return existing bookingId (duplicate request)
3. RE-VALIDATE availability for the requested slot
   (race condition window: slot could have been taken since availability query)
   → if slot no longer available: throw SLOT_TAKEN error
4. ASSIGN bay:
   → find least-loaded active bay of requiredBayType for the slot
   → if none available: throw NO_BAY error
5. COMPUTE price (never from client):
   → base price from service catalogue
   → scope multiplier
   → add-on prices
   → membership discount (if membershipId provided and active)
   → pickup fee (if requested)
   → drop fee (if requested)
   → produce priceBreakdown object
6. DEDUCT membership wash (if wash service + active membership):
   → read membership, verify washesUsed < washesTotal
   → increment membership.washesUsed
   → mark this booking as membershipWashUsed = true
7. WRITE booking document
8. WRITE bookingIntent (idempotency marker)
9. WRITE ServiceJob stub (status: PENDING_VEHICLE)

AFTER transaction (async triggers):
- Send booking confirmation push notification
- Send booking confirmation WhatsApp message
- Write AuditLog entry
```

---

## 7.5 Conflict Prevention

| Risk | Mitigation |
|---|---|
| Two customers book the same slot simultaneously | Firestore transaction serializes bay assignment; second transaction fails at step 3 (slot validation) |
| Duplicate booking from network retry | bookingIntents idempotency key; second request returns existing result |
| Walk-in job takes last bay during booking flow | Walk-in creates job inside a transaction that also checks bay capacity |
| Admin overrides capacity | Admin override is logged to AuditLog; bypass is intentional and attributed |

**Known Firestore limitation:** Firestore has no predicate locks — two transactions can both pass the read phase before either commits. Mitigation: the bay assignment write will contend on the same document, causing one transaction to retry. At the low concurrency levels of a single studio, this is acceptable.

---

## 7.6 Status State Machine

### Booking Status

```
                    PENDING
                       │
              (studio confirms)
                       │
                   CONFIRMED ──────────────────── CANCELLED
                       │                              ▲
          (vehicle arrives at studio)         (customer or studio)
                       │
                    ACTIVE
                       │
              (job complete + paid)
                       │
                   COMPLETED
```

EXPIRED: booking reaches its scheduled time without studio confirmation (automated via cron job).

### ServiceJob Status

```
  VEHICLE_RECEIVED
         │
    (work begins)
         │
    IN_PROGRESS
         │
  (work complete)
         │
  QUALITY_CHECK
         │
  (QC passed)
         │
  READY_FOR_DELIVERY
         │
  (vehicle leaves studio)
         │
     DELIVERED
```

All status transitions are written as immutable entries to `job.statusHistory[]` (append-only array). No status can be un-set or retroactively changed.

### Pickup / Drop Sub-Status (parallel to job)

```
Pickup:
  REQUESTED → SCHEDULED → EN_ROUTE → ARRIVED → VEHICLE_HANDED_OVER

Drop:
  SCHEDULED → EN_ROUTE → ARRIVED → VEHICLE_DELIVERED → CUSTOMER_CONFIRMED
```

---

## 7.7 Multi-Day Jobs

PPF and some ceramic coatings span 2–5 working days.

**Duration calculation:**
- Working hours: 09:00–19:00 = 600 minutes per day
- A 48-hour PPF = 2 working days = job starts Monday 09:00, ends Wednesday 09:00 (or as computed)
- The bay is blocked continuously from start to completion — no other job assigned to that bay during the hold
- The system computes `estimatedEndDate` and `estimatedEndTime` at booking creation

**Overnight hold:** The bay is "owned" by the active job overnight. No other job can be slotted into that bay even if the studio is closed. The bay reopens when the job completes.

---

## 7.8 Rescheduling

Executed inside a single Firestore transaction:

```
1. Validate new slot is available
2. Assign bay for new slot (may be a different bay than original)
3. Release old bay reservation (decrement or remove occupation record)
4. Update booking: scheduledDate, scheduledTime, bayId, estimatedEndDate
5. Increment booking.rescheduleCount
6. Write AuditLog entry
7. Send reschedule notification to customer
```

Rules:
- Customer may reschedule for free if >24 hours before scheduled time
- Customer cannot reschedule in the final 24 hours (must contact studio)
- Studio may reschedule at any time
- Maximum 3 customer-initiated reschedules (configurable)

---

## 7.9 Cancellation

```
1. Validate: who is cancelling (customer or studio) and rules
2. Release bay reservation
3. Restore membership wash if membershipWashUsed = true (atomic)
4. Set booking.status = CANCELLED, booking.cancelledAt, booking.cancellationReason
5. Process refund if applicable (via Razorpay refund API or manual)
6. Write AuditLog entry
7. Send cancellation notification
```

Cancellation rules:
- Customer: free if >24h before slot; fee or restrictions within 24h (business decision)
- Studio: can cancel at any time; triggers customer notification and any applicable refund
- System (auto-expiry): if booking passes scheduled time without vehicle receipt, auto-expire (cron job)

---

## 7.10 Pricing Engine

Pure function — inputs in, price breakdown out. Same logic runs on client (for preview) and server (authoritative). Client preview uses cached catalogue prices. Server always reads fresh from Firestore.

```typescript
function computePrice(input: {
  serviceId: string
  scopeId: string
  addOnIds: string[]
  membershipId?: string
  pickupRequested: boolean
  dropRequested: boolean
  catalogueSnapshot: ServiceCatalogue
  membershipSnapshot?: Membership
}): PriceBreakdown

type PriceBreakdown = {
  basePrice: number
  scopeAdjustment: number
  addOns: { id: string; name: string; price: number }[]
  subtotal: number
  membershipDiscount: number | null
  membershipDiscountPercent: number | null
  pickupFee: number
  dropFee: number
  taxRatePercent: number         // snapshotted at booking creation — e.g. 18 for 18% GST
  taxDescription: string         // snapshotted label — e.g. "GST 18%"
  tax: number                    // computed tax amount in minor currency units
  total: number
  currency: string               // ISO 4217 — "INR" for India (V1); configurable per tenant
}
```

**Rules:**
- Membership discount is exclusive with promotional codes (cannot stack)
- Tax rate is configurable per tenant/studio — not hardcoded globally; 18% GST is the AutoModz V1 default
- `taxRatePercent` and `taxDescription` are snapshotted at booking creation; changing tax config later does not rewrite historical bookings
- Pickup/drop fee: fixed per-booking fee (configurable in studio settings)
- Price breakdown is snapshotted into the booking at creation — immutable thereafter
- Price is never read from the client request

---

## 7.11 Admin Overrides

Admin may:
- Move a booking to a different bay (logged)
- Change scheduled time (logged)
- Change price (triggers ApprovalRequest to customer OR is direct admin override if studio-absorbed)
- Extend job duration (logged)
- Mark payment received manually
- Cancel without standard fee restrictions
- Bypass availability check (for emergency scheduling)

All admin overrides write an AuditLog entry with `{ before, after, actorId, actorRole: 'admin', reason }`.

---

## 7.12 Walk-in Jobs

Walk-ins bypass the booking engine slot allocation:

```
1. Studio creates walk-in job via studio app
2. Studio selects available bay (visual bay board)
3. `createWalkinJob` Cloud Function runs a Firestore transaction:
   a. Reads current bay document to verify bay is not occupied
   b. Writes ServiceJob with status VEHICLE_RECEIVED and bayId
   c. If bay is taken, transaction fails and studio is shown an error
4. Bay capacity is immediately reduced for any same-day bookings
5. Walk-in customer: existing customer lookup by phone, or create walkin record
6. Job proceeds through normal ServiceJob status machine from VEHICLE_RECEIVED
```

Bay assignment for walk-ins is **transactional** — if two staff members try to assign the same bay simultaneously, Firestore transaction serialization ensures only one succeeds. This is the same contention guarantee as booked bay assignment (see section 7.3).

Walk-ins do not require pre-booking, pre-payment, or slot reservation. The studio board shows them so bay selection is informed.

---

## 7.13 Booking Engine Scalability

Designed for single-studio from day one but scoped for multi-studio from day one:

- All queries scoped by `studioId` — adding a second studio requires no schema changes
- Bay types and counts are data-driven (not hardcoded) — a new studio can have 10 bays of any mix
- Operating hours and holidays are per-studio
- Staff assignment per studio (future Phase 4 constraint)
- Availability query accepts `studioId` as first-class parameter

**Current scale:** 5 bays, ~10–20 bookings/day. Firestore can handle this with trivial headroom.

**Future scale trigger:** At >100 bays across multiple studios, consider migrating the availability computation to a dedicated Cloud SQL query (slot conflicts become complex at scale).
