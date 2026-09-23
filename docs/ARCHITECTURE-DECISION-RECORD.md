# Architecture Decision Record

**Project:** AutoDeck OS  
**Date:** 2026-08-16  
**Status:** All ADRs are PROPOSED until explicitly accepted by the business owner and technical lead.

---

## ADR-001: React Native + Expo for Customer and Studio Mobile Apps

**Status:** Proposed  
**Date:** 2026-08-16

**Context:**
AutoDeck requires native iOS and Android applications for both customers and studio staff. The choice of mobile framework is the most consequential early technical decision — it determines hiring requirements, development velocity, performance characteristics, and long-term maintainability.

The existing legacy source app team (and this codebase) is TypeScript-native. The admin web and Cloud Functions are Next.js/Node.js TypeScript. A framework that shares the same language reduces context switching and enables code sharing via monorepo packages.

**Decision:**
React Native with Expo SDK (managed workflow initially, bare workflow available if needed). Expo Router for file-based navigation. EAS (Expo Application Services) for native builds, OTA updates, and App Store/Play Store submission.

**Alternatives Considered:**

*Flutter (Dart):*
- Pros: Own rendering engine → pixel-perfect cross-platform UI; excellent animation performance; growing ecosystem
- Cons: Dart is a separate language from the TypeScript codebase; team must learn Dart; no OTA updates without third-party Shorebird service; Figma-to-Flutter tooling less mature than React Native
- Rejected unless the hired mobile engineer has strong Flutter preference and minimal React Native experience

*Native Swift (iOS) + Kotlin (Android):*
- Pros: Best possible performance and platform integration; full access to all APIs
- Cons: Two codebases to maintain; twice the mobile development effort; higher team cost; not justified at this product stage
- Rejected

**Consequences:**
- All mobile developers must know TypeScript and React Native
- Expo managed workflow limits: native modules that require custom native code may require ejecting to bare workflow (documented escape hatch, not a blocker)
- OTA updates via EAS Update are available for JS-only changes — significant velocity advantage for bug fixes
- React Native New Architecture (Hermes + JSI) mitigates bridge performance concerns
- `packages/shared-types` and `packages/shared-utils` are shared between mobile apps, admin web, and Cloud Functions

---

## ADR-002: Firebase as Primary Infrastructure

**Status:** Proposed  
**Date:** 2026-08-16

**Context:**
AutoDeck needs: authentication (with phone OTP), a real-time database (live job status tracking is a core feature), file storage (vehicle photos, warranty certificates), push notifications, and serverless compute. The team already has Firebase experience from legacy source app.

**Decision:**
Firebase Auth + Firestore + Firebase Storage + Cloud Functions (Node.js 20) + Firebase Cloud Messaging (FCM). Three separate Firebase projects: `autodeck-dev`, `autodeck-staging`, `autodeck-prod`. Completely separate from legacy source app's Firebase project.

**Alternatives Considered:**

*Supabase + PostgreSQL:*
- Pros: PostgreSQL is a more powerful query engine than Firestore; real-time subscriptions via Supabase Realtime; open-source; no vendor lock-in
- Cons: No equivalent of FCM for push; no Firebase App Check equivalent; team has zero Supabase experience; real-time subscription model is different from Firestore; more infrastructure to manage
- Rejected primarily due to team expertise and FCM push notification integration

*Custom Node.js backend + MongoDB Atlas:*
- Pros: Full control; no vendor lock-in; can use any database
- Cons: Must build authentication, real-time, push notifications, storage from scratch; significant infrastructure overhead; higher DevOps burden; takes months to reach feature parity
- Rejected

**Consequences:**
- Firestore cost scales with reads/writes; dashboards that scan many documents can be expensive — must be designed with pagination and caching
- Complex aggregations and reporting queries are poor in Firestore; mitigated by BigQuery export (Phase 4)
- Vendor lock-in to Google Cloud ecosystem; acceptable given significant ecosystem benefits
- Firebase Security Rules provide a second layer of authorization enforcement (in addition to Cloud Functions)
- FCM handles push notification delivery to both iOS (via APNs) and Android natively

---

## ADR-003: Cloud Functions for All Business-Critical Writes

**Status:** Proposed  
**Date:** 2026-08-16

**Context:**
legacy source app had well-designed Firestore security rules but no validation layer between the client and Firestore for API calls. The result: 37 API routes with zero rate limiting and zero schema validation. Silent data corruption on malformed input, and no defence against brute force or abuse.

Additionally, some business logic (booking bay assignment, membership wash deduction, pricing) must execute atomically and cannot be split across client and server.

**Decision:**
All writes that affect price, booking status, job status, payment status, membership terms, warranty records, inventory levels, or employee data must go through Cloud Functions. Client-side Firestore writes are only permitted for non-critical, user-owned data (notification preferences, device tokens, display settings).

Every Cloud Function must implement, in order: auth verification → role check → Zod schema validation → rate limiting → idempotency → business logic → audit log.

**Alternatives Considered:**

*Firestore security rules only (direct client writes):*
- Pros: Lower latency; simpler architecture
- Cons: Rules cannot enforce rate limiting, schema validation, complex business logic, or cross-document atomicity; legacy source app proved this is insufficient; client can attempt invalid operations that are expensive even when rejected
- Rejected

*Custom REST API (separate server):*
- Pros: More familiar pattern; full HTTP semantics; easier to test
- Cons: Requires managing a server (Cloud Run, GKE) instead of serverless; Firebase Cloud Functions already provides the serverless compute — no additional infrastructure needed
- Rejected

**Consequences:**
- Every critical operation has a validated, rate-limited, audited code path
- Cloud Functions cold start adds latency for infrequent calls — mitigated with minimum instances (keep-warm) on high-frequency functions
- All business logic is in one place (functions/) — not split between client code, Firestore rules, and server code
- Easier to add rate limiting, metrics, and observability to a centralized function layer

---

## ADR-004: Firebase Custom Claims for Role Enforcement

**Status:** Proposed  
**Date:** 2026-08-16

**Context:**
legacy source app's Firestore security rules check the user's role by calling `get(resource.role from users/{uid})` on every rule evaluation. This means every document read triggers an additional Firestore read to check the user's role — doubling the read cost and adding latency to every security check.

AutoDeck needs a faster, more scalable role enforcement mechanism.

**Decision:**
User roles are stored in Firebase custom claims: `{ role: 'customer' | 'studio' | 'admin' }`. Claims are set by an admin-only Cloud Function when an employee is onboarded or when role changes. Firestore rules check `request.auth.token.role` — no additional document read required.

**Alternatives Considered:**

*Firestore document reads in rules (legacy source app approach):*
- Pros: Role always up-to-date; no cache delay
- Cons: Every security rule evaluation triggers an extra Firestore read; doubles read costs; adds 20-50ms latency to every request
- Rejected — explicit fix from legacy source app lesson

*Separate authentication service (Auth0, Clerk):*
- Pros: More sophisticated role and permission management
- Cons: Another third-party service; Firebase Auth is already in use; migration cost
- Rejected

**Consequences:**
- Role changes take effect when the user's ID token refreshes (up to 1 hour delay, or immediately on forced token refresh)
- User must sign out and back in to see a new role in some edge cases — acceptable trade-off
- Custom claims are set only by Cloud Functions with Admin SDK access — no client can self-assign a role
- Firestore rules become cheaper and faster: role check is a field lookup on the token, not a Firestore document read

---

## ADR-005: Turborepo Monorepo

**Status:** Proposed  
**Date:** 2026-08-16

**Context:**
AutoDeck has five codebases that share types and business logic: customer app, studio app, admin web, Cloud Functions, and shared packages. These must stay in sync — a type change in a shared entity (e.g., `Booking.status`) must surface as a TypeScript error in all consumers immediately, not be discovered at runtime.

**Decision:**
Turborepo monorepo with the following workspace structure:
- `apps/customer` — Expo app
- `apps/studio` — Expo app
- `apps/admin` — Next.js app
- `packages/shared-types` — TypeScript interfaces (all domain entities)
- `packages/shared-utils` — Pure utility functions
- `functions/` — Firebase Cloud Functions

**Alternatives Considered:**

*Separate repositories with published npm packages:*
- Pros: Independent CI/CD per repo; cleaner separation
- Cons: Every shared-types change requires: bump version → publish to npm → update each consumer → commit → review. This creates coordination lag. For an early-stage product where domain types change frequently, this is a major friction source.
- Rejected

*nx monorepo:*
- Pros: More powerful task orchestration; better caching
- Cons: Higher complexity; Turborepo is sufficient for this scale
- Rejected

**Consequences:**
- All repos are in one place — a single `git clone` gives access to everything
- TypeScript errors in shared-types surface immediately in all consumers (PR check fails)
- Turborepo build caching reduces CI time as the project grows
- Slightly more complex initial monorepo setup (worth it)

---

## ADR-006: Razorpay as Primary Payment Gateway

**Status:** Accepted  
**Date:** 2026-08-16 (revised 2026-08-17)

**Context:**
legacy source app has no payment gateway — all payments are manual (cash/UPI at counter). AutoDeck needs a real payment gateway for the India market (Ahmedabad, Gujarat). The dominant payment methods in India are UPI, cards, and net banking. Membership recurring billing requires UPI AutoPay (NACH mandate), which is the India-standard recurring payment mechanism.

**Cost classification:** TRANSACTION FEE only — 2% + 18% GST per transaction. No setup fee. No monthly subscription.

**Decision:**
Razorpay as the primary payment gateway. V1 payment method: Razorpay Payment Links (studio creates a server-side payment link; sends to customer via WhatsApp; customer pays in browser via UPI/card/net banking — no in-app card form required). V2: Razorpay Subscriptions (UPI AutoPay) for membership recurring billing.

**Alternatives Considered:**

*Stripe:*
- Pros: Excellent developer experience; well-known
- Cons: UPI AutoPay support is limited compared to Razorpay; not India-native; India UPI/net banking coverage is thinner; higher complexity for India-specific flows
- Rejected — Razorpay is the India standard and better fit for UPI-first market

*PayTm for Business / PhonePe for Business:*
- Pros: High brand recognition in India
- Cons: Weaker developer API; less suitable for B2B SaaS payment orchestration; Razorpay has better documentation and webhook reliability
- Rejected

*Manual UPI QR only (current legacy source app approach):*
- Pros: Zero integration cost
- Cons: No automatic payment confirmation; studio must manually verify every payment; not scalable; no refund automation
- Rejected — Razorpay Payment Links solve the same UX pattern but with full webhook confirmation

**Consequences:**
- Razorpay requires India-registered business entity with Indian bank account — REQUIRES APPROVAL before production account is activated
- Test sandbox is FREE — all development uses Razorpay test keys; no real charges during development
- Payment link flow: Cloud Function computes amount server-side → creates Razorpay Payment Link → sends via WhatsApp → customer pays → Razorpay webhook confirms → job status updated
- Webhook signature validated using `x-razorpay-signature` HMAC-SHA256 before processing
- Refunds are admin-only Cloud Function; customer cannot request refunds through the API
- BNPL (EMI, Simpl, LazyPay) available via Razorpay natively at checkout — no separate BNPL provider integration needed

---

## ADR-007: Separate Firebase Projects per Environment

**Status:** Proposed  
**Date:** 2026-08-16

**Context:**
legacy source app appears to have used a single Firebase project across environments (or minimal environment separation). This creates risk: developer code can accidentally affect production data; test writes appear in production analytics; security rules changes tested in dev can affect prod.

**Decision:**
Three Firebase projects: `autodeck-dev`, `autodeck-staging`, `autodeck-prod`. These are completely separate from any legacy source app Firebase projects. No shared resources between AutoDeck and legacy source app.

**Alternatives Considered:**

*Single project with collection prefixes (e.g., dev_bookings, prod_bookings):*
- Pros: Simpler; one set of credentials
- Cons: Security rules become complex; dev accidents can affect prod; Firebase Console is confusing; billing is combined
- Rejected

*Two projects (dev + prod, no staging):*
- Pros: Simpler than three
- Cons: No environment to test releases before production; database migrations are riskier
- Rejected

**Consequences:**
- Three sets of credentials to manage (mitigated by EAS Secrets and Firebase environment config)
- Firestore security rules must be deployed to all three projects (handled by GitHub Actions per-environment deploy)
- Firebase Emulator replaces the dev project for most local development — dev project is for integration testing with real Firebase APIs
- Completely isolated from legacy source app: no risk of AutoDeck code touching legacy source app data

---

## ADR-008: Firestore as Operational Database + BigQuery for Reporting

**Status:** Proposed  
**Date:** 2026-08-16

**Context:**
Firestore is excellent for real-time operational data (job status, booking details, live notifications) but poor for complex aggregations (revenue by service type, cohort retention analysis, cross-collection joins for reporting). Reports that require scanning many documents are expensive in Firestore.

**Decision:**
Firestore for all operational data (bookings, jobs, customers, vehicles, membership, payments, notifications). Firebase's built-in BigQuery export for analytics and complex reporting queries. Admin reporting dashboard queries BigQuery for historical/aggregate views (Phase 4+). Operational day-view reports (today's revenue, today's jobs) computed from Firestore directly.

**Alternatives Considered:**

*Firestore only (heavy denormalization for reports):*
- Pros: One database to manage
- Cons: Denormalization strategy for complex reports becomes extremely complex; Firestore aggregation queries are limited; cost scales badly with reporting workloads
- Rejected for anything beyond simple aggregations

*Cloud SQL (PostgreSQL) as a secondary read replica:*
- Pros: SQL is excellent for complex reporting; joins work naturally
- Cons: Must keep Firestore and PostgreSQL in sync (via Cloud Functions triggers); two databases to maintain and pay for; sync lag introduces reporting inaccuracies
- Viable as a Phase 5 option if BigQuery cost or latency is insufficient

*Migrate to Supabase/PostgreSQL entirely:*
- Rejected (see ADR-002)

**Consequences:**
- BigQuery reporting data has ~24-hour lag (streaming export delay)
- Real-time operational metrics (today's revenue, live bay status) still come from Firestore
- No SQL learning curve for simple operational queries — Firestore handles them
- BigQuery cost is very low at AutoDeck's initial scale (pay per query)

---

## ADR-009: Phone OTP as Primary Authentication Method

**Status:** Proposed  
**Date:** 2026-08-16

**Context:**
legacy source app uses Google Sign-In only. This is a mistake for the Indian market where phone-number identity is the dominant authentication pattern for automotive and service apps. Phone OTP eliminates friction for customers who do not use Google accounts, and is the standard approach for apps like GoMechanic, Zomato, Swiggy, and Ola.

Apple Sign-In is only required by the App Store when an app offers third-party social login (Google, Facebook, etc.). If AutoDeck uses phone OTP exclusively in V1 — with no social login — Apple Sign-In is NOT required and adds unnecessary complexity.

**Decision:**
Phone OTP (Firebase Auth phone sign-in) as the sole authentication method for V1 customer app and studio app. No Google Sign-In, no Apple Sign-In in V1. Email/password for admin web only.

By not offering social login in V1, Apple Sign-In is not required, avoiding approximately 2 weeks of additional implementation complexity.

**Alternatives Considered:**

*Google Sign-In only (legacy source app approach):*
- Rejected — excludes non-Google users; phone is the universal identity for Indian service customers

*Apple Sign-In as required secondary:*
- Not required when no social login is offered — deliberately excluded from V1

*Email/password as primary:*
- Rejected — friction is higher than phone OTP; email verification adds a step; not the India mobile-first pattern

**Consequences:**
- India country code (+91) pre-selected in phone number entry field
- Firebase Auth handles OTP SMS delivery — no external SMS provider needed for authentication
- First-time login: OTP → profile setup → done. No email required.
- Customer re-authentication on AutoDeck (after migrating from legacy source app): phone number is the linking key — if the customer's phone number matches a migrated record, their history is linked automatically
- If Google/Apple social login is added in V2+, Apple Sign-In must be added at the same time (App Store requirement)

---

## ADR-010: Append-Only Historical Truth

**Status:** Proposed  
**Date:** 2026-08-16

**Context:**
legacy source app had the right architectural instinct ("terms captured at seal") but the seal path never ran in production. The risk: a customer's warranty record could theoretically change if an admin later edits the service catalogue. A customer with a 5-year PPF warranty should not see that warranty change to 3 years because the business changed its pricing.

This principle extends beyond warranties: price breakdowns in completed bookings, invoice line items, and job status histories are all historical facts that must not change.

**Decision:**
The following records are immutable once written:
- `warranties/{id}`: all fields except `certificateUrl` once created at job completion
- `invoices/{id}/lineItems[]`: the snapshotted price and description at invoice creation
- `bookings/{id}/priceBreakdown`: the price at booking creation
- `jobs/{id}/statusHistory[]`: each entry is append-only; no entry is ever removed or modified
- `auditLog/{id}`: append-only; no document ever deleted

Implementation: Firestore security rules `deny write` on these documents/fields after creation; Cloud Functions only create new records, never update these fields.

**Alternatives Considered:**

*Mutable records with audit trail:*
- Pros: Simpler; always shows "current" state
- Cons: Current state ≠ historical promise; audit trail shows what changed but doesn't enforce immutability; customer legal promises can be violated
- Rejected

*Event sourcing (all changes as events, state computed from events):*
- Pros: Theoretically perfect historical accuracy; powerful replay
- Cons: Significant complexity overhead; overkill for a 5-bay studio; Firestore is not a natural fit for event-sourced reads
- Rejected as too complex for current scale

**Consequences:**
- Storage grows over time — acceptable (Firestore storage is cheap; documents are small)
- Past warranties are reliable forever, regardless of catalogue changes
- Pricing decisions today affect future warranty records (warranty template is snapshotted at job completion — once captured, it's permanent)
- Invoice line items reliably show what the customer paid for, even if service names change
- `jobStatusHistory` is an append-only array embedded in the job document — no subcollection needed at current scale (< 20 status events per job)

---

## ADR-011: Multi-Tenant SaaS Architecture

**Status:** Accepted  
**Date:** 2026-08-17

**Context:**
AutoDeck is designed as an automotive service operating system, not a single-studio product. legacy source app is the first tenant. Future studios/businesses must be addable without data migration or platform rewrite.

**Decision:**
Single Firestore database shared across all tenants. Every tenant-scoped document carries a `tenantId` field. Firestore security rules enforce `request.auth.token.tenantId === resource.data.tenantId`. Firebase custom claims carry `{ role, tenantId, studioId }`. Cloud Functions verify `tenantId` from the claim before every write — never from the request body.

**Pattern selected:** Pattern A (tenantId on every document) over Pattern B (nested collections) or Pattern C (separate databases per tenant).

**Alternatives Considered:**

*Separate Firestore database per tenant:*
- Pros: Complete data isolation at the infrastructure level
- Cons: Requires separate Firebase projects per tenant; high operational overhead at 10+ tenants; cross-tenant admin queries impossible
- Rejected at current scale; revisit for enterprise tenants with data residency requirements

*Firebase Auth native multi-tenancy:*
- Pros: Built-in tenant isolation at auth layer
- Cons: Designed for B2B SaaS with separate auth pools per tenant; AutoDeck has a shared customer identity model (one phone number = one Firebase UID across all tenants); adds complexity without benefit
- Rejected

**Consequences:**
- A Firestore security rules bug could expose cross-tenant data — mitigation: 100% rules test coverage required; Cloud Functions double-check tenantId on every write
- No `collectionGroup` queries without `tenantId` filter — enforced in Cloud Function query patterns
- Tenant onboarding is a SuperAdmin operation only (not self-service in V1)
- Customer identity is tenant-scoped: the same phone number across two tenants creates two separate customer records

---

## ADR-012: India (Ahmedabad) as Launch Market

**Status:** Accepted  
**Date:** 2026-08-17

**Context:**
AutoDeck's first operational deployment is legacy source app Detailing in Ahmedabad, Gujarat, India. All V1 architecture decisions must be optimized for this context.

**Decision:**
- **Currency:** INR (Indian Rupee) — configurable per tenant, INR is legacy source app default
- **Timezone:** Asia/Kolkata (IST, UTC+5:30) — configurable per studio
- **Phone country:** India +91 — pre-selected in phone entry UI
- **Firebase region:** `asia-south1` (Mumbai) — lowest latency for India; decided at database creation, cannot change
- **Tax:** 18% GST — configurable per tenant; snapshotted at booking creation
- **Payment:** Razorpay (see ADR-013)
- **WhatsApp:** Meta Cloud API — non-optional primary communication channel (USAGE COST ~₹0.115/utility message; FREE during development)
- **Language:** English primary; Hindi/Gujarati optional in V2

**Consequences:**
- No AED, no UAE, no Arabic, no RTL in V1
- GST replaces VAT; all price displays are INR
- App Store/Play Store developer accounts require India business entity — REQUIRES APPROVAL before opening

---

## ADR-013: Razorpay Payment Links as V1 Payment Flow

**Status:** Accepted  
**Date:** 2026-08-17

**Context:**
Indian premium automotive studios currently collect payment via manual UPI QR or in-person cash. AutoDeck must improve this without requiring customers to enter card details inside the app (high friction, significant security surface, delayed V1 scope).

Razorpay Payment Links allow the studio to trigger a server-side payment link that is sent to the customer via WhatsApp. The customer pays in their browser via UPI, card, or net banking — no in-app payment form needed.

**Decision:**
V1 payment flow: Razorpay Payment Links via WhatsApp. The amount is computed server-side (Cloud Function). The link is created server-side. The customer pays externally. Razorpay webhook confirms payment and triggers job status update.

**Cost classification:** TRANSACTION FEE — 2% + 18% GST. No subscription. Sandbox is FREE.

**V2 addition:** Razorpay in-app payment sheet (card/UPI inside the app) + Razorpay Subscriptions (UPI AutoPay for membership recurring).

**Consequences:**
- V1 requires no in-app payment SDK — reduces scope and security surface significantly
- Customer does not need to be in the app to complete payment
- Razorpay production account requires India-registered business — REQUIRES APPROVAL
- All Razorpay keys stored in Firebase Secret Manager; never in client bundles
