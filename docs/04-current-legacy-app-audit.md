# 04 — Legacy Source App Technical Audit

**AutoDeck OS Architecture Phase · August 2026**

> Read-only technical audit of the legacy source app PWA from the retired application repository. This codebase is a reference, not a migration source. Nothing from this codebase is copied into AutoDeck without deliberate architectural decision.

---

## 4.1 Technology Stack

| Layer | Technology | Version/Details |
|---|---|---|
| Framework | Next.js (App Router) | 15 |
| Language | TypeScript | 5.4 |
| React | React | 18 |
| State management | Zustand | 4.5 |
| UI framework | Tailwind CSS | 3 |
| UI primitives | Radix UI (dialog only), Vaul (drawers), Framer Motion 11 | — |
| Icons | Lucide React | — |
| Database | Firebase Firestore | asia-south1 region |
| Authentication | Firebase Auth | Google Sign-In only |
| Push notifications | Firebase Cloud Messaging (FCM) | Web push only |
| Server compute | Next.js API Routes on Vercel | No Cloud Functions (disabled on project) |
| Image storage | Cloudinary | Signed uploads; Firebase Storage not used (billing card required) |
| Testing | Jest | 905 tests / 34 suites; 0 lint errors; tsc clean |
| Deployment | Vercel | Detected via `VERCEL_URL` / `VERCEL_ENV` env vars |
| Monitoring | None | No error tracking or analytics provider wired |

**Firebase project ID**: Not hardcoded — all configuration via `NEXT_PUBLIC_FIREBASE_*` environment variables.

**Why Cloudinary instead of Firebase Storage**: Firebase Storage requires a billing account (Blaze plan). Cloudinary's free tier covers the current volume without requiring a payment method on the Firebase project. AutoDeck will use Firebase Storage (the project will be on Blaze from day one).

---

## 4.2 Data Architecture

### Collections Overview

All collections listed here were confirmed by reading source code and Firestore rules. Approximately 35 distinct collections plus subcollections.

#### Users and Identity

**`users`** (Customer-owned, admin-readable)
- `uid`, `name`, `email`, `phone`, `role` (customer | employee | admin)
- `employeeId`, `welcomedAt`, `quietMode`, `upiVpa`
- `notificationPrefs` (object per channel)
- `notes`, `tags` (admin-visible only)

**`users/{uid}/vehicles`** (Customer-owned; admin/employee read)
- `id`, `name`, `registrationNumber`, `photo`, `photos[]`, `category`
- `color`, `odometer`, `year`, `publicHistoryConsent`, `createdAt`

**`users/{uid}/vehicles/{id}/serviceHistory`** (Admin-written; customer-readable)
- Per-record historical service data (one document per completed service)

**`users/{uid}/vehicles/{id}/consentLog`** (Append-only; customer-triggered)
- Public history consent audit trail entries

**`users/{uid}/savedCars`** (Server-only write; customer-read)
- Car listing favourites (for the used car marketplace feature)

**`users/{uid}/fcmTokens`** (Customer-written via API)
- Device FCM push tokens, one per device

**`users/{uid}/addresses`** (Server-only write via API)
- Saved pickup/drop addresses

#### Operations Core

**`bookings`** (Server-only write; customer-read own; admin/employee full)
- `userId`, `vehicleId`, `serviceId`, `status`, `scheduledDate`, `scheduledTime`
- `endDate`, `bayId`, `bayGroup`, `totalAmount`, `breakdown`
- `scope`, `paymentMethod`, `paymentStatus`, `usedMembershipWash`, `membershipId`
- `discount`, `cancelledAt`, `jobId`, `estimateId`, `version`, `lastDecidedBy`
- `rescheduleCount`, `pickupAddressRef`

**`bookingIntents`** (Admin SDK only; no client access)
- Idempotency ledger. Written in same Firestore transaction as the booking. Prevents double-booking from rapid repeat submissions.

**`jobs`** (Staff-written; admin full)
- `source` (booking | walkin), `customerId`, `vehicleId`
- `serviceItems[]` (each: serviceId, name, price, duration, discount)
- `status`, `statusHistory[]` (append-only transition log)
- `assignments[]`, `assignedIds[]`
- `payments[]` (each: method, amount, reference, status)
- `subtotal`, `totalAmount`, `paymentStatus`, `amountPaid`
- `bay`, `photos[]`, `notes`, `date`

**`visits`** (Staff-written; customer-readable own)
- **CRITICAL**: Only 4 fixture documents in production. The seal path has never run with a real customer.
- `vehicleId`, `locationId`, `source`, `stages[]`, `termsCaptured[]`
- `amounts`, `bay`, `sealedAt`, `bookingId`, `jobId`

**`approvals`** (Staff-create; customer-respond; admin full)
- `jobId`, `customerId`, `reason`, `proposed`, `before`, `after`
- `priceDelta`, `timeDeltaMinutes`, `status` (pending | approved | declined)
- `photos[]`

**`estimates`** (Server-written; customer-readable own)
- `userId`, `vehicleId`, `serviceId`, `scope`, `breakdown`, `expiresOn`, `status`, `bookingId`

#### Financial

**`payments`** (Server-only write)
- `customerId`, `jobId`, `bookingId`, `visitId`
- `amount`, `method`, `status`, `vpa`, `reference`, `settledAt`, `settledById`

**`invoices`** (Staff-created; customer-readable own via public token)
- `invoiceNumber`, `jobId`, `bookingId`, `customerId`
- `lineItems[]`, `subtotal`, `discount`, `gst`, `total`, `paymentStatus`
- `photos[]`, `publicToken`

**`dailyClosings`** (Admin-written)
- End-of-day cash reconciliation records

#### Subscriptions & Memberships

**`subscriptions`** (Server-only write)
- `userId`, `plan`, `status`, `startDate`, `endDate`
- `washesTotal`, `washesUsed`, `amountDue`, `amountPaid`, `paidAt`, `transactionId`

#### Protections & Declarations

**`protections`** (Staff-written)
- `vehicleId`, `kind` (ppf | ceramic | glass | interior | warranty | puc | rc | insurance | fastag | membership)
- `provider`, `plan`, `coverage`, `since`, `term`
- `visitId`, `declarationId`, `termsSource` (captured | reconstructed | declared)

**`declarations`** (Server-only write)
- `vehicleId`, `ownerUid`, `kind`, `reference`, `issuedOn`, `expiresOn`
- `evidence`, `status`

#### Catalogue & Configuration

**`services`** (Admin-written; all-readable)
- `category`, `name`, `brand`, `price`, `duration`, `warranty`
- `scopes[]`, `addOns[]`, `popular`, `active`, `order`

**`studioConfig`** (Admin-written; staff-readable)
- `washCapacity`, `protectionCapacity`, `disabledBays[]`
- Controls the bay allocation engine

#### Staff & HR

**`employees`** (Admin-written)
- `name`, `phone`, `email`, `authUid`, `role`, `pinHash`, `active`, `salary`, `joinedAt`

**`attendance`** (Staff/Employee-written)
- `employeeId`, `date`, `checkInAt`, `checkOutAt`, `status`, `breaks[]`, `checkInMeta`

**`payroll`** (Admin-written)
- `employeeId`, `month`, `daysPresent`, `baseAmount`, `advances[]`, `deductions[]`, `netPayable`, `status`

**`expenses`** (Admin-written)
- `amount`, `category`, `paidVia`, `vendor`, `date`, `month`

**`quotes`** (Staff-written)
- `customerName`, `customerPhone`, `customerId`, `vehicleName`, `serviceCategory`
- `items[]`, `total`, `status`

**`tasks`** (Staff-written)
- Follow-up task queue (CRM-style tasks)

#### Notifications & Audit

**`notifications`** (Admin SDK-written; customer-readable own)
- `userId`, `title`, `body`, `type`, `event`, `read`, `url`, `heldByQuietMode`

**`activity`** (Staff-written)
- Operational event log (not the same as the full audit log)

**`ratings`** (Server-only write via API)
- `visitId`, `customerId`, `vehicleId`, `rating`, `comment`

**`feedback`** (Public write via API; admin-read)
- Invoice-linked satisfaction ratings (public endpoint — security gap)

#### CRM & Walk-ins

**`walkinCustomers`** (Staff-written)
- CRM for accountless walk-in customers, keyed by phone number
- Separate collection from `users` — a fragile design AutoDeck should not replicate

#### Inventory

**`inventoryItems`** (Admin-written; staff-readable)
- `name`, `category` (ppf_film | ceramic | wash | interior | other), `unit` (ml | ft | pcs | gm)
- `stockQty`, `lowStockThreshold`, `costPerUnit`

**`inventoryTxns`** (Staff-written)
- `itemId`, `type`, `qtyDelta`, `refType`, `refId`

#### Marketplace (cars)

**`carListings`** (Admin-written; publicly readable)
- `title`, `make`, `model`, `year`, `price`, `kmDriven`, `vehicleId`, `photos[]`, `status`, `active`, `featured`

**`carLeads`** (Server-only write)
- Car buying inquiry records

**`sellRequests`** (Server-only write)
- Customer car sell request records

#### Other

**`counters`** (Staff via Admin SDK)
- Sequential invoice number counter

**`referrals`** (Admin/server)
- Referral programme records (likely dead code — referral programme removed)

**`gallery`** (Admin-written; publicly readable)
- Marketing photo gallery for the website

### Removed collections (documented in code)
- `promos` — promo code records (removed)
- `promoRedemptions` — promo usage tracking (removed)
- `serviceRecipes` — automated inventory deduction per service (removed)

### Subcollection summary
All subcollections live under `users/{uid}/`:
- `vehicles/{id}` — vehicle profiles
- `vehicles/{id}/serviceHistory/{id}` — per-service records
- `vehicles/{id}/consentLog/{id}` — consent audit trail
- `savedCars/{id}` — marketplace favourites
- `fcmTokens/{token}` — push device tokens
- `addresses/{id}` — saved pickup/drop addresses

---

## 4.3 Authentication Model

### Provider
Firebase Auth, Google Sign-In only. No phone OTP, no email/password, no Apple Sign-In.

### Session handling
- Client persistence: `browserLocalPersistence` — session survives browser close
- Server sessions: custom httpOnly cookie minted at `POST /api/session`
- API routes verify the session cookie via Firebase Admin SDK on every request

### Role model
- `users/{uid}.role` field — string enum: `customer | employee | admin`
- No Firebase Custom Claims — roles are read from Firestore documents, not JWT claims
- This means every Firestore security rule that checks `isAdmin()` or `isEmployee()` must perform a `get()` call to read the user's document — an N+1 read pattern on every rule evaluation

### Admin bootstrap
The owner's email address (`hello.legacy-source@gmail.com`) is hardcoded in `firestore.rules`. On first login, this user can self-assign the `admin` role. All subsequent admin grants must be performed by an existing admin via the employee management interface.

### Role assignment flow
- Admin role: only by bootstrap (owner email) or by existing admin in admin dashboard
- Employee role: `POST /api/employee/link` (admin-only API route) grants the `employee` role to a Firebase UID and creates an employee record

### Enforcement summary
| Layer | How enforced |
|---|---|
| Firestore | Security rules using `get(resource.data.role)` patterns |
| API routes | Session cookie verified via Admin SDK on every request |
| Client UI | Route guards in Next.js middleware (defence in depth, not primary control) |
| Server writes | All critical fields (price, paymentStatus, status) are set by API routes, never passed through from client |

---

## 4.4 API Surface

37 route handlers confirmed in `app/api/`. Organized by domain:

### Booking (6 routes)
- `POST /api/booking/create` — server-authoritative booking creation with bay assignment transaction
- `PATCH /api/booking/reschedule` — reschedule with validation (>24h rule)
- `POST /api/booking/cancel` — cancel with reason; atomic wash refund if membership booking
- `GET /api/booking/calendar` — iCal export
- `GET /api/booking/availability` — returns available slots for a service on a given date
- `POST /api/booking/estimate` — compute estimate without creating booking

### Payments (2 routes)
- `POST /api/payment/settle` — studio marks a payment as received
- `PATCH /api/membership/claim` — customer submits UPI reference for membership payment

### Memberships (3 routes)
- `POST /api/membership/join` — create new membership or renew
- `POST /api/membership/upgrade` — upgrade tier
- `PUT /api/membership/activate` — studio activates after confirming payment receipt
- `PUT /api/membership/refuse` — studio refuses fraudulent payment claim

### Visits (3 routes)
- `POST /api/visit/seal` — seal a completed visit (capture all terms at moment of completion)
- `POST /api/visit/reseal` — correct a visit that was sealed incorrectly (admin only)
- `POST /api/visit/backfill` — migrate historical job to visit format

### Vehicles (2 routes)
- `POST /api/vehicle/add` — add vehicle to user's garage
- `PATCH /api/vehicle/update` — update vehicle metadata

### Addresses (2 routes)
- `POST /api/address/save` — save pickup/drop address
- `DELETE /api/address/delete` — remove saved address

### Media (2 routes)
- `POST /api/media/sign` — Cloudinary signed upload URL (server generates signature)
- `DELETE /api/media/delete` — delete from Cloudinary (server-side)

### Session (1 route)
- `POST /api/session` — mint httpOnly session cookie from Firebase ID token

### Notifications (3 routes)
- `POST /api/notification/event` — trigger a notification event (creates Firestore notification + sends push)
- `POST /api/notification/stage` — send stage-specific notification (job status update)
- `PATCH /api/notification/read` — mark notification(s) as read

### Push (1 route)
- `POST /api/push/send` — send FCM push to a device token

### WhatsApp (1 route)
- `POST /api/whatsapp/send` — send WhatsApp message via Meta Graph API (to studio phone only)

### Employees (1 route)
- `POST /api/employee/link` — grant employee role and create employee record

### Protection (2 routes)
- `POST /api/protection/declare` — customer submits a declaration (e.g., PUC certificate upload)
- `POST /api/protection/verify` — admin verifies a submitted declaration

### Ratings (1 route)
- `POST /api/rating/submit` — submit post-visit star rating and comment

### Approvals (2 routes)
- `POST /api/approval/request` — studio creates mid-job approval request
- `PUT /api/approval/respond` — customer approves or declines

### Cars marketplace (4 routes)
- `POST /api/car/lead` — submit car buying inquiry
- `POST /api/car/save` — save a listing to favourites
- `POST /api/car/sell` — submit car sell request
- `POST /api/car/link` — link a listing to a vehicle's service history

### Cron (1 route)
- `POST /api/cron/daily` — stale booking expiry, retention triggers (called by Vercel cron)

### Account (1 route)
- `DELETE /api/account/delete` — account deletion (deletes Firebase Auth user + all customer data)

### Referrals (1 route)
- `POST /api/referral/claim` — claim a referral code

### Welcome (2 routes)
- `POST /api/welcome/complete` — mark onboarding as complete
- `POST /api/welcome/reset` — reset onboarding (dev/admin use)

### Reports (1 route)
- `POST /api/report` — unauthenticated client error reporting (**security gap: no auth, no rate limit**)

---

## 4.5 Business Logic

### Booking lifecycle
```
pending → confirmed → vehicle_received → in_progress → quality_check → ready_for_delivery → completed
                                                                                            ↘ cancelled
                ↘ expired (if not confirmed within 2h of creation)
```
- `pending`: Customer has submitted; server has assigned bay and price; waiting for studio acknowledgement
- `confirmed`: Studio has acknowledged
- `vehicle_received`: Car physically at studio; intake inspection done
- `in_progress`: Active work begun
- `quality_check`: Work complete; inspector reviewing
- `ready_for_delivery`: QC passed; awaiting customer collection or delivery
- `completed`: Car delivered; visit sealed; payment confirmed
- `cancelled`: Cancelled by customer or admin
- `expired`: Auto-expired by cron if not confirmed within window

### Payment model (no gateway)
1. Studio initiates payment intent (sets `paymentStatus: pending_payment`, notifies customer)
2. Customer submits UPI transaction reference number (customer's claim only — not verified)
3. Studio opens their UPI app, confirms the transaction reference is real
4. Studio marks job/booking as paid (`PATCH /api/payment/settle`) — this is the authoritative payment confirmation
5. Only at step 4 does the customer's access to the "paid" state unlock

**AutoDeck implication**: This model works only at low volume with a trusted customer base. At scale, it creates fraud risk (fake reference numbers) and staff overhead. AutoDeck must use a real payment gateway.

### Membership tiers
| Tier | Monthly price (INR) | Monthly washes | Service discount |
|---|---|---|---|
| Silver | ₹1,499 | 4 | 10% |
| Gold | ₹2,999 | 8 | 15% |
| Platinum | ₹5,999 | 16 | 20% |

- Wash coverage: covers the Washing service line item to ₹0 (wash becomes free)
- Service discount: applies to all other services except washing when wash is covered
- Cannot stack membership discount with any other discount
- Cancelled booking: wash count is restored atomically in the same Firestore transaction as the cancellation

### Service catalogue (from `lib/catalogue/`)

**PPF** (protection bays only):
| Product | Price (INR) | Duration | Warranty |
|---|---|---|---|
| LLumar Gloss | ₹1,45,000 | 2,880 min (2 days) | 5 years |
| LLumar Platinum | ₹2,05,000 | 3,600 min (2.5 days) | 10 years |
| LLumar Valor | ₹2,20,000 | 4,320 min (3 days) | 12 years |
| Garware Plus | ₹85,000 | 2,880 min | 5 years |
| Garware Premium | ₹1,05,000 | 2,880 min | 8 years |
| Garware Platinum | ₹1,45,000 | 3,600 min | Lifetime |

**Ceramic Coating** (protection bays):
| Product | Price (INR) | Duration |
|---|---|---|
| Kovalent Prolong | ₹10,000 | 480 min |
| Graphene Matrix | ₹12,000 | 720 min |
| Borophene | ₹14,000 | 840 min |

**Washing** (wash bays):
| Service | Price (INR) | Duration |
|---|---|---|
| Regular | ₹500 | 45 min |
| Premium | ₹1,000 | 60 min |
| Detail SPA | ₹2,500 | 90 min |
| Dry Clean | ₹4,000 | 120 min |
| Roof Cleaning | ₹800 | 30 min |
| Headlight Buffing | ₹400 | 20 min |

**Other Coatings** (protection bays):
| Service | Price (INR) | Duration | Warranty |
|---|---|---|---|
| Teflon | ₹5,000 | 120 min | 6 months |
| Glass Coating | ₹1,200 | 60 min | 3 months |
| Maintenance Coat | ₹4,500 | 90 min | 1 year |

### Bay model
- **protection-1, protection-2, protection-3**: PPF, ceramic, coating services
- **wash-1, wash-2**: Washing services only
- Bay assignment is server-side only. Client has no knowledge of bay IDs.
- Walk-in jobs consume bay capacity identically to bookings.
- `studioConfig.disabledBays[]` allows admin to take a bay offline (maintenance, repair).

### Duration model
- Service duration is expressed in minutes of elapsed working time
- Working hours: 09:00–19:00 (600 working minutes per day)
- Buffer between jobs: 15 minutes (configurable via studioConfig)
- A PPF job requiring 2,880 minutes = 4 working days + 480 minutes into day 5
- Multi-day jobs hold the bay from start to end without releasing overnight
- End time calculation must account for the 09:00 start of each subsequent day

### Pricing engine
All pricing is a pure server-side computation in `lib/pricing/priceVisit.ts`:
1. Start with base service price from catalogue
2. Apply membership discount (if applicable) — exclusive with all other discounts
3. Apply pickup/drop fee (₹50/leg, snapshotted at booking)
4. Apply GST (rate hardcoded at 18%, not currently applied — studio has no GSTIN)
5. Return breakdown object

The client can never submit or influence the price. The server ignores any price field in the request.

---

## 4.6 Security Assessment

### Well-designed

**Server-only critical writes**: Price, `paymentStatus`, membership `status: active`, protection `status: verified`, job status transitions — none of these can be written by a browser. Every one goes through a Next.js API route backed by the Firebase Admin SDK.

**Firestore rules are granular and correct**: Each collection's rules reflect the business ownership model. Comments explain the security intent. Rules have been updated to fix historical bugs (evidenced by comment trail).

**Structural ownership**: Vehicle ownership is proven by path (`users/{uid}/vehicles/{id}`) not by checking a `userId` field. This prevents a class of IDOR vulnerabilities where an attacker guesses another user's vehicle ID.

**Price never from client**: The booking creation and visit sealing routes ignore any price values the client might include. The server re-derives the price from the authoritative catalogue on every write.

**Idempotency is atomic**: The `bookingIntents` idempotency marker is written in the same Firestore transaction as the booking document. This means it is impossible for a booking to be created without an idempotency marker, and impossible for the marker to exist without a corresponding booking.

**Invoice token non-guessable**: The public invoice token is a server-generated UUID. The invoice is only accessible to its token holder (anonymous, not auth-gated). The shareable link is designed for sending to insurance companies or buyers.

### Missing — critical gaps

**Zero rate limiting on all 37 API routes**: Every endpoint is open to unlimited repeated requests. An attacker can spam booking creation, membership claims, approval submissions, or account deletion without restriction. This is a day-one production risk at any meaningful scale.

**Zero schema/input validation**: No Zod, Yup, or any schema validation library is used on any of the 37 routes. Malformed inputs produce unhandled 500 errors or silently write corrupt data to Firestore. This includes all financial routes.

**isAdmin() reads Firestore on every rule evaluation**: The `isAdmin()` function in Firestore rules calls `get(/databases/$(database)/documents/users/$(request.auth.uid))`. This read is billed and adds latency to every database operation by any user. Firebase Custom Claims would move role information into the JWT, eliminating this N+1 read.

**Timing side channel on invoice token**: The invoice token comparison in `/api/invoice/[id]` uses a standard equality comparison (`===`) which is not constant-time. A sufficiently precise timing oracle could theoretically enumerate valid tokens character by character. Should use `crypto.timingSafeEqual()`.

**Unauthenticated error reporting endpoint**: `/api/report` accepts POST requests with no authentication or rate limiting. This can be abused to flood the error log or to probe server behaviour.

**`feedback` collection allows unauthenticated writes**: The `feedback` collection (invoice satisfaction ratings) accepts public writes via API with no authentication gate. Anyone can submit a rating for any invoice token they possess (or guess).

---

## 4.7 Known Production Issues

### The seal path has never run in production
The `visits` collection contains exactly 4 documents — all seeded fixtures. Every one of the 8 completed jobs in the production database produced zero visit records. The seal path — `POST /api/visit/seal` — has never been called with a real customer's data.

This means the following systems have never been exercised in production:
- Terms captured at seal (warranties frozen at completion)
- Service history generation from sealed visits
- Customer receipt of a sealed visit record
- Payment settlement flow based on a sealed visit
- The `/history/[id]/settle` payment route
- The `/chapter/[id]` vehicle chapter view (0% implemented regardless)

The implication for AutoDeck is that the seal architecture is conceptually correct but entirely unvalidated. Rebuilding it must prioritise actually running the seal path in production from the first real job.

### Jobs and customers joined by plate string
Of the 18 jobs in the production database, 15 carry no `customerId` field. The current join between jobs and customers is done by matching the vehicle's `registrationNumber` string. This is fragile because:
- Plate strings are manually entered and inconsistently formatted (uppercase/lowercase, spaces)
- A plate string is not a unique identifier across all customers
- A customer who re-plates a vehicle breaks the join entirely

**AutoDeck implication**: The domain model must use IDs, not strings, for all joins. Vehicles must be identified by `vehicleId`, customers by `customerId`. No string-based joins in the core domain.

### washesTotal vs washesIncluded mismatch in live data
At least one production subscription document shows `washesTotal: 16` for a Gold plan which should provide `washesTotal: 8`. The disagreement between plan definitions and stored subscription fields suggests that membership tier definitions changed at some point after subscriptions were created, and no migration was run to update existing subscription documents.

**AutoDeck implication**: Membership plan terms must be stored verbatim on the subscription document at activation time (the same terms-at-creation principle as service warranties). A plan definition change should never silently alter the terms of existing active subscriptions.

---

## 4.8 Completion Status

legacy source app's own completion checklist (`LEGACY-COMPLETION.md`) estimates ~63% completion by weighted feature checklist. The following are confirmed as 0% implemented:

| Feature | Status | Note |
|---|---|---|
| `/chapter/[id]` vehicle service chapter | 0% | Route exists; returns nothing |
| Rate limiting | 0% | All 37 routes exposed |
| Request schema validation | 0% | All 37 routes unvalidated |
| Analytics instrumentation | 0% | No analytics provider |
| Email notifications to customers | 0% | No email provider |
| SMS notifications | 0% | No SMS provider |
| WhatsApp to customers | 0% | WhatsApp only sends to studio |
| Native iOS / Android app | 0% | Deferred by explicit decision |
| PWA install prompt | 0% | No A2HS prompt UI |
| Media upload UI | 0% | Cloudinary service exists; no customer-facing UI |
| Vehicle add/edit UI | 0% | API exists; no customer-facing form |
| Promo codes | 0% | Removed; collection deleted |
| Referral programme | 0% | Dead code; collection exists |
| Firebase Custom Claims | 0% | Roles via document reads only |

Confirmed production debt (implemented but broken or incomplete):
- Seal path: code exists; never run with real data (4 fixture documents only)
- Job-customer ID join: 15 of 18 jobs have no `customerId`
- Subscription amount discrepancy: at least 1 live subscription has wrong `washesTotal`
- Admin pages: 570+ inline style objects, 19 skeleton copies, 17 pages with silent `.catch(() => {})`, 4 different status colours across 4 screens for the same status

---

## 4.9 What AutoDeck Should Learn From This Codebase

These are the architectural insights worth preserving as principles in AutoDeck — not as code to copy, but as validated design decisions:

### 1. The authority model
Customer → studio → admin with distinct Firestore rule sets enforced at the database layer, not just the UI. The specific implementation (Firestore rules + Admin SDK API routes) is the right pattern. AutoDeck must replicate this at three layers: Firestore rules, Cloud Functions, and application guards.

### 2. The state machine approach
Modelling the booking and job lifecycle as a formal state machine (legal states, legal transitions, no arbitrary status writes) prevents a class of data corruption bugs. The state machine should be the single source of truth for what transitions are allowed, enforced on the server. AutoDeck should formalise this even further — consider XState or a similar explicit state chart library.

### 3. Pricing engine isolation
Pricing is a pure server-side function. The client cannot influence price. Price is always computed from the authoritative catalogue at write time. This principle must be absolute in AutoDeck — especially critical when payment gateway integration is involved (Razorpay in AutoDeck).

### 4. Terms captured at seal (immutability principle)
Service warranties, protection terms, and pricing breakdowns are captured at the moment of service completion and stored verbatim on the record. Future catalogue changes, price changes, or warranty period changes do not alter past records. AutoDeck must apply this principle to: service records, warranty certificates, membership terms at activation, pricing breakdowns on invoices.

### 5. Booking transaction atomicity
Bay assignment and booking creation happen inside a single Firestore transaction. The idempotency marker is written in the same transaction. This prevents double-booking and duplicate booking submission. AutoDeck's booking engine (in Cloud Functions) must maintain this atomicity guarantee.

### 6. Navigation resolver pattern
Renderers never build URLs or screen routes directly. They emit `NextAction` objects (intent, label, params) which a single resolver maps to navigation targets. This decouples the state machine from the navigation implementation — important when the same business logic drives both a web admin and a native mobile app. AutoDeck's deep link and in-app navigation architecture should adopt this pattern.

### 7. Structural ownership proofs in Firestore rules
Ownership of a vehicle is proven by the document being at `users/{uid}/vehicles/{id}` — not by checking a `userId` field on the document. This prevents IDOR vulnerabilities and makes rules simpler. AutoDeck's Firestore schema should be designed with ownership proofs built into the path structure.

### 8. Quiet mode / notification filtering
The concept of a customer-controlled notification suppression mode that overrides most notifications but still allows urgent ones (approval requests, vehicle ready) to break through is the right UX for high-touch service contexts. AutoDeck should implement this from day one.

### 9. Public invoice token (shareable without auth)
Allowing a visit summary or invoice to be shared via a token URL (no auth required) is a genuinely useful feature for customers who need to share service records with insurers, buyers, or employers. AutoDeck should implement this with constant-time token comparison and rate limiting.

### 10. Vehicle ownership consent log
The concept of a customer consenting to their vehicle's service history being publicly visible (for resale transparency) is worth revisiting for AutoDeck. The implementation is basic in legacy source app but the concept — treating service history as a vehicle asset that can be publicly verified — is a genuine product differentiator.
