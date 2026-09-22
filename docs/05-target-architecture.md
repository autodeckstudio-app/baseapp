# 05 — Target Architecture

AutoDeck OS target architecture: Customer mobile + Studio mobile + Admin web, all backed by Firebase + Cloud Functions.

**Launch market:** India (Ahmedabad, Gujarat). Currency: INR. Firebase region: `asia-south1` (Mumbai).  
**Architecture model:** Multi-tenant SaaS. legacy source app is Tenant 1. tenantId on every document. See `docs/19-multitenant-saas-architecture.md`.  
**Cost constraint:** No paid services without explicit approval. See cost classifications below and in `docs/18-india-market-and-payment-architecture.md`.

---

## 5.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLIENT APPLICATIONS                          │
│                                                                     │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐ │
│  │  Customer App   │  │   Studio App    │  │    Admin Web App    │ │
│  │ React Native    │  │ React Native    │  │    Next.js 15       │ │
│  │ + Expo (iOS/    │  │ + Expo (iOS/    │  │    (Vercel)         │ │
│  │   Android)      │  │   Android)      │  │                     │ │
│  └────────┬────────┘  └────────┬────────┘  └──────────┬──────────┘ │
│           │                   │                        │            │
│           │  Firebase Auth    │  Firebase Auth         │ Firebase   │
│           │  ID Tokens        │  ID Tokens             │ Admin SDK  │
└───────────┼───────────────────┼────────────────────────┼────────────┘
            │                   │                        │
            ▼                   ▼                        ▼
┌─────────────────────────────────────────────────────────────────────┐
│               FIREBASE PLATFORM (asia-south1 — Mumbai, India)       │
│                                                                     │
│  ┌──────────────┐  ┌──────────────────────────────────────────────┐ │
│  │ Firebase     │  │           Cloud Functions (TypeScript)       │ │
│  │ Auth         │  │                                              │ │
│  │              │  │  HTTP Endpoints:                             │ │
│  │ Phone OTP    │  │   /bookings/create  /bookings/reschedule     │ │
│  │ (primary)    │  │   /jobs/*           /payments/*              │ │
│  │              │  │   /approvals/*      /memberships/*           │ │
│  │ Email (admin)│  │   /auth/*           /notifications/*         │ │
│  │              │  │                                              │ │
│  │ Custom Claims│  │  Firestore Triggers:                         │ │
│  │ {role:       │  │   onJobStatusChange → AuditLog + WhatsApp   │ │
│  │  customer|   │  │   onBookingCreate   → ServiceJob stub        │ │
│  │  studio|     │  │   onPaymentSettle   → Invoice + Warranty     │ │
│  │  admin,      │  │                                              │ │
│  │  tenantId,   │  │                                              │ │
│  │  studioId}   │  │                                              │ │
│  └──────────────┘  │  Pub/Sub Triggers:                           │ │
│                    │   daily-cron        → expire stale bookings  │ │
│                    │   membership-cron   → expire memberships      │ │
│                    │   warranty-reminders→ annual check alerts     │ │
│                    └──────────────────────────────────────────────┘ │
│                                    │                                │
│         ┌──────────────────────────┼──────────────────────────┐    │
│         ▼                          ▼                          ▼    │
│  ┌─────────────┐         ┌──────────────────┐      ┌──────────────┐│
│  │  Firestore  │         │ Firebase Storage  │      │  FCM (Push) ││
│  │             │         │                  │      │              ││
│  │ asia-south1 │         │ /vehicles/{id}/  │      │ Customer     ││
│  │ (Mumbai)    │         │ /jobs/{id}/      │      │ Studio       ││
│  │             │         │ /invoices/{id}/  │      │ tokens       ││
│  │             │         │ /warranties/{id}/│      │              ││
│  │ Offline     │         │ /gallery/        │      │              ││
│  │ persistence │         │                  │      │              ││
│  │ (mobile)    │         │ Signed URLs for  │      │              ││
│  │             │         │ private assets   │      │              ││
│  └─────────────┘         └──────────────────┘      └──────────────┘│
└─────────────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   EXTERNAL SERVICES (India)                         │
│                                                                     │
│  ┌──────────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │    Razorpay      │  │  WhatsApp    │  │  Resend (email)      │  │
│  │  (INDIA PRIMARY) │  │  Business    │  │  FREE TIER 3k/month  │  │
│  │                  │  │  API (Meta)  │  │                      │  │
│  │ UPI AutoPay      │  │              │  │  Invoices            │  │
│  │ Cards/Net Banking│  │ Booking      │  │  Warranty certs      │  │
│  │ Payment Links    │  │ Job updates  │  │  Receipts            │  │
│  │ EMI (via Razorpay│  │ Payment link │  │                      │  │
│  │   natively)      │  │ Invoice link │  │                      │  │
│  │ TRANSACTION FEE  │  │ USAGE COST   │  │  FREE TIER           │  │
│  └──────────────────┘  └──────────────┘  └──────────────────────┘  │
│                                                                     │
│  ┌──────────────────┐   ┌──────────────────────────────────────┐   │
│  │  Firebase        │   │  PDFKit (open-source, in Functions)  │   │
│  │  Analytics       │   │  Invoice + Warranty PDF generation   │   │
│  │  + BigQuery      │   │  FREE                                │   │
│  │  FREE            │   └──────────────────────────────────────┘   │
│  └──────────────────┘                                               │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 5.2 Frontend Architecture

### Customer App — React Native + Expo

**SDK:** Expo SDK 52+ (latest stable at build time). Use managed workflow initially; eject to bare only if a native module requires it.

**Core libraries:**

| Concern | Library | Rationale |
|---|---|---|
| Navigation | expo-router (file-based) | Deep links, URL schemes, type-safe params out of the box |
| Server state | TanStack Query (React Query v5) | Better caching, background refetch, offline/retry than direct Firestore SDK in RN; Firestore SDK used for real-time listeners only where live updates are essential (job status, approval) |
| Local UI state | Zustand | Lightweight; no boilerplate; isolated from server state |
| Secure storage | react-native-keychain | Biometric unlock, Keychain/Keystore for Firebase tokens and sensitive session data |
| Session tokens | expo-secure-store | Encrypted key-value for app-level preferences that don't need biometric gate |
| Push notifications | expo-notifications | Wraps FCM (Android) + APNs (iOS); handles permission, token management, foreground/background handlers |
| Camera | expo-camera | Vehicle photo capture at booking and vehicle addition |
| Image picker | expo-image-picker | Photo library selection + compression before upload |
| Deep links | expo-linking + expo-router | Each booking/approval/job is a deep-linkable screen |
| Analytics | Firebase Analytics | Event tracking; BigQuery export enabled |
| Crash reporting | Firebase Crashlytics | Automatic crash capture with breadcrumbs |

**Why React Query over direct Firestore SDK for server state:**
Firestore's real-time SDK is excellent for listening to live documents but has significant footguns in React Native: it holds network connections permanently, offline cache has different semantics than a query cache, and mixing it with navigation lifecycle requires careful cleanup. React Query gives a consistent loading/error/refetch model for all non-real-time data. Real-time listeners (job status, approval notifications) are used selectively and wrapped in custom hooks that clean up on unmount.

**Navigation structure (expo-router):**

```
app/
  (auth)/
    login.tsx
    verify.tsx
  (customer)/
    _layout.tsx           (tab navigation: My Car, Book, History, You)
    index.tsx             (My Car — vehicle state dashboard)
    book/
      index.tsx           (service selection)
      [serviceId]/
        scope.tsx
        schedule.tsx
        confirm.tsx
    history/
      index.tsx
      [jobId].tsx
    membership/
      index.tsx
    you/
      index.tsx
      vehicle/
        add.tsx
        [vehicleId].tsx
  (deep-link)/
    booking/[id].tsx
    approval/[id].tsx
    invoice/[id].tsx
    warranty/[id].tsx
```

**Build & Deploy:**
- EAS Build: cloud-hosted native builds (no local Xcode/Android Studio required)
- EAS Update: OTA JS-layer updates without App Store review (JS/assets only; no native module changes)
- EAS Submit: automated App Store and Google Play submission

### Studio App — React Native + Expo

Same Expo SDK, same core library set, different navigation and UX emphasis.

**Key differences:**
- Primary device: iPad (landscape-first layout)
- Camera-first: photo capture on job arrival, each status transition, completion
- Offline-capable job queue: Firestore offline persistence enabled; studio can update job status when connectivity drops and changes sync on reconnect
- Shared-device PIN flow: Studio employees share a single tablet; a lightweight PIN selector identifies the active employee for audit trail purposes. PIN is verified server-side (Cloud Function) — stored as bcrypt hash, never plaintext
- Studio-specific navigation: Jobs Board (kanban), Schedule (calendar), Customers, Inventory, Reports

**Navigation structure:**
```
app/
  (studio-auth)/
    login.tsx       (phone OTP — studio-specific account)
    pin.tsx         (employee PIN selector, after studio auth)
  (studio)/
    _layout.tsx     (tab navigation: Board, Schedule, Customers, Inventory, You)
    board/
      index.tsx     (kanban: RECEIVED → IN_PROGRESS → QUALITY → READY → DELIVERED)
      [jobId]/
        index.tsx
        photos.tsx
        payment.tsx
        approval.tsx
    schedule/
      index.tsx     (calendar view of bookings + jobs)
    customers/
      index.tsx
      [customerId].tsx
    inventory/
      index.tsx
      [itemId].tsx
    you/
      index.tsx     (studio settings, employee management)
```

### Admin Web App — Next.js 15

**Core setup:**

| Concern | Choice | Rationale |
|---|---|---|
| Framework | Next.js 15 (App Router) | Server Components enable zero-client-JS dashboards; familiar to legacy source app team |
| UI components | shadcn/ui + Tailwind CSS | Accessible primitives; unstyled by default; AutoDeck design tokens applied on top |
| Server state | TanStack Query (client) + Server Components (server) | SC for initial data load; TQ for real-time polling and mutations |
| Auth | Firebase Admin SDK (server-side session verification) | httpOnly cookies; never expose Firebase token to JavaScript |
| Forms | react-hook-form + Zod | Consistent validation same schemas as Cloud Functions |
| Tables | TanStack Table | Virtual scrolling for large data sets (booking history, audit log) |
| Charts | Recharts or Observable Plot | Reporting dashboards |

**Route protection:**
Next.js middleware reads session cookie → validates via Firebase Admin SDK → redirects unauthenticated requests to login. Role is read from custom claims in the decoded token — no Firestore read in middleware.

**Admin navigation:**
```
/admin
  /dashboard        (KPIs: revenue, bookings today, active jobs, inventory alerts)
  /schedule         (booking calendar, bay view)
  /jobs             (all jobs, filterable by status/date/bay)
  /jobs/[id]        (job card: status, photos, approvals, payment, invoice)
  /bookings         (all bookings)
  /customers        (customer list + CRM)
  /customers/[id]   (360 view: vehicles, history, membership, notes)
  /vehicles/[reg]   (vehicle lookup by plate)
  /memberships      (membership management)
  /invoices         (invoice list + PDF generation)
  /inventory        (stock levels, movements, low-stock alerts)
  /employees        (roster, attendance, payroll)
  /reports          (revenue, membership, job completion, bay utilisation)
  /audit-log        (immutable event trail)
  /settings         (studio config, bays, hours, notifications)
```

---

## 5.3 Backend Architecture

### Cloud Functions (Node.js 20 + TypeScript)

**All business-critical writes transit through Cloud Functions.** No client application writes directly to Firestore documents that contain operational truth.

**Function types used:**

| Type | Use case |
|---|---|
| `onRequest` (HTTP) | REST-style endpoints called by all three apps |
| `onCall` (Callable) | Studio app operations (slightly simpler auth context) |
| `onDocumentWritten` | Firestore triggers: audit log, denormalization, notifications |
| `onSchedule` | Cron jobs: booking expiry, membership expiry, warranty reminders |
| `onMessagePublished` | Async tasks via Pub/Sub: WhatsApp, email, PDF generation |

**Mandatory middleware on every HTTP function:**
1. Auth verification (Firebase ID token or session cookie)
2. Role assertion (custom claim check)
3. Rate limiting (per-IP + per-UID, using Firestore or Redis-backed counter)
4. Zod schema validation (reject malformed requests with 400 before any DB access)
5. Request ID injection (for log correlation)

**Function organisation:**
```
functions/src/
  api/
    bookings/    create.ts  reschedule.ts  cancel.ts  availability.ts
    jobs/        update-status.ts  assign-bay.ts  complete.ts
    payments/    create-intent.ts  settle.ts  refund.ts
    approvals/   request.ts  respond.ts
    memberships/ join.ts  activate.ts  cancel.ts  claim-wash.ts
    auth/        session.ts  set-role.ts
    vehicles/    add.ts  update.ts
    media/       sign-upload.ts  delete.ts
    notifications/ send.ts  mark-read.ts
    invoices/    generate.ts  send.ts
    warranties/  generate.ts
  triggers/
    booking-created.ts      → create ServiceJob stub, send confirmation
    job-status-changed.ts   → audit log, push notification, WhatsApp
    job-completed.ts        → generate invoice, generate warranty PDF
    payment-settled.ts      → update job paymentStatus, notify customer
  cron/
    expire-bookings.ts      → PENDING bookings older than 48h → EXPIRED
    expire-memberships.ts   → active memberships past endDate → EXPIRED
    warranty-reminders.ts   → upcoming warranty expirations → notify
  lib/
    middleware.ts
    firestore.ts
    auth.ts
    payment-provider.ts
    razorpay-provider.ts
    mock-payment-provider.ts
    whatsapp.ts
    email.ts
    pdf.ts
    audit.ts
    pricing.ts
    booking-engine.ts
```

**Custom claims strategy:**
Upon role assignment (employee linking, admin bootstrap), a Cloud Function calls `auth.setCustomUserClaims(uid, { role: 'studio' })`. All subsequent token verifications read the claim from the JWT — zero Firestore reads for role checks. Claims update propagates within 1 hour (token refresh); force-refresh available via client SDK for immediate effect.

---

## 5.4 Database Architecture

### Firestore

**Region:** `asia-south1` (Mumbai, India) — lowest latency for India; correct for Ahmedabad launch market. Decided at project creation — cannot be changed afterwards.

**Offline persistence:**
- Customer app: enabled (Firestore SDK offline cache for owned data)
- Studio app: enabled (critical for connectivity in service bay environments)
- Admin web: disabled (browsers; Server Components handle initial load)

**Security rules philosophy:**
- Role from custom claims: `request.auth.token.role == 'admin'` — no document reads in rules
- Ownership by document path, not field: vehicles are at `/vehicles/{id}` with `customerId` field; rule checks `request.auth.uid == resource.data.customerId`
- All operational writes blocked from client: bookings, jobs, payments, warranties, memberships have no client-writable rule paths — only Cloud Functions (Admin SDK, bypasses rules)
- Public readable: `/services`, `/studios` (name, hours, active bays only), `/gallery`

**Index strategy:**
All composite indexes documented in `firestore.indexes.json`. Key indexes:
- `bookings` by `customerId + status + scheduledDate`
- `bookings` by `studioId + scheduledDate + status`
- `jobs` by `studioId + status + createdAt`
- `jobs` by `customerId + completedAt`
- `payments` by `customerId + createdAt`
- `warranties` by `vehicleId + startDate`
- `memberships` by `customerId + status`
- `inventory` by `studioId + category`
- `auditLog` by `entityType + entityId + timestamp`

### Firebase Storage

**Folder structure:**
```
autodeck-prod/
  vehicles/{vehicleId}/
    primary.jpg
    photos/{timestamp}.jpg
  jobs/{jobId}/
    arrival/
    in-progress/
    completion/
    before-after/
  invoices/{invoiceId}/
    invoice.pdf
  warranties/{warrantyId}/
    certificate.pdf
  employees/{employeeId}/
    id-document.jpg
  gallery/
    {id}.jpg
  brand/
    logo.svg  wordmark.svg
```

**Access control:**
- Private assets (vehicles, jobs, invoices, warranties, employees): signed URLs with 1-hour expiry, generated by Cloud Function on authenticated request
- Public assets (gallery, brand): Firebase Storage public access rules
- Upload: client-side direct upload to Storage (avoids Cloud Function bandwidth costs) using short-lived signed upload URLs generated by Cloud Function

### Reporting — BigQuery

Firebase's Firestore Export to BigQuery runs nightly. Business intelligence queries (revenue by month, bay utilisation, membership churn, average job duration) run against BigQuery — no impact to operational Firestore performance.

If reporting needs near-real-time data before BigQuery maturity, Cloud Functions write selected aggregations to a `/reports` collection (daily revenue totals, bay utilisation counts) as a bridge solution.

---

## 5.5 Authentication Architecture

```
SIGN-IN FLOW (Customer)
  1. Enter India phone number (+91) → Firebase sends OTP via SMS
  2. Enter OTP → Firebase Auth verifies → issues ID Token
  3. ID Token → POST /api/auth/session → Cloud Function validates
     → sets role claim if first sign-in (customer)
     → returns httpOnly session cookie (admin web) or confirms token (mobile)
  4. Customer app stores token via Firebase SDK (auto-refresh)

SIGN-IN FLOW (Studio Employee)
  1. Studio account logs in via phone OTP (shared studio account)
  2. Employee selects their PIN on shared tablet
  3. PIN submitted to Cloud Function → validated → employee ID injected into session context
  4. All subsequent writes carry both studio auth UID + active employee ID

SIGN-IN FLOW (Admin Web)
  1. Email + password sign-in (Firebase Auth)
  2. ID Token → POST /api/auth/session → Cloud Function verifies admin role claim
  3. Sets httpOnly session cookie (7-day, rotated on activity)
  4. Next.js middleware validates cookie on every request

ROLE ASSIGNMENT
  - Customers: role = 'customer' set automatically on first sign-in
  - Studio accounts: role = 'studio' set by admin via /admin/employees → Cloud Function
  - Admins: role = 'admin' set by super-admin bootstrap or existing admin
  - Custom claims propagate: client must call user.getIdToken(true) to force refresh after claim change

APPLE SIGN-IN
  - NOT required in V1 — phone OTP is the only login method; no third-party SSO
  - Apple Sign-In is only required by App Store when an app offers Google/Facebook social login
  - AutoDeck V1 avoids this complexity by using phone OTP only
  - If Google Sign-In is added in a future version, Apple Sign-In must be added at the same time
```

---

## 5.6 Security Architecture

```
LAYER 1: Transport
  - All traffic HTTPS (enforced by Firebase, Vercel, App Store)
  - Certificate pinning: optional for high-security enterprise version; defer for v1

LAYER 2: Authentication
  - Firebase Auth validates identity
  - Custom claims encode role — no Firestore reads for role checks
  - Admin SDK in Cloud Functions bypasses rules (intentional; functions are trusted)
  - Client SDK subject to Firestore rules (defence layer)

LAYER 3: Firestore Security Rules
  - Role from token claim, not document lookup
  - Ownership by path or explicit customerId field match
  - Operational fields (status, price, paymentStatus) have no client-writable rule
  - Rules tested with firebase-emulator-suite + @firebase/rules-unit-testing

LAYER 4: Cloud Functions
  - Every HTTP function: auth check → role check → rate limit → schema validation
  - Rate limiting: 100 requests/min per IP, 20 booking creates/hour per UID
  - Zod schemas: reject unknown fields; validate types, ranges, lengths
  - Server-side pricing: amount is never read from request; always computed server-side
  - Idempotency keys: booking creation is idempotent on (customerId + serviceId + scheduledDate + scheduledTime)

LAYER 5: Payments
  - Razorpay Payment Link created server-side (Cloud Function); amount computed from jobId — never from client
  - Client receives only paymentLinkUrl; never sees amount computation
  - Payment status (paid/refunded) written only by Cloud Function after Razorpay webhook confirmation
  - Webhook signature verified (x-razorpay-signature HMAC-SHA256)

LAYER 6: Storage
  - Upload: signed upload URLs with 15-min expiry; Cloud Function enforces file type + size limits
  - Download: signed download URLs with 1-hour expiry; Cloud Function checks ownership before issuing
  - No direct public access to private assets

LAYER 7: Audit Trail
  - Every significant state change writes to /auditLog (append-only, Admin SDK only)
  - Firestore rules: /auditLog — no client reads (admin web reads via Admin SDK in server route), no client writes
  - Log includes: actorId, actorRole, action, entityType, entityId, before, after, timestamp, IP

KNOWN RISKS TO MITIGATE:
  - Firestore has no predicate locks — bay double-booking race window exists between query and transaction commit. Mitigation: short transaction window + admin confirmation queue
  - Token claim refresh lag (up to 1 hour after role change). Mitigation: force-refresh on role assignment flow
  - Rate limiting implemented in Cloud Functions, not at network level. Mitigation: add Firebase App Check for mobile clients
```

---

## 5.7 Notifications Architecture

**Event → Channel mapping:**

| Event | Push (FCM) | WhatsApp | Email | SMS |
|---|---|---|---|---|
| Booking confirmed | ✓ | ✓ | ✓ | — |
| Booking rescheduled | ✓ | ✓ | — | — |
| Booking cancelled | ✓ | — | ✓ | — |
| Pickup scheduled | ✓ | ✓ | — | — |
| Vehicle received | ✓ | ✓ | — | — |
| In progress update | ✓ | ✓ | — | — |
| Approval required | ✓ | ✓ | — | — |
| Vehicle ready | ✓ | ✓ | — | — |
| Payment request | ✓ | ✓ | — | — |
| Payment confirmed | ✓ | — | ✓ | — |
| Job completed | ✓ | ✓ | ✓ | — |
| Invoice issued | — | — | ✓ | — |
| Warranty generated | — | — | ✓ | — |
| Membership expiring | ✓ | — | ✓ | — |
| Warranty expiring | ✓ | — | ✓ | — |

**Implementation:**
- All notification sending happens in Cloud Functions (Firestore triggers or HTTP endpoints)
- Client never calls WhatsApp or email APIs directly
- FCM tokens registered on app launch; stored at `/customers/{id}/fcmTokens/{tokenId}` with platform tag; stale tokens cleaned up on FCM delivery failure
- WhatsApp: Meta Cloud API directly (free setup; ~₹0.115/utility message); English templates registered; Hindi optional for V2
- Email: Resend (free tier: 3,000 emails/month — sufficient for V1/V2); PDFKit for PDF attachments
- Quiet mode: customer preference suppresses all non-critical notifications; approval requests and vehicle-ready always delivered

---

## 5.8 Payments Architecture (India — Razorpay)

**Primary gateway: Razorpay.** No Stripe, no Tabby. India market. INR only.  
**Cost: TRANSACTION FEE (2% + 18% GST for UPI/cards). No subscription.**

```
RAZORPAY PAYMENT LINK FLOW (V1 — Primary)
  Used for: customer-to-studio payment after job is ready
  1. Studio marks job ready for payment (studio app → Cloud Function /jobs/ready-for-payment)
  2. Cloud Function: computes amount server-side (NEVER from request), creates Razorpay Payment Link
     → POST https://api.razorpay.com/v1/payment_links
     → { amount (INR paise), description, customer: { phone } }
  3. Returns { paymentLinkUrl, paymentLinkId }
  4. Cloud Function sends WhatsApp message to customer with paymentLinkUrl
  5. Customer opens link in any browser → pays via UPI/card/net banking
  6. Razorpay webhook → Cloud Function /webhooks/razorpay (validates x-razorpay-signature)
     → 'payment_link.paid' → update Payment doc, update Job paymentStatus → notify customer
  Note: Customer does not need to be in the AutoDeck app to pay. This matches India studio reality.

RAZORPAY SUBSCRIPTION FLOW (V2 — Membership Recurring)
  1. Customer joins membership in app → Cloud Function /memberships/join
  2. Cloud Function: creates Razorpay Subscription (plan, UPI AutoPay mandate)
  3. Returns { subscriptionId, shortUrl } — customer authorizes mandate in UPI app
  4. Webhook 'subscription.charged' → activate/renew membership on successful billing
  5. Webhook 'subscription.halted' → notify admin + customer, suspend membership

MANUAL PAYMENT FLOW (Cash / UPI QR at counter — V1)
  1. Studio employee marks manual payment received via Studio app
  2. Cloud Function /payments/settle-manual (studio auth required)
  3. Cloud Function writes Payment doc { method: 'cash' | 'upi_manual', reference, amount, collectedBy }
  4. Amount verified by studio employee — customer cannot self-mark as paid
  5. Triggers: invoice generation, payment confirmation notification

REFUND FLOW
  1. Admin initiates refund via Admin web → Cloud Function /payments/refund (admin auth only)
  2. Cloud Function: Razorpay Refund API for tracked payments; manual credit note for cash
  3. Payment document updated to status='refunded'
  4. Customer notified via push + WhatsApp
```

**Payment intent:** Amount is ALWAYS computed server-side. Client sends `{ jobId }` only. Cloud Function reads the job, computes the total from the priceBreakdown snapshot, and passes only that amount to Razorpay. Amount from the client request is ignored.

---

## 5.9 Storage & CDN

**Upload flow (avoids Cloud Function bandwidth costs):**
```
1. Client → Cloud Function /media/sign-upload
   (validates auth, validates file type/size, returns signed URL + objectPath)
2. Client → Firebase Storage (direct PUT to signed URL, 15-min expiry)
3. Storage trigger → Cloud Function: validate uploaded file type,
   compress/resize if needed (sharp library), generate thumbnail,
   update document with photoUrl
```

**Download flow:**
```
1. Client needs private asset URL
2. Client → Cloud Function /media/signed-url?path=jobs/xyz/completion/photo.jpg
   (validates auth, validates ownership, returns signed download URL, 1-hour expiry)
3. Client uses signed URL directly with Firebase Storage CDN
```

**Image optimisation:**
- Client-side: expo-image-picker resizes to max 1600px and JPEG quality 85 before upload
- Cloud Function trigger: further resize to max 1200px for delivery thumbnails
- Storage CDN: Firebase Storage CDN handles distribution; no separate CDN required at current scale

---

## 5.10 Infrastructure & DevOps

**Environments:**

| Environment | Firebase Project | Admin Web | Mobile | Purpose |
|---|---|---|---|---|
| dev | autodeck-dev | localhost:3000 | Expo Go / dev build | Local development |
| staging | autodeck-staging | staging.autodeck.app | TestFlight / Internal Track | QA and client review |
| production | autodeck-prod | app.autodeck.app | App Store / Play Store | Live |

**CI/CD:**

```
GitHub Actions:
  On PR:
    - TypeScript type check (all packages)
    - ESLint
    - Jest unit tests
    - Firestore rules tests (firebase-emulator-suite)
    - Cloud Functions build (tsc)

  On merge to main:
    - Deploy Cloud Functions to staging (firebase deploy --only functions)
    - Deploy Firestore rules + indexes to staging
    - Deploy admin web to Vercel (staging environment)
    - EAS Build + EAS Update for staging mobile apps

  On release tag:
    - Deploy to production (manual approval gate)
    - EAS Submit to App Store and Play Store (TestFlight / Internal Track)
    - EAS Submit to production on separate approval
```

**Secrets management:**
- Firebase project configuration: environment-specific `.env` files, never committed
- Third-party keys (Razorpay, WhatsApp/Meta API, Resend): stored in Firebase Secret Manager; accessed by Cloud Functions via `defineSecret()`
- GitHub Actions: secrets in GitHub repository secrets; never in source
- Mobile: no secrets ever bundled in app binary; all keys server-side

---

## 5.11 Monitoring & Observability

| Tool | Purpose |
|---|---|
| Firebase Crashlytics | Mobile crash reporting with stack traces and breadcrumbs |
| Firebase Performance | Mobile app startup, screen render, network request latency |
| Firebase Analytics + BigQuery | User behaviour events, funnel analysis, retention |
| Sentry | Cloud Functions error tracking with request context |
| Better Uptime (or similar) | Admin web and Cloud Function uptime monitoring; Slack/WhatsApp alerts |
| Firebase Emulator Suite | Local development with full stack emulation (Firestore, Auth, Functions, Storage) |
| BigQuery | Long-term operational analytics; Firestore export pipeline |

**Key alerts to configure from day one:**
- Booking creation failure rate > 1%
- Payment webhook failure (immediate)
- Cloud Function error rate spike
- Firestore quota warnings (reads/writes/deletes)
- Low inventory items below threshold (within app, not external alert)

---

## 5.12 Trade-offs and Alternatives Considered

### Flutter vs React Native + Expo

| Factor | Flutter | React Native + Expo |
|---|---|---|
| Performance | Excellent (own renderer) | Very good (Hermes + New Architecture) |
| Language | Dart (new language to learn) | TypeScript (already used in legacy source app) |
| Team ramp-up | 2–3 months for Dart | Minimal (same TS ecosystem) |
| UI fidelity | Pixel-perfect cross-platform | Platform-native feel by default |
| Expo ecosystem | N/A | Massive (managed workflow, EAS, OTA) |
| OTA updates | Shorebird (third-party) | EAS Update (Expo first-party) |
| Verdict | Best if team prioritizes UI fidelity over speed | **Selected**: team knows TypeScript; fastest path to production without sacrificing quality |

**Decision: React Native + Expo.** TypeScript continuity with the existing admin web codebase, Expo's managed workflow eliminates most native toolchain friction, and EAS provides production-grade build/OTA infrastructure.

### Firebase vs Custom Backend

| Factor | Firebase | Custom (e.g., Node + PostgreSQL) |
|---|---|---|
| Time to productive | Days | Weeks |
| Real-time updates | Built-in (Firestore) | Requires WebSocket/SSE infrastructure |
| Auth | Built-in (multi-provider) | Requires auth library + session management |
| Scaling | Automatic | Manual horizontal scaling |
| Complex queries | Weak (Firestore limitations) | Full SQL power |
| Cost at scale | Can be expensive (Firestore reads) | Cheaper at high read volume |
| Vendor lock-in | High | Low |
| Team familiarity | High (legacy source app used Firebase) | Medium |
| Verdict | Best for current scale | Preferred at GoMechanic scale |

**Decision: Firebase + Cloud Functions hybrid.** Firebase Auth, Firestore for operational data, Cloud Functions for all business logic. BigQuery for reporting. Re-evaluate at 10,000+ daily active users.

### Firestore-only vs Hybrid SQL

- **Firestore-only**: simpler operational model; works well for document-oriented operational data; poor for aggregate queries
- **Firestore + BigQuery export**: best of both; operational data stays in Firestore; analytics goes to BigQuery nightly; latency acceptable for reporting (T+24h)
- **Firestore + Cloud SQL**: adds operational complexity (two databases, two connection pools); warranted only if near-real-time reporting is required

**Decision: Firestore + BigQuery export.** T+24h reporting lag is acceptable for AutoDeck's current operational scale. Revisit if same-day revenue reconciliation becomes a hard requirement.

### Vercel vs Firebase Hosting for Admin Web

| Factor | Vercel | Firebase Hosting |
|---|---|---|
| Next.js support | First-party (Vercel built Next.js) | Good (via Cloud Run adapter) |
| Edge functions | Best-in-class | Via Cloud Run |
| Deployment DX | Excellent | Good |
| Firebase integration | Requires CORS/HTTPS config | Native |
| Price | Free tier generous | Free tier generous |
| Verdict | Best for Next.js | Adequate |

**Decision: Vercel.** Admin web is a Next.js app; Vercel has the best Next.js deployment support and preview deployments per PR.

### Expo Managed vs Bare Workflow

- **Managed**: Expo handles all native code; no Xcode/Android Studio required; upgrade Expo SDK to get new native capabilities; fastest
- **Bare**: full native code exposed; required for custom native modules not in Expo ecosystem

**Decision: Start managed.** Migrate specific packages to bare if a required native module is unavailable in Expo. Current feature list (camera, push, biometrics, deep links, keychain) is fully covered by Expo's managed ecosystem.
