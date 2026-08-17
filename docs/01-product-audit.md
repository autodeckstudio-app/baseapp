# 01 — Product Audit

**AutoDeck OS Architecture Phase · August 2026**

---

## 1.1 AutoModz PWA — Current State

### What the product is today

AutoModz is a Next.js 15 (App Router) Progressive Web Application running on Vercel, backed by Firebase (Firestore + Auth + FCM), with images stored on Cloudinary. It is an India-market product with INR pricing. Authentication is Google Sign-In only — no phone OTP, no email/password. There is no payment gateway; all transactions are UPI or cash settled manually at the studio counter. The product is approximately 63% complete by weighted feature checklist.

The codebase is version 4.0.0 and represents a significant engineering investment. The domain model is principled. The security architecture is well-conceived. The data model is rich. But large portions are aspirational — designed, even coded — but never exercised in production.

### What it does well

**Authority model**: The clearest engineering achievement. The product rigorously separates customer self-service authority from studio operational authority. Customers can never write to price, payment status, bay assignment, booking status, warranty validity, or service completion. Every critical mutation goes through a server-side API route backed by the Firebase Admin SDK. Firestore rules enforce this at the database layer. This is the correct design and AutoDeck must replicate it.

**State machine approach**: The home screen drives from a formally defined 11-state ownership state machine (`lib/os/lifecycle.ts`). Legal transitions are explicit. The UI renders against projected state, not raw Firestore documents. This architecture makes it impossible to accidentally show a customer the wrong state — the renderer is a pure function of the machine's output.

**Booking engine**: Server-side bay assignment inside a Firestore transaction. Named bays (protection-1/2/3, wash-1/2). Duration modelled as elapsed working minutes (09:00–19:00), with 15-minute turnover buffers between jobs. Multi-day PPF jobs hold the bay continuously. Walk-in jobs are counted against capacity. Idempotency via a `bookingIntents` collection written in the same transaction — preventing double-booking from rapid repeat taps.

**Pricing engine isolation**: The pricing function is a pure server-side computation. The client sends the service ID and any applicable membership ID. The server resolves everything else. The client cannot submit a price. This prevents any client-side manipulation of order value.

**Terms-captured-at-seal**: Protection warranties are frozen at the moment a visit is sealed. If the service catalogue warranty string is later edited by an admin, past customer protections are not affected. The `termsSource` field distinguishes between "captured at seal" (trustworthy), "reconstructed" (one-time migration), and "declared" (customer-submitted, studio-verified). This is the correct architecture for an immutable historical record.

**Firestore rules**: Granular, well-commented, and correct. Each collection's rules include a comment explaining the security intent. Structural ownership proofs (path-based, not field-matched) prevent cross-user data access. Admin writes are excluded from client paths entirely.

**Service catalogue**: The PPF, ceramic, washing, and coating catalogues are complete with accurate real-world brands, pricing, and durations. This is usable business intelligence for AutoDeck.

### What is structurally broken or missing

**The seal path has never run in production.** This is the most critical finding. The `visits` collection contains only 4 seeded fixture documents. All 8 completed jobs in the live database produced zero visit records. The entire downstream system — frozen warranties, customer receipts, payment settlement, service chapter view, immutable service history — depends on a code path that has never been executed with a real customer's data. The seal path is aspirational architecture, not a battle-tested system.

**Jobs and customers are not reliably linked by ID.** 15 of 18 jobs carry no `customerId`. Jobs are joined to customer records by vehicle registration plate string. This is fragile — plate strings are manually entered, inconsistently formatted, and not a primary key.

**No rate limiting on any of 37 API routes.** Every endpoint is open to unlimited repeated calls. This is a critical production risk at any meaningful scale.

**No schema validation on any of 37 API routes.** Malformed inputs produce 500 errors or silent data corruption rather than validated 400 rejections.

**Google Sign-In only.** In the Indian market, phone OTP is the dominant authentication pattern for automotive service apps. Google-only auth excludes customers without Google accounts and creates friction. AutoDeck uses phone OTP exclusively in V1.

**No payment gateway.** UPI reference numbers are submitted by customers and manually verified by studio staff. This is workable at very low volume but creates operational bottlenecks at scale and introduces fraud risk (customers could submit fake reference numbers).

**No email, no SMS to customers.** WhatsApp is sent to the studio only (internal notification). Customers receive only in-app and web push notifications. No email for booking confirmations, receipts, or marketing.

**No analytics provider wired.** Zero telemetry on customer behaviour, conversion, or feature usage.

**No Cloud Functions.** The Firebase project has Cloud Functions disabled (403). All server logic runs on Vercel's Edge Runtime/Node.js, not on Firebase's native compute.

**No native mobile app.** Explicitly deferred by architecture decision. FCM push notifications are web-only.

**Wash count inconsistency in live data.** At least one live subscription shows `washesTotal: 16` when the Gold plan should have `washesTotal: 8`. The Silver/Gold/Platinum plan definitions have drifted from stored subscription records.

**isAdmin() Firestore rule reads a document on every evaluation.** Role checking reads `users/{uid}` on every Firestore rule evaluation — an N+1 pattern. Firebase Custom Claims would eliminate this.

### Completion status (~63% weighted)

| Feature | Status |
|---|---|
| Authentication (Google) | ✅ Complete |
| Booking creation | ✅ Complete (server-authoritative) |
| Booking lifecycle (customer) | ✅ Complete |
| Bay allocation engine | ✅ Complete |
| Membership (Silver/Gold/Platinum) | ✅ Complete |
| Service catalogue | ✅ Complete |
| Customer home state machine | ✅ Complete |
| Admin dashboard | ✅ Complete |
| Admin job card | ✅ Complete |
| Firestore security rules | ✅ Complete |
| Employee management | ✅ Complete |
| Attendance tracking | ✅ Complete |
| Inventory management | ✅ Complete |
| Invoice generation | ✅ Complete |
| Cars marketplace | ✅ Complete |
| **Seal path (visits)** | 🔴 0% in production |
| **Service chapter view** | 🔴 0% |
| **Rate limiting** | 🔴 0% |
| **Schema validation** | 🔴 0% |
| **Analytics** | 🔴 0% |
| **Email notifications** | 🔴 0% |
| **SMS notifications** | 🔴 0% |
| **Native mobile** | 🔴 0% (deferred by decision) |
| **Media upload UI** | 🔴 0% (service exists, no UI) |
| **Vehicle add/edit UI** | 🔴 0% (service exists, no UI) |
| Phone OTP auth | 🔴 Not implemented |
| Promo codes | 🔴 Removed |
| Referral programme | 🔴 Dead code |
| WhatsApp to customers | 🔴 Not implemented |

---

## 1.2 Market Context

### AutoModz today vs AutoDeck target

> **AutoDeck launch market: India (Ahmedabad, Gujarat). Currency: INR. Timezone: Asia/Kolkata.**

| Dimension | AutoModz today | AutoDeck must be |
|---|---|---|
| Authentication | Google only | Phone OTP primary (India standard); no social login in V1 |
| Payment | Manual UPI, cash | Razorpay Payment Links (V1); UPI AutoPay for membership (V2) |
| BNPL | Not supported | Razorpay-native EMI/Pay Later (V2); no separate provider needed |
| WhatsApp | Studio-side only | First-class customer communication channel (Meta Cloud API) |
| Language | English | English primary; Hindi/Gujarati optional (V2) |
| App expectation | PWA only | Native iOS + Android required; no PWA for customers |
| Service pricing | ₹500–₹2,20,000 | INR; admin-managed pricing catalogue |
| Tax | Not computed | 18% GST default; configurable per tenant; snapshotted at booking |
| Notification channel | Web push only | Push + WhatsApp + Email |
| App Store presence | None | Apple App Store + Google Play (REQUIRES APPROVAL for accounts) |

### Premium automotive service sector characteristics

Customers spending ₹50,000–₹2,20,000+ on PPF, ceramic coating, or multi-day detailing are not comparing on price — they are comparing on trust, documentation, and outcome quality. The primary buying anxieties are:

- Will the studio damage my car?
- Will they do unauthorized work and charge me?
- Will the warranty actually be honoured if something goes wrong?
- Will I have proof of what was done if I sell the car?

The premium automotive service experience must answer all four questions visibly, at every touchpoint. This is fundamentally different from GoMechanic's mass-market model, which competes on price and speed. AutoDeck competes on certainty and quality of outcome.

### What GoMechanic's failure teaches us

GoMechanic's collapse in 2023 was not a product failure. The forensic audit revealed revenue inflation of 5–6x, with ~60 of 1,000 service centres involved in accounting violations and active round-tripping of funds into a separate entity (Morsebiz). The company spent ~$25M over two years on only $15M of actual revenue.

The lesson for AutoDeck is not that the automotive service platform model is broken — it demonstrably works and continues to work via competitors. The lesson is that rapid expansion without unit economics, combined with investor pressure to show growth, creates the conditions for fraud. AutoDeck must build a profitable unit before expanding to multiple studios.

The product model (transparent pricing, live tracking, digital documentation, warranty) is validated by GoMechanic's continued recovery and the premium detailing market gap in Ahmedabad where studios like CarzSpa operate without any customer-facing app.

---

## 1.3 The Gap

### What AutoModz is vs what AutoDeck needs to be

| Dimension | AutoModz today | AutoDeck must be |
|---|---|---|
| Platform | PWA (web only) | Native iOS + Android + Web Admin |
| Market | India | India — Ahmedabad, Gujarat (V1) |
| Auth | Google only | Phone OTP primary; no social login in V1 |
| Payments | Manual UPI | Razorpay Payment Links (V1); UPI AutoPay for membership (V2) |
| Notifications | Web push only | Push + WhatsApp + Email |
| Service documentation | Aspirational (seal path unrun) | Production-grade, sealed at completion |
| Warranty | Code exists, not battle-tested | Digital certificate, immutable, downloadable |
| Analytics | None | Day-one instrumentation |
| Rate limiting | None | Required before any public traffic |
| Schema validation | None | Zod on all routes |
| Customer auth types | Google account | Phone OTP + social |
| Employee auth | PIN-based kiosk | Proper role-based auth |
| Studio app | Admin web only | Dedicated native studio app |
| Booking engine | Good | Rebuild with resource model, validated in production |
| Scale | Single studio | Architecture supports multi-studio from day one |
| App Store presence | None | Required: Apple App Store + Google Play |

### Why a new product, not a migration

AutoModz carries significant production data and an existing customer relationship. Migrating it would mean:
- Maintaining backward compatibility with every existing Firestore document
- Carrying forward the plate-string join problem
- Inheriting the seal path debt
- Building native mobile on top of Next.js API routes designed for web
- Carrying forward the Google-only auth limitation

The cleaner path is AutoDeck as a distinct product, sharing only architectural lessons (not code) from AutoModz. AutoModz can continue serving its current customers as a separate product. AutoDeck starts from a clean domain model informed by — but not constrained by — the AutoModz implementation.

### What the PWA could continue as

AutoModz PWA can continue to operate for India-market customers. It could be:
- Maintained as a separate product with a separate Firebase project
- Eventually licensed or sold as a white-label PWA for automotive studios
- Used as the reference implementation for AutoDeck's business logic (not code)

---

## 1.4 Feature Classification

| Feature | Classification | Rationale |
|---|---|---|
| **Authority model** (customer vs studio vs admin) | KEEP | The most valuable architectural insight from AutoModz. Replicate the principle; rebuild the implementation. |
| **Booking engine** (bay allocation, transaction atomicity, idempotency) | REBUILD | The concept is correct. Rebuild in Cloud Functions with proper resource model, validated in production. |
| **Bay allocation** (named bays, capacity, duration) | REBUILD | Extend to a proper resource model (bay types, concurrency rules, buffer logic). |
| **State machine** (lifecycle, legal transitions) | REBUILD | Rebuild with a formal state chart library (XState or similar). Extend to cover studio app transitions. |
| **Membership / Club** | MODIFY | Keep the concept (wash allowances, service discounts). Redesign with Razorpay UPI AutoPay for recurring billing (V2). INR pricing configured by admin. |
| **PPF/Ceramic/Washing/Coating catalogue** | MODIFY | Keep the service structure and duration model. Admin-managed catalogue (not hardcoded). INR pricing. GST-inclusive or exclusive (configurable). |
| **Payment model** (UPI manual) | REPLACE | Replace with Razorpay Payment Links (V1). Customer pays via WhatsApp link in browser. Razorpay webhook confirms automatically. |
| **WhatsApp notifications** | MODIFY | Currently only to studio. AutoDeck must send WhatsApp to customers as first-class channel. |
| **Service history** | REBUILD | The concept is right but the seal path has never run. Rebuild from scratch with production-grade sealing, immutable records, downloadable PDF export. |
| **Protections/Warranties** | REBUILD | The terms-captured-at-seal principle is correct. Rebuild as a proper digital certificate system (generated PDF, sealed record, claim flow). |
| **Customers model** | MODIFY | Extend with phone number as primary identifier (not just Google UID), multiple auth methods, vehicle consent model, communication preferences. |
| **Vehicles model** | MODIFY | Keep the structure. Add VIN, make/model lookup, multiple photo types, mileage log. |
| **Admin dashboard** | REBUILD | The existing admin is a single-location web app with no component vocabulary. Rebuild in Next.js with proper design system. |
| **Employee management** | MODIFY | Keep the concept (roles, attendance, payroll). Redesign with proper auth (not PIN-kiosk). |
| **Attendance/Payroll** | KEEP (concept) | Solid data model. Rebuild implementation in new stack. |
| **Inventory** | MODIFY | Keep stock management. Add automated consumption from service completion. |
| **Car marketplace (buy/sell)** | REMOVE | Out of scope for AutoDeck. Separate business entirely. |
| **Referral programme** | DEFER | Dead code in AutoModz. May revisit for growth phase. |
| **Kiosk/walk-in** | MODIFY | Replace PIN-based kiosk with studio app walk-in registration. Staff auth should be proper Firebase Auth, not PIN hash. |
| **Cars buy-sell** | REMOVE | Separate business. |
| **Analytics** | REPLACE | AutoModz has zero analytics. AutoDeck will wire PostHog or Firebase Analytics from day one. |
| **Email/SMS** | REPLACE | AutoModz has neither. AutoDeck needs both (Resend/SendGrid for email; Twilio or WhatsApp for SMS/messaging). |
| **Native app** | ADD (net new) | Not in AutoModz. Core AutoDeck requirement from day one. |
| **Public service history consent** | DEFER | Interesting concept (customer consents to public service history for resale value). Revisit after core product is stable. |
| **Pricing engine (pure functions)** | KEEP | The architecture of isolating pricing as a pure server-side function is exactly right. Preserve this pattern. |
| **Navigation resolver** | KEEP (pattern) | The pattern of resolving intents to hrefs/screens through a single resolver prevents URL coupling in renderers. Apply to deep link resolution in native app. |
| **Quiet mode / notification preferences** | MODIFY | Keep the concept. Rebuild within the new notification architecture. |
| **Public invoice (shareable token)** | KEEP | Clean feature. Rebuild with constant-time token comparison (fix timing side channel). |
| **Ratings** | REBUILD | Basic in AutoModz. Rebuild with verified-purchase gate, response flow, aggregate display. |
| **Estimates** | MODIFY | Keep. Extend with multi-item estimates, PDF export, customer acceptance flow. |
