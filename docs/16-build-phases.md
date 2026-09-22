# 16 — Build Phases

**Principle:** Infrastructure before features. Studio operations before customer app. Test before ship.  
**Original plan date:** 2026-08-16  
**Status:** Historical build plan. Implementation is active and has moved beyond many unchecked items. See [21 - Current Implementation Status](21-current-implementation-status.md) for the current evidence-based view.

> The checkboxes below are the original forecast, not a maintained completion tracker. Do not infer that an unchecked item is absent from the codebase.

---

## 16.1 Phase 0: Foundation (Weeks 1–4)

**Goal:** Production-grade infrastructure exists. Zero application features. All developers can work locally and CI is running.

### Infrastructure

- [ ] Three Firebase projects created: `autodeck-dev`, `autodeck-staging`, `autodeck-prod`
- [ ] Firebase Auth configured: phone OTP, Apple Sign-In, Google Sign-In (all three projects)
- [ ] Firebase custom claims strategy implemented and documented
- [ ] Firestore region selected and databases initialized (all three projects)
- [ ] Firestore security rules skeleton committed (all collections, locked down by default)
- [ ] Firebase Storage configured (all three projects), bucket structure defined
- [ ] Cloud Functions project initialized (TypeScript, Node 20)
- [ ] Firebase Blaze plan: required for Cloud Functions deployment — credit card on file required — REQUIRES APPROVAL before activating production project; dev emulator is FREE
- [ ] Firebase Emulator Suite configured and working locally
- [ ] App Check configured (development debug, staging/production enforced)

### Codebase

- [ ] Turborepo monorepo initialized
- [ ] `packages/shared-types` created with all domain entity TypeScript interfaces
- [ ] `packages/shared-utils` created with pricing engine, status validator, utilities
- [ ] `apps/customer` Expo app created (Expo SDK 52+, expo-router, TypeScript)
- [ ] `apps/studio` Expo app created (same SDK and config as customer)
- [ ] `apps/admin` Next.js 15 app created (App Router, TypeScript, Tailwind, shadcn/ui)
- [ ] `functions/` Cloud Functions project created and linked to all three Firebase projects
- [ ] `firebase-config` package handles environment-based project selection

### Middleware

- [ ] Cloud Functions: authentication middleware (verify ID token, extract custom claim)
- [ ] Cloud Functions: role authorization middleware (check required role)
- [ ] Cloud Functions: Zod validation middleware (strict mode, reject unknown fields)
- [ ] Cloud Functions: rate limiting (Firestore token bucket — no Redis dependency at this stage)
- [ ] Cloud Functions: idempotency key middleware for mutations
- [ ] Cloud Functions: audit log writer (shared utility, called by all mutating functions)

### CI/CD

- [ ] GitHub repository: branch protection on main, PR required
- [ ] GitHub Actions: PR check (lint + typecheck + unit tests + emulator integration tests)
- [ ] GitHub Actions: merge to main → deploy functions to staging, deploy admin to Vercel staging
- [ ] EAS Build: development profile working (customer app + studio app)
- [ ] EAS secrets configured (Firebase configs, API keys)
- [ ] Vercel project configured for admin web (staging and production environments)

### Monitoring

- [ ] Firebase Crashlytics initialized on both mobile apps
- [ ] Sentry configured for Cloud Functions
- [ ] Firebase Performance Monitoring initialized on mobile apps
- [ ] Uptime monitoring configured (health endpoint on Cloud Functions)

### Testing Infrastructure

- [ ] Vitest configured for shared-utils and functions
- [ ] Firebase Emulator seed scripts written (base state, customer-with-vehicle, active-booking)
- [ ] Firestore rules test suite skeleton committed
- [ ] GitHub Actions emulator startup integrated

**Phase 0 Definition of Done:**

- A developer can clone the repo, run `turbo dev`, and have all three apps running locally connected to the dev Firebase project
- CI passes on a PR that changes a shared-types interface (surfaces type errors in all consumers)
- All three apps can be deployed to staging via GitHub Actions without manual steps

---

## 16.2 Phase 1: Core Operations (Weeks 5–16)

**Goal:** A customer can sign up, add a vehicle, and book a service. Studio can receive and operate the job. Admin can manage the business at a basic level.

**Ship order:** Studio App → Admin Web MVP → Customer App. Studio must be operationally ready before customers can book.

### Phase 1a: Auth & Customer Onboarding (Weeks 5–6)

- [ ] Customer app: phone OTP login flow (country code picker, OTP entry)
- [ ] Customer app: Apple Sign-In integration
- [ ] Customer app: Google Sign-In integration
- [ ] Customer app: welcome / onboarding (name, profile setup) — 3-step flow
- [ ] Customer app: add first vehicle (registration number, make, model, year, optional photo)
- [ ] Admin web: login (email/password)
- [ ] Cloud Function: `createCustomer` (validates, creates Firestore record, sets customer custom claim)
- [ ] Cloud Function: `createVehicle` (validates registration format, creates vehicle record)
- [ ] Firestore rules: customers can read/write own profile; vehicles owner-only
- [ ] Security rules tests: all customer auth rules covered

### Phase 1b: Service Catalogue & Booking (Weeks 7–10)

- [ ] Admin web: service catalogue management (add/edit/toggle services)
- [ ] Seed service catalogue in dev + staging (PPF, ceramic, washing, coating from AutoModz)
- [ ] Customer app: service browser (category grid, service cards)
- [ ] Customer app: service detail (description, scope selector, add-ons, price preview)
- [ ] Customer app: availability slot picker (calls Cloud Function)
- [ ] Customer app: booking review screen (full price breakdown)
- [ ] Customer app: booking confirmation screen
- [ ] Cloud Function: `getAvailability` (slot computation per booking engine spec)
- [ ] Cloud Function: `createBooking` (full transaction: bay assignment + membership deduction + idempotency)
- [ ] Cloud Function: booking confirmation notification (push + WhatsApp)
- [ ] Firestore rules: bookings owner-read-only; no client writes to price/status/bayId
- [ ] Integration tests: booking creation (happy path, concurrent, idempotency, membership deduction)
- [ ] Admin web: booking calendar (week view, bay swim lanes)
- [ ] Admin web: booking list (filterable, paginated)
- [ ] Admin web: booking detail + confirm action
- [ ] Studio app: job queue (today's jobs)

### Phase 1c: Studio Operations (Weeks 11–14)

- [ ] Studio app: employee login (phone OTP)
- [ ] Cloud Function: employee setup (custom claim: role=studio)
- [ ] Studio app: job card (full detail view)
- [ ] Studio app: status advancement (VEHICLE_RECEIVED → IN_PROGRESS → QUALITY_CHECK → READY_FOR_DELIVERY → DELIVERED)
- [ ] Cloud Function: `advanceJobStatus` (validates transition, writes statusHistory, sends notification)
- [ ] Studio app: photo capture per stage (expo-camera, signed upload URL)
- [ ] Cloud Function: `signPhotoUpload` (validates auth + ownership → returns signed URL)
- [ ] Cloud Function: `advanceJobStatus` sends push + WhatsApp notification to customer on key transitions
- [ ] Studio app: create approval request (description, price impact, time impact, photos)
- [ ] Customer app: approval request screen (view details, approve/reject)
- [ ] Cloud Function: `createApproval`, `respondToApproval`
- [ ] Studio app: bay board (visual grid)
- [ ] Studio app: walk-in registration (phone lookup → customer → vehicle → service → bay → create job) — V1 scope per doc 20
- [ ] Cloud Function: `createWalkinJob` (direct bay assignment; bypasses booking slot engine; Firestore transaction)
- [ ] Firestore rules: job status write by studio only; customer read-only
- [ ] Integration tests: all valid job status transitions; all invalid transitions rejected; approval lifecycle; walk-in job creation

### Phase 1d: Payment (Manual) & Invoice (Weeks 13–14)

- [ ] Studio app: record manual payment (cash/bank transfer + reference)
- [ ] Cloud Function: `recordManualPayment` (studio-only, marks payment as paid, triggers notifications)
- [ ] Cloud Function: `generateInvoice` (creates invoice document + PDF via PDF library)
- [ ] Firebase Storage: invoice PDF stored, signed URL generated
- [ ] Studio app: invoice preview + send to customer (WhatsApp link)
- [ ] Customer app: view invoice (from notification deep link or history)
- [ ] Public invoice URL (unauthenticated, token-based): `/invoice/{token}`
- [ ] Firestore rules: payments — no client writes; invoices — customer read-only by token

### Phase 1e: Admin Web MVP (Weeks 13–16)

- [ ] Admin web: dashboard (jobs by status, bay utilization, revenue today, alerts)
- [ ] Admin web: customer list + customer 360 view
- [ ] Admin web: job card view (full read, status advance)
- [ ] Admin web: employee management (add employee, assign role)
- [ ] Admin web: studio settings (bays, operating hours, holidays)
- [ ] Admin web: service catalogue management (complete)
- [ ] Firestore rules: admin can read/write all collections
- [ ] Integration tests: admin-only operations (price override, employee role change)

**Phase 1 Definition of Done:**

- Customer: sign up → add vehicle → browse services → book → receive push + WhatsApp confirmation → view live status → receive "vehicle ready" notification → view invoice
- Studio: view job queue → open job card → advance status → add photos → record payment → generate invoice
- Admin: view dashboard → confirm booking → view customer 360 → manage service catalogue

---

## 16.3 Phase 2: Payments & Membership (Weeks 17–24)

**Goal:** Real payment gateway integrated. Membership system complete. Pickup/drop operational. Walk-in flow complete.

### Payments (Razorpay — V1 Payment Links)

- [ ] Razorpay sandbox account configured (FREE; test keys only — no real charges)
- [ ] Cloud Function: `createPaymentLink` (amount computed server-side from jobId; returns paymentLinkUrl)
- [ ] Cloud Function: Razorpay webhook handler (`payment_link.paid`, `payment.failed`) with `x-razorpay-signature` validation
- [ ] Studio app: "Send payment link" triggers Cloud Function → WhatsApp message sent to customer with link
- [ ] Razorpay → payment record update → job payment status update → customer notification
- [ ] Admin web: refund initiation (admin-only Cloud Function calling Razorpay refund API)
- [ ] Integration tests: payment link creation (amount never from client); webhook processing; refund
- [ ] NOTE: Razorpay production account requires India business entity — REQUIRES APPROVAL before activation

### Membership

- [ ] Cloud Function: `joinMembership` (creates pending membership record, amount due)
- [ ] Customer app: membership page (tier comparison, join flow, payment via Razorpay Payment Link in V1)
- [ ] Cloud Function: `activateMembership` (admin-only; verifies payment; sets active; sets dates)
- [ ] Admin web: membership management (pending activations list, activate CTA, membership analytics)
- [ ] Cloud Function: membership discount in booking engine (exclusive with promo)
- [ ] Cloud Function: wash deduction in booking transaction (atomic)
- [ ] Customer app: membership status on home screen + in You tab
- [ ] Cloud Function: membership expiry cron (daily check, expiry notifications)
- [ ] Integration tests: membership activation, wash deduction atomicity, discount calculation

### Pickup & Drop

- [ ] Customer app: pickup/drop address entry in booking flow (Google Places autocomplete)
- [ ] Booking engine: pickup fee + drop fee in price breakdown
- [ ] Studio app: pickup scheduling (set pickup date/time for confirmed bookings)
- [ ] Cloud Function: pickup notifications (customer notified when pickup scheduled, en route)
- [ ] Pickup/drop sub-status advancement via studio app

### Walk-in Flow

> **Scope note:** Basic walk-in registration (studio app) is V1 scope (Phase 1c). This Phase 2 entry covers admin web visibility and any Phase 2 enhancements. Doc 20 is authoritative for V1 scope.

- [ ] Admin web: walk-in jobs visible in daily view (operator dashboard)

### Ratings

- [ ] Cloud Function: `submitRating` (triggered after DELIVERED status; customer can rate 1-5 + comment)
- [ ] Customer app: rating prompt appears after delivery confirmation
- [ ] Admin web: rating history per job, average by service type

---

## 16.4 Phase 3: Premium Features (Weeks 25–34)

**Goal:** The product feels premium. Warranty certificates, full service history, email notifications, and rich admin tools.

### Warranty Certificates

- [ ] Cloud Function: `sealJob` (triggered on DELIVERED; freezes warranty terms; generates PDF certificate)
- [ ] PDF generation: warranty certificate with product, coverage, dates, installer, QR code
- [ ] Firebase Storage: certificate stored at `warranties/{warrantyId}/certificate.pdf`
- [ ] Cloud Function: signed URL for certificate download (7-day expiry)
- [ ] Customer app: warranty certificate view (premium visual card) + download PDF
- [ ] Email: warranty certificate sent to customer email on job completion
- [ ] WhatsApp: certificate download link sent to customer
- [ ] Integration tests: warranty created at seal; catalogue change after seal does not affect warranty

### Service History & Vehicle Passport

- [ ] Customer app: vehicle passport screen (full service history, all protections, all warranties)
- [ ] Customer app: job detail with all photos, timeline, invoice, warranty link
- [ ] Customer app: before/after photo comparison (swipe or side-by-side)
- [ ] Admin web: vehicle record by registration (full history view)
- [ ] Public service history consent (customer opt-in to share with vehicle future owners)

### Email Notifications

- [ ] Resend account configured (FREE TIER — 3,000 emails/month)
- [ ] Cloud Function: email trigger on key events (booking confirmed, job completed, invoice, warranty, membership)
- [ ] React Email templates: all email types in English (Hindi/Gujarati optional in V3)
- [ ] Customer email preference toggle (in You tab)

### Employee Management & Attendance

- [ ] Studio app: check in / check out (attendance)
- [ ] Studio app: break management
- [ ] Admin web: attendance calendar view per employee
- [ ] Admin web: payroll calculation (monthly, from attendance + salary record)
- [ ] Cloud Function: `recordAttendance` (studio-only)
- [ ] Cloud Function: `calculatePayroll` (admin-only)

### Inventory Management

- [ ] Admin web: inventory items (add/edit, stock quantity, low-stock threshold)
- [ ] Studio app: record consumption against job
- [ ] Cloud Function: `recordInventoryMovement` (atomic stock decrement)
- [ ] Admin web: inventory report (consumption by category, low-stock alerts)
- [ ] Admin web: receive stock delivery (addition)

### Advanced Reporting

- [ ] Admin web: revenue report (by date, service type, payment method)
- [ ] Admin web: job completion report (by service, by employee)
- [ ] Admin web: membership retention report
- [ ] Admin web: inventory consumption report
- [ ] CSV export for all reports

### Audit Log

- [ ] Admin web: audit log UI (searchable, filterable, paginated)
- [ ] All critical mutations verified to produce AuditLog entries (test coverage)
- [ ] CSV export for compliance

### Promotional Codes

- [ ] Admin web: create promo code (code string, discount%, service restriction, expiry, usage limit)
- [ ] Cloud Function: `applyPromoCode` (validates, applies discount — exclusive with membership)
- [ ] Customer app: promo code entry in booking review screen

---

## 16.5 Phase 4: Scale & Launch (Weeks 35–44)

**Goal:** App Store launch. Arabic localization. Performance validation. Security audit.

### App Store Submission

- [ ] Apple Developer account set up with India business entity — REQUIRES APPROVAL ($99/year)
- [ ] Google Play Developer account set up
- [ ] App Store screenshots, descriptions, preview video created
- [ ] Privacy manifest completed (iOS)
- [ ] Data safety form completed (Android)
- [ ] TestFlight beta testing (minimum 4 weeks with invited users)
- [ ] App Review submission → approval → publish
- [ ] Play Store closed testing → open testing → production

### Localization (Hindi/Gujarati — V3, deferred)

- [ ] Hindi/Gujarati UI string translations (LTR — no layout changes required)
- [ ] Hindi/Gujarati WhatsApp message templates registered (optional; English templates serve V1/V2)
- [ ] Devanagari/Gujarati typeface evaluation
- [ ] NOTE: Arabic/RTL is NOT planned for V1-V3. Defer to V3+ if business expands to Arabic market.

### Performance & Security

- [ ] Performance testing: all Cloud Functions within target P95 latency
- [ ] Load test: booking creation at 50 concurrent requests
- [ ] Firestore query performance at scale (synthetic test data: 10k customers)
- [ ] External security penetration test (OWASP Top 10)
- [ ] Full Firestore rules test coverage verified
- [ ] App Check enforced on all environments

### Multi-Studio Infrastructure

- [ ] `studioId` verified on all relevant documents
- [ ] Admin web: studio selector for multi-studio views
- [ ] Availability query: scoped to correct studioId
- [ ] Employee → studio assignment (staff see only their studio's jobs)

### BigQuery Reporting

- [ ] Firebase BigQuery export enabled
- [ ] Admin reports for revenue trends and cohort analysis via BigQuery queries
- [ ] Dashboard charts updated to use BigQuery for historical data

---

## 16.6 Phase 5: Deferred (Post-Launch)

These features are explicitly deferred. They require separate business decisions or significant additional investment. Do not begin these until Phase 4 is live and feedback is collected.

| Feature                                   | Reason Deferred                                                               |
| ----------------------------------------- | ----------------------------------------------------------------------------- |
| Car marketplace (buy/sell)                | Separate business model; not core to automotive service                       |
| Insurance API integration                 | Requires insurance broker partnerships and regulatory compliance              |
| Real-time driver tracking (pickup/drop)   | High complexity; driver app needed; meaningful only at scale                  |
| Loyalty points system                     | Beyond membership; requires separate programme design                         |
| Gift cards                                | Payment and redemption complexity                                             |
| Franchise / partner studio onboarding     | Multi-tenancy at scale; requires operations team                              |
| WhatsApp two-way chat                     | Significant product scope; customer support staffing required                 |
| EV-specific services                      | Service catalogue addition; no infrastructure change needed — simple Phase 3+ |
| Advanced AI scheduling (bay optimization) | Low value at single studio; relevant at 10+ bays                              |

---

## 16.7 Team Requirements by Phase

### Phase 0–1 (Foundation through Core Operations)

- 1 Senior Full-Stack Engineer (React Native + Firebase + Node.js) — technical lead
- 1 Mid Engineer (Next.js admin web + Cloud Functions)
- Design: freelance/contract designer (Figma screens for customer app and studio app)
- Total: 2 engineers + 1 designer

### Phase 2–3 (Payments through Premium Features)

Add:

- 1 Mid Mobile Engineer (Expo/React Native focus)
- 1 QA Engineer (manual + Maestro E2E automation)
- Total: 3 engineers + 1 QA + 1 designer

### Phase 4 (Scale & Launch)

Add:

- 1 Backend Engineer (Cloud Functions performance, monitoring, security)
- Designer: full-time or dedicated senior contract
- Total: 4 engineers + 1 QA + 1 designer

---

## 16.8 Infrastructure Cost Estimates

### Firebase (monthly, single studio, Phase 1 scale)

| Service                     | Estimate                   |
| --------------------------- | -------------------------- |
| Firestore reads/writes      | $30–80/month               |
| Cloud Functions invocations | $10–30/month               |
| Firebase Storage            | $5–15/month                |
| FCM                         | Free                       |
| Firebase Auth               | Free (up to 10k MAU/month) |
| **Total Firebase**          | **$45–125/month**          |

### External Services (monthly)

| Service                          | Estimate                                                          |
| -------------------------------- | ----------------------------------------------------------------- |
| Razorpay                         | 2% + 18% GST per transaction (no monthly fee) — TRANSACTION FEE   |
| WhatsApp messages                | ~₹0.115/utility message — USAGE COST                              |
| Resend (email)                   | FREE TIER (3,000/month); paid beyond                              |
| Firebase Crashlytics             | FREE                                                              |
| UptimeRobot                      | FREE TIER (50 monitors)                                           |
| EAS Build                        | FREE TIER (15 builds/month); $99/month beyond — REQUIRES APPROVAL |
| Vercel (admin web)               | FREE TIER (Hobby); $20/month Pro — REQUIRES APPROVAL              |
| **Total external (development)** | **₹0/month**                                                      |
| **Total external (production)**  | **Transaction fees only until traffic exceeds free tiers**        |

### Total Monthly (Phase 1–2 production)

Approximately **$220–385/month** in infrastructure, excluding payment processing fees.

At higher scale (Phase 4, 1000+ active customers):

- Firestore: $150–400/month
- Cloud Functions: $50–100/month
- Total Firebase: ~$200–500/month
- Total with external: ~$500–900/month

Still highly cost-effective compared to self-managed infrastructure.
