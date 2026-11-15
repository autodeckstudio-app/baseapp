# 14 — Testing Strategy

**Principle:** Test behaviour, not implementation. No mocked databases — use Firebase Emulator Suite for all integration tests.

**Lesson from AutoModz:** The seal path (visits) had unit tests that passed but the feature never ran in production because it was never end-to-end tested against real Firestore behaviour. AutoDeck must test critical paths with real Firestore via the emulator, not mock objects.

---

## 14.1 Test Pyramid

```
                    /\
                   /  \
                  / E2E \      — Few, critical user journeys only
                 /--------\
                / Integration\  — Cloud Functions + Firestore Emulator
               /--------------\
              /   Unit Tests    \ — Pure functions, domain logic, Zod schemas
             /------------------\
```

**Unit tests:** Fast, numerous, test pure logic in isolation.  
**Integration tests:** Test Cloud Functions against Firebase Emulator (real Firestore behaviour).  
**E2E tests:** Test critical user journeys in the actual running app.

---

## 14.2 Unit Tests (Vitest)

**What to test:**

### Pricing Engine (`packages/shared-utils/pricing.ts`)
- Base price computation for each service type
- Scope multiplier applied correctly
- Add-on price accumulation
- Membership discount (exclusive with promo)
- Pickup fee, drop fee
- Tax calculation (18% GST — configurable; snapshotted per booking)
- Edge cases: zero add-ons, no membership, max discount cap
- Required: 100% branch coverage before Phase 1

### Booking Duration Calculator
- Single-day job: fits within working hours
- Multi-day job: spans across non-working hours correctly
- Buffer calculation: 15-minute gap enforced
- Holiday awareness: duration skips holidays correctly
- Boundary: job that would end after closing time is correctly rejected

### Status State Machine Validator
- Valid transitions: all documented valid transitions succeed
- Invalid transitions: all documented invalid transitions throw
- Terminal states: no transition out of delivered/void/cancelled
- Test every combination explicitly

### Zod Schemas (Cloud Function inputs)
- Valid inputs: all required fields present, types correct → passes
- Invalid inputs: missing required field → fails with field name in error
- Unknown fields: rejected in strict mode
- Boundary values: empty strings, negative numbers, past dates

### Domain Utilities
- `formatINR(12500)` → `"₹12,500"`
- `formatDuration(150)` → `"2h 30m"`
- `getStatusLabel('in_progress', 'en')` → `"In Progress"`
- Timezone-aware date functions (Asia/Kolkata)

---

## 14.3 Integration Tests (Vitest + Firebase Emulator Suite)

**Setup:**
```bash
# Start emulators before running integration tests
firebase emulators:start --only firestore,auth,functions,storage
```

All integration tests use the Firebase Emulator — never the production or staging Firebase project. Test isolation: each test suite starts with a clean Firestore state (cleared between test files).

### Booking Creation Tests

**Happy path:**
1. Customer authenticated (phone OTP via emulator)
2. Service exists in Firestore with requiredBayType and duration
3. Bay exists and is available for requested slot
4. Call booking creation Cloud Function
5. Assert: booking created with correct fields
6. Assert: bay marked as occupied for that slot
7. Assert: bookingIntent written (idempotency)
8. Assert: notification dispatched (check notification collection)

**Membership discount:**
1. Customer has active Gold membership (4 washes remaining)
2. Book a wash service
3. Assert: membership discount applied in priceBreakdown
4. Assert: membership.washesUsed incremented by 1
5. Assert: booking.membershipWashUsed = true

**Concurrent booking (race condition):**
1. Two simultaneous booking requests for the same slot on the same bay type
2. Only one succeeds (Firestore transaction wins)
3. Second returns SLOT_TAKEN error
4. Only one booking exists in Firestore

**Slot already taken after availability query:**
1. Availability query returns slot as available
2. Another job is assigned to that bay before commit
3. Booking commit correctly detects conflict and fails

**Idempotency:**
1. Same booking request sent twice (same idempotencyKey)
2. First creates booking
3. Second returns existing bookingId without creating a duplicate

### Booking Cancellation Tests

1. Customer cancels >24h before slot → succeeds, bay released
2. Customer cancels <24h before slot → business rule enforced (or logged)
3. Cancellation with membership wash → wash restored atomically
4. Cancellation with payment already collected → refund flag set

### Job Status Transition Tests

1. Valid transition (VEHICLE_RECEIVED → IN_PROGRESS) → succeeds, statusHistory appended
2. Invalid transition (DELIVERED → IN_PROGRESS) → rejected
3. Each valid transition from the state machine is tested
4. Status history is append-only — old entries never modified

### Payment Tests

1. Razorpay webhook `payment_link.paid` → payment status updated, job advances
2. Razorpay webhook `payment.failed` → payment marked failed, no job advance
3. Manual payment recorded by studio → correct actor recorded, customer notified
4. Refund: admin initiates → payment status updated, refund notification sent

### Membership Activation Tests

1. Customer submits payment claim → status = pending_payment
2. Admin activates → status = active, activatedAt set, washesDue set correctly, customer notified
3. Activation attempted by non-admin → rejected
4. Activation of already-active membership → rejected or creates upgrade flow

### Warranty Creation Tests

1. Job sealed → warranty record created with snapshotted service terms
2. Service catalogue updated after warranty created → warranty NOT changed
3. Warranty record immutable after creation → any field update attempt rejected by Firestore rules

### Audit Log Tests

Every critical mutation must produce an AuditLog entry. Test each:
- Booking created → AuditLog entry with actor, action, bookingId
- Job status advanced → AuditLog entry with before/after status
- Price changed → AuditLog entry with before/after price
- Membership activated → AuditLog entry with activatedBy
- Employee role changed → AuditLog entry with old role, new role
- AuditLog entries: cannot be updated or deleted (test via Firestore rules)

### Firestore Security Rules Tests

Using `@firebase/rules-unit-testing` against the emulator.

**For every collection, test:**
- Unauthenticated read → rejected
- Customer reading own record → allowed
- Customer reading another customer's record → rejected
- Customer writing a restricted field (price, status, paymentStatus) → rejected
- Studio reading customer data → allowed
- Studio writing job status → allowed
- Studio writing price without approval → rejected or requires Cloud Function
- Admin reading anything → allowed
- Admin writing anything → allowed
- AuditLog: no client writes → rejected for all roles

Required: 100% rule coverage (every rule has at least one passing test and one failing test).

---

## 14.4 End-to-End Tests

### Mobile Apps: Maestro

[Maestro](https://maestro.mobile.dev/) — YAML-based mobile E2E testing, simple setup, no Appium complexity.

**Customer App Critical Flows:**

```yaml
# onboarding.yaml
- launchApp
- assertVisible: "Enter your phone number"
- tapOn: "+91"  # India country code pre-selected
- inputText: "9876543210"
- tapOn: "Send OTP"
- inputText: "123456"  # Emulator fixed OTP
- tapOn: "Verify"
- assertVisible: "What's your name?"
```

Critical journeys to automate:
1. Onboarding: phone login → name → add vehicle → welcome complete
2. Booking flow: browse service → select scope → choose slot → confirm → see confirmation
3. Live tracking: open active booking → see status rail → see stage photos
4. Approval flow: receive approval notification → approve → see updated job status
5. Payment: receive payment due notification → pay with card → see confirmation
6. Membership: browse membership page → select tier → complete join flow

**Studio App Critical Flows:**
1. Login → view job queue → open job card
2. Advance job status (VEHICLE_RECEIVED → IN_PROGRESS)
3. Add photo to job (stage: in progress)
4. Request customer approval (create approval with price impact)
5. Record payment (cash)
6. Walk-in: register phone → find customer → select service → assign bay → create job

### Admin Web: Playwright

Critical journeys to automate:
1. Admin login → view dashboard → see bay utilization
2. View booking in calendar → open booking detail → confirm booking
3. Open job card → see all sections → advance status
4. Customer 360: open customer → see vehicles, history, membership
5. Activate membership: find pending → click activate → verify active
6. Service catalogue: edit service price → verify change saved

---

## 14.5 Security Testing

### Firestore Rules — Required Coverage

Every collection, every role, every operation. Rules testing is mandatory, not optional. There must be no untested rule paths.

### API Security Testing

Before each production release:
- All Cloud Function HTTP endpoints: test auth bypass (no token → 401, wrong role → 403)
- Input validation: send malformed input → verify 400 with error, no 500
- Rate limiting: send 50 rapid requests → verify 429 after threshold
- Razorpay webhook: send without signature → verify rejected; send with wrong `x-razorpay-signature` → verify rejected
- Payment amount: send `amount` field in booking creation request → verify server ignores it, uses computed amount
- Price tampering: send modified priceBreakdown in booking request → verify server recomputes, not uses client value

### Penetration Test (Before Phase 4 Launch)

Commission a security audit covering:
- OWASP Top 10 for the Cloud Functions API surface
- Firebase Firestore rules exhaustive test
- Authentication bypass attempts
- Firebase App Check bypass attempts
- Razorpay payment link amount manipulation
- Customer data isolation verification

---

## 14.6 Performance Testing

### Cloud Functions

Target P95 latency for key endpoints:
- Booking availability query: < 800ms
- Booking creation: < 1200ms (Firestore transaction + notification dispatch)
- Job status advance: < 500ms
- Payment intent creation: < 600ms

Load test booking creation at 50 concurrent requests (simulate a promotional campaign):
- All requests should succeed or return graceful errors
- No 500 errors under load
- Firestore transaction retry rate should be < 10%

### Mobile App Performance

| Metric | Target | Test tool |
|---|---|---|
| Cold app launch | < 2s | Maestro timing |
| Home screen first paint | < 1s | React Native Perf Monitor |
| Booking flow completion | < 60s | Manual timing |
| Firestore query P95 | < 300ms | Firebase Performance |
| Photo upload (5MB) | < 10s | Manual timing on device |

### Firestore Query Performance at Scale

Test queries with production-scale synthetic data:
- 10,000 customers
- 5 vehicles per customer
- 50 bookings per customer (500,000 bookings total)
- All queries must complete < 500ms with proper indexes

Queries to test:
- Booking list for admin: filter by status + date range, paginated
- Customer lookup by phone (for walk-in)
- Vehicle lookup by registration number
- Job list for studio: filter by studioId + status + date
- Availability check: bookings on a bay for a date range

---

## 14.7 Test Data Management

### Firebase Emulator Seed

A seed script populates the emulator with known-state test data for each scenario:

```
seeds/
├── base.ts              Empty state (no users)
├── customer-onboarded.ts  Customer exists, vehicle added, no bookings
├── active-booking.ts    Customer with confirmed future booking
├── job-in-progress.ts   Job in IN_PROGRESS state, awaiting approval
├── expired-membership.ts  Customer with recently expired membership
├── active-membership.ts   Active Gold membership with 2 washes remaining
├── completed-job.ts     Completed job with invoice and warranty
```

Each test file imports the relevant seed and clears Firestore between tests.

### Test Phone Numbers

Firebase Auth Emulator supports fixed test phone numbers with known OTP codes:
```
+919876543210 → OTP: 123456 (customer)
+919876543211 → OTP: 654321 (studio employee)
+919876543212 → OTP: 111111 (admin)
```

No real OTPs sent during testing.

### Payment Testing

- Razorpay test mode: use Razorpay sandbox test keys; test UPI IDs and test card numbers provided by Razorpay sandbox
- No real charges during test or CI runs — Razorpay sandbox is FREE

---

## 14.8 CI Integration

### On Pull Request

```yaml
steps:
  - Lint + format check
  - TypeScript strict typecheck (all packages)
  - Unit tests (Vitest, coverage report)
  - Start Firebase Emulator
  - Integration tests (Vitest + emulator)
  - Security rules tests
  - Coverage gate: pricing engine 100%, state machine 100%, overall > 80%
```

### Nightly (on staging)

```yaml
steps:
  - E2E tests: customer app (Maestro on iOS simulator)
  - E2E tests: studio app (Maestro on Android emulator)
  - E2E tests: admin web (Playwright)
  - Performance smoke test (booking creation P95 < 1s)
  - Slack notification on failure
```

### Pre-Release

```yaml
steps:
  - All CI checks (above)
  - Full E2E suite on real device (TestFlight build)
  - Manual QA sign-off required
  - Security scan (npm audit, Snyk)
  - Performance regression check
```

---

## 14.9 What AutoDeck Must Test That AutoModz Didn't

| Gap in AutoModz | AutoDeck Requirement |
|---|---|
| Seal path never ran in production | E2E test the complete job lifecycle from booking to warranty certificate |
| No rate limiting on any endpoint | Integration test: verify 429 after rate limit threshold |
| No schema validation on API routes | Integration test: malformed input returns 400, not 500 or silent corruption |
| Status colours inconsistent | Visual regression tests (Chromatic/Storybook) for all status states |
| isAdmin() via document reads | Performance test: verify Firestore rules use custom claims, not extra doc reads |
| Concurrent booking race | Explicit concurrent booking test with assertion that only one succeeds |
| Wash count drift | After every wash booking, assert membership.washesUsed = expected value |
