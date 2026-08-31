# AutoDeck — AutoModz Audit & V1 Product Decisions

**Status: APPROVED.** This is the finalized product-decision record for AutoDeck V1, approved by the product owner. It reflects the current phase of the project per `CLAUDE.md`: architecture, repository structure, environments, security model, and development workflow are not yet started, and feature implementation has not begun.

---

## A. Executive Summary

AutoDeck is a new, independent automotive-service platform — native iOS/Android customer and studio apps, a customer-facing web experience, and a separate web admin — built for a **single fully-functional studio** in V1. AutoModz (the existing PWA) is reference material only: its concepts inform design, but no code, infrastructure, credentials, or data are reused. This document consolidates every product decision established during the AutoModz audit and V1 planning review into one finalized record. All product and permission questions are resolved — see the Final Approval Checklist.

---

## B. AutoModz Feature Inventory

**Customer-facing**: Google sign-in · Home (vehicle-state dashboard) · Garage · Vehicle detail (photos, protection cards) · Booking flow · Live visit tracking · Mid-visit approvals · History/Timeline (sealed) · Membership/Club · Profile · Cars marketplace · Shareable Chapter/Invoice links · Referrals · Push notifications · Offline fallback · Command palette · Welcome flow.

**Studio/Admin (web)**: Schedule/board · Bookings, jobs, customers, vehicles · Employees (attendance/payroll) · Invoices, expenses, quotes, close-of-day, reports · Inventory + recipes · Subscriptions management · Marketplace admin + leads · Promotions · Gallery · Walk-in intake · Settings · PIN-locked Kiosk mode.

**Cross-cutting**: Auth (Google for customers; single hardcoded owner email as admin; PIN for kiosk) · Payments (manual UPI, staff-confirmed) · Notifications (FCM push + WhatsApp links) · Automation (one daily cron; no event-driven backend, Cloud Functions disabled).

**Permission model (verified in code)**: flat `StaffRole = 'admin' | 'employee'`; job titles (`EmployeeRole = 'detailer' | 'washer' | 'manager' | 'helper'`) are metadata never checked by any rule.

---

## C. AutoDeck Features Worth Carrying Forward — CONFIRMED (as concepts, rebuilt fresh)

- Vehicle as the data spine (visits/protection/history attach to the vehicle)
- Unified "Protection" card concept (PPF/ceramic/insurance/PUC)
- Visit lifecycle with immutable sealing
- Mid-visit approval requests
- Layered engine/projection/renderer architecture pattern
- Intent-based navigation (screens don't hardcode routes)
- Studio-floor operational patterns (schedule board, job stage advancement, walk-in intake)

---

## D. Confirmed Decisions

1. AutoDeck is a completely new product. AutoModz is reference material only — no code, Firebase project, credentials, database, production data, secrets, configuration, Cloudinary, WhatsApp credentials, hosting, or payment configuration is reused.
2. Manual vehicle entry only in V1. No VIN/vehicle-lookup API dependency; may be considered later only with explicit approval.
3. V1 is single-studio. No multi-studio UI, onboarding, cross-studio reporting, or workflows. Multi-studio may be considered much later.
4. Marketplace excluded from V1.
5. Promotions/Promos excluded from V1.
6. Real, server/webhook-verified payment gateway; no manual/offline UPI reconciliation. Vendor decision already established — not reopened here. Gateway must support payment-status tracking and refunds.
7. Booking advance-payment and cancellation rules (full detail in Section G) — apply only to individual service bookings, not packages. Enforced server-side.
8. Packages replace Membership in V1 (full detail in Section H). No recurring membership/subscription plan in V1.
9. Customer authentication: Google Sign-In only. No phone/SMS OTP in V1.
10. Notifications: push only, via Firebase Cloud Messaging (FCM), for V1. No SMS/email dependency in V1.
11. Exactly three software permission roles: Owner/Admin, Studio Manager, Staff. No separate Technician permission role (full detail in Section F).
12–15. Staff / Studio Manager / Owner/Admin capabilities and the permission-role-vs-job-title principle — see Section F.
16. Native/web surfaces: customer app and studio app are native iOS + Android; admin is web. Staff use the native Studio app with their own authenticated account — not every technician needs a laptop.
17. Architectural lessons from AutoModz carried forward as concepts (see Section L).
18. Explicit permanent exclusions (see Section K).
19. **Customer web experience — CONFIRMED**: AutoDeck V1 supports both (1) native customer apps for iOS and Android, and (2) a customer-facing web experience for customers who prefer a laptop/desktop, including service booking. This web experience is **not** a PWA/wrapper and does not reuse AutoModz's excluded PWA architecture — it is a standard web application. The same server-side business rules, authentication/authorization, booking rules, payment rules, package rules, and customer data model apply identically regardless of whether the customer uses the native app or the web experience — one backend, one set of rules, two front-end surfaces.

---

## E. Recommended Decisions

1. **Minimal inventory in V1** — stock levels, studio-level stock, record/deduct usage when applicable. Advanced recipes, supplier management, and reordering workflows are Later.
2. Packages and bookings sharing one underlying payment-gateway integration (different product-level rules on top: packages 100% upfront/non-refundable, bookings conditional-advance/refundable).
3. Staff quick-auth on shared shop-floor devices (PIN/biometric) is acceptable only if it always resolves to that staff member's own individual account.

---

## F. Staff Roles & Permissions — CONFIRMED

**Exactly three software permission roles**: Owner/Admin, Studio Manager, Staff. No separate Technician permission role. Job titles (Technician, Service Advisor, Detailer, Washer, Helper, etc.) are metadata only and must never determine authorization.

*Example: Rahul (Staff / Technician) and Amit (Staff / Service Advisor) receive identical Staff permissions.*

**Staff can**: view customer info required for the job, vehicle info, booking details, payment/advance-payment status, cancellation/refund status; cancel/reschedule bookings as an operational action; advance job/service stages; create walk-ins; search customers and vehicles; view package availability; consume package usage; record operational/job information; record inventory usage where applicable.

**Staff cannot**: change pricing; define/edit packages; approve discretionary refunds; manage other staff; access financial/business reporting; access audit logs; change system/security configuration. Staff cancellation/rescheduling always follows the server-enforced refund policy — never a manual override.

**Studio Manager**: full day-to-day operational control — manage staff, pricing/service catalogue, packages, inventory; view financial/payment information; handle/authorize refunds including discretionary exceptions; booking oversight; audit-log access; studio operational reporting. Cannot create/change Owner/Admin accounts or perform Owner-level security/platform administration.

**Owner/Admin**: highest permission level for the single studio — unrestricted access to all operational data, manages Staff and Studio Manager accounts, pricing, packages, payments/refunds, financial/business information, inventory, audit logs, studio configuration. Terminology is **"Owner/Admin"**, not "Platform Admin" — no multi-studio permission concept in V1.

**Principle**: permission role controls authorization; job title is metadata only (display, assignment, filtering, reporting) and never grants permissions — enforced as a rule, not convention, once implemented.

---

## G. Payment & Cancellation Rules — CONFIRMED

Applies only to individual service/product bookings, not packages (see Section H for package payment).

- Service price **≤ ₹10,000**: no advance payment required.
- Service price **> ₹10,000**: 40% advance required at booking.
- Customer cancellation **more than 24 hours** before appointment: 100% refund of the advance.
- Customer cancellation **within 24 hours**: no refund.
- **Rescheduling is always free**, including within 24 hours.
- **Studio-initiated cancellation**: 100% refund.
- Refund/payment/advance/balance/cancellation/rescheduling status visible only to authorized roles (Staff: view; Studio Manager/Owner: view + act on exceptions).
- All rules enforced **server-side**, never trusted from client input.
- Discretionary exceptions outside these rules require Studio Manager or Owner/Admin authorization and must create an audit-log entry.

---

## H. Package Model — CONFIRMED

Packages replace Membership in V1 — no recurring subscription plan.

- Examples: 4 washes, 10 washes.
- **Ownership**: belongs to the customer, not a vehicle. Any vehicle owned by that customer can use the package; each usage event records which vehicle used it.
- **Tracking**: total quantity, used quantity, remaining quantity, purchase date, validity/expiry.
- **Admin** defines package types and validity.
- **Payment**: 100% upfront. The 40% advance rule does not apply to packages.
- **Refunds**: non-refundable in V1, including any remaining unused quantity.
- **Customer** can see purchased packages and remaining usage.
- **Staff** can see package availability and consume eligible usage during service.

---

## I. V1 Scope

**Customer app (native iOS/Android)**: Google Sign-In · garage (manual vehicle entry) · vehicle detail with protection cards · booking with automatic advance-payment rule · live visit tracking · mid-visit approvals · cancellation (24h refund rule) and free rescheduling · sealed history · in-app payment · prepaid packages (purchase, track usage across owned vehicles) · push notifications (FCM) · profile.

**Studio app (native iOS/Android)**: individual staff authentication (+ device PIN/biometric tied to the staff member's own account) · schedule/board · job detail with stage advancement · approval-request initiation · walk-in intake · customer/vehicle lookup/search · minimal inventory view and usage recording · package availability lookup and usage consumption · role-scoped visibility into payment/advance/refund/cancellation/reschedule status.

**Customer web experience (browser, laptop/desktop)**: a standard web application — not a PWA/wrapper, not built on AutoModz's excluded PWA architecture — giving customers who prefer a laptop/desktop the same core capabilities as the native app, with service booking explicitly confirmed as available. It talks to the same backend and is subject to the identical server-side business rules, authentication/authorization, booking rules, payment rules, package rules, and customer data model as the native app — no rule or data-model divergence between surfaces.

**Admin (web)**: single-studio operations · staff account and role management (Owner/Admin, Studio Manager, Staff) · package type definitions · bookings oversight · service catalogue/pricing management · advance-payment and refund/cancellation controls (including discretionary exceptions) · minimal inventory management · audit-log viewer · basic operational reporting.

---

## J. Later / Post-V1

- Marketplace
- Promotions/Promos
- Advanced inventory: recipes, supplier management, reordering workflows
- Referral program
- WhatsApp notification channel
- SMS/email notifications
- Advanced analytics/reporting
- VIN/vehicle lookup integration
- Recurring memberships/subscriptions
- Additional social login methods
- Multi-studio operations (onboarding, cross-studio reporting, workflows)
- Package refunds (not currently planned to be reconsidered, but logically belongs here if ever revisited)

---

## K. Explicitly Excluded (Permanent)

- AutoModz's Firebase project, credentials/secrets, database, and production data
- AutoModz configuration, Cloudinary account, WhatsApp Business credentials, hosting configuration, payment configuration
- Manual UPI-only payment reconciliation
- PWA manifest / offline page / service worker artifacts — this applies to the customer web experience too: it is a standard web app, never a PWA-wrapped shell reusing AutoModz's architecture
- Hardcoded owner-email admin bootstrap
- Shared/anonymous staff accounts (every staff account must be individually authenticated)
- Demo/seed data reachable in production
- Job↔vehicle linking by normalized plate string (use a real foreign key)
- AutoModz admin inline-style sprawl / lack of shared component vocabulary
- Command palette (⌘K)
- Marketplace in V1
- Promotions/Promos in V1
- Separate Technician permission role
- "Platform Admin" terminology/concept in V1

---

## L. AutoModz Lessons (concepts to rebuild, not code to copy)

**Product/architectural lessons to carry forward:**
- Vehicle-centric data model
- Server-authoritative operational state (price, approvals, payment status never client-writable)
- Immutable/sealed visit records
- Proper server-side RBAC (custom claims, not hardcoded emails or per-request document lookups)
- Comprehensive audit logging
- Price snapshotting at commitment time
- Request/schema validation at every API boundary
- Rate limiting/abuse protection
- Clear customer/studio/admin trust-boundary separation

**Process lessons worth adopting regardless of stack:**
- Enforcing architecture with tests (e.g., a test that fails the build if a client component bypasses the server/engine layer)
- Treating environment configuration as a documented, tested contract
- Snapshot-at-commitment pricing rather than silent recomputation
- Firestore/security rules (or equivalent) written as commented decision records explaining *why*, not just *what*

---

## M. Gaps AutoDeck Must Solve (that AutoModz doesn't provide)

- Real payment gateway supporting the 40%-advance flow, webhooks, and refunds (AutoModz has manual UPI only)
- The entire native mobile shell (AutoModz deferred iOS/Android entirely)
- Request/schema validation at API boundaries (absent in AutoModz)
- Rate limiting/abuse throttling (absent in AutoModz)
- Custom-claims-based, three-tier RBAC (Owner/Admin, Studio Manager, Staff) — AutoModz only ever had a flat admin/employee binary
- FCM push notification infrastructure sized for AutoDeck's own project (not reused from AutoModz)
- First-class, comprehensive audit-log infrastructure for every operational mutation (AutoModz has one partial, staff-only collection)
- The entire package system (quantity/usage/validity tracking, customer-level ownership across multiple vehicles) — AutoModz has no equivalent; its membership system is tier/renewal-based, not prepaid-unit-based

---

## N. Security & Infrastructure Separation — CONFIRMED

Must remain completely separate from AutoDeck, with no shared project, credentials, database, or configuration:
- AutoModz's Firebase project (`automodz`, region `asia-south1`) and all client/service-account credentials
- AutoModz's Cloudinary account
- AutoModz's WhatsApp Business API token/phone-number-id
- AutoModz's payment identifiers (UPI VPA) and hosting/site configuration
- AutoModz's production database and data

**Standing reminder**: a Firebase Admin SDK service-account key for the excluded `automodz` project exists locally on the machine used for this planning work. It must never be placed in, referenced by, or reachable from the AutoDeck repository or its infrastructure.

---

## O. Final Recommended AutoDeck V1

One fully operational studio, native customer and studio apps, a customer-facing web experience (not a PWA), and a web admin — all sharing one backend and one set of server-side rules. Built around: manual vehicle entry, vehicle-centric data model, service bookings with a server-enforced 40%-advance/cancellation policy, prepaid customer-owned packages replacing membership, Google-only auth, FCM-only push notifications, and a three-tier RBAC (Owner/Admin, Studio Manager, Staff) with job titles kept strictly as non-authorizing metadata. Everything server-authoritative, audit-logged, and validated at every API boundary — identically, regardless of whether the customer arrives via native app or web. Marketplace, promotions, advanced inventory, recurring memberships, SMS/email, and multi-studio operations are explicitly deferred — the goal is one studio, fully functional and reliable, before any expansion.

---

## P. Implementation Readiness / What Comes Next

This document resolves the product-decision layer. Per the AutoDeck engineering constitution (`CLAUDE.md`), the remaining gates before feature implementation can begin are: **architecture**, **repository structure**, **environments**, **security model**, and **development workflow** — none of which have started, and none of which begin without explicit approval.

---

## FINAL APPROVAL CHECKLIST

**There are no remaining unresolved product decisions.**

Every decision in this document — product scope, payment/cancellation rules, package model, staff roles and permissions, security/infrastructure separation, and customer surfaces (native apps + web experience) — is confirmed and approved. Nothing remains open.

---

*This is the approved, permanent product-decision record for AutoDeck V1. No architecture, repository structure, environment, security-model, or development-workflow work has started. No application source code, dependencies, or configuration were changed in producing or saving this document.*
