# 20 — V1 Product Scope

**Status:** Architecture definition.  
**Principle:** V1 is the minimum complete operational system. Every item below must work end-to-end before anything else is added.

---

## The Test

A real customer must be able to: authenticate → add vehicle → book a service → receive a confirmation → track their car live → pay → receive an invoice.

A real studio must be able to: see the booking → check in the vehicle → advance the job through stages → request customer approval if needed → collect payment → deliver the car.

An admin must be able to: see what's happening → manage the catalogue → configure the studio.

If all three can do their jobs end-to-end, V1 is done.

---

## V1 Scope — Customer App

| Feature | What it does | Not in V1 |
|---|---|---|
| Authentication | Phone OTP login, profile setup (name only), first vehicle add | Email login, social login |
| Vehicle Garage | View own vehicles, basic spec (registration, make, model, year) | Multiple photos, VIN, full history on first open |
| Service Catalogue | Browse categories, view service cards (name, price, duration, warranty type) | Promotions, add-ons in V1 |
| Booking | Select service → scope → date/time → confirm (no pickup/drop in V1) | Pickup/drop, multi-vehicle toggle in flow |
| Booking Status | View confirmed booking, see current job status (the stage rail), notification when ready | Live studio photos in V1 |
| Active Service View | Which stage the car is in, estimated completion | Real-time bay cam, technician identity |
| Customer Approval | Receive approval request, approve or reject additional work | Complex multi-item approvals |
| Service History | List of completed jobs, tap to see service name, date, amount, invoice link | Full photo gallery, warranty certificate in V1 |
| Invoice | View invoice (line items, total, payment status) | PDF download in V1 |
| Payments | UPI payment link (pay via UPI app), manual confirmation | Card, EMI, BNPL in V1 |
| Notifications | Push: booking confirmed, job in progress, vehicle ready, payment due | WhatsApp in V1 (needs template approval — defer) |
| Profile | View/edit name, notification toggle, sign out | Advanced preferences, account deletion in V1 |

**What is NOT in V1 (Customer):**
- Warranty certificates (PDF)
- Before/after photo gallery
- Vehicle passport (full living history view)
- Membership / Club
- Promotions and promo codes
- WhatsApp notifications
- Email notifications
- Pickup / drop
- Reviews and ratings
- Arabic localization
- Referrals

---

## V1 Scope — Studio App

| Feature | What it does | Not in V1 |
|---|---|---|
| Auth | Employee phone OTP login | PIN-based shared device; biometric |
| Today's Jobs | Ordered list of today's bookings + active walk-ins, status badges | Week view in V1 |
| Calendar View | Basic view of upcoming bookings by date | Drag-to-reschedule in V1 |
| Bay Board | Live grid: each bay, current job, status | Historical bay occupancy |
| Job Card | Customer + vehicle, service, status advancement buttons, notes | Full photo capture per stage in V1 |
| Vehicle Check-in | Mark vehicle received, record basic condition notes | Photo-documented intake in V1 |
| Service Status Advancement | Advance through: vehicle received → in progress → quality check → ready for delivery → delivered | Custom stage names |
| Additional Service Approval | Create request (description + price impact), see customer response | Photo evidence in approval in V1 |
| Payment | Send Razorpay Payment Link via WhatsApp; record manual cash/UPI | In-app payment sheet (V2) |
| Walk-in Registration | Phone number lookup → customer → vehicle → service → bay → create job | Full customer creation form in V1 |
| Delivery | Mark vehicle delivered | Signed delivery receipt in V1 |

**What is NOT in V1 (Studio):**
- Per-stage photo capture (Phase 2)
- Invoice generation from studio (admin web handles this in V1)
- Inventory management
- Attendance tracking
- Offline-first capability (full offline support in Phase 2)
- WhatsApp send from studio app

---

## V1 Scope — Admin Web

| Feature | What it does | Not in V1 |
|---|---|---|
| Login | Email + password for admin account | SSO, Google login |
| Dashboard | Today's job count by status, bay utilization, recent activity | Revenue charts, alerts in V1 |
| Service Catalogue | Add/edit/activate/deactivate services, set price + duration + warranty label | Scope management, add-ons in V1 |
| Bookings | List + filter, confirm booking, view detail, cancel | Calendar drag-drop in V1 |
| Jobs | List + filter, view job card, advance status (admin override), add notes | Job cost override requires approval in V1 |
| Customers | Customer list, customer detail (vehicles, booking history) | CRM tags, notes, communication log in V1 |
| Vehicles | Vehicle detail by registration, service history | Public history consent in V1 |
| Payments | View payment records per job, mark paid manually | Refunds in V1 |
| Invoice Generation | Generate invoice PDF from completed job, view/download | Bulk export in V1 |
| Studio Configuration | Operating hours, bay configuration (add/disable bays), holidays | Multi-studio selector in V1 |
| Audit Log | View append-only log of all critical mutations | Advanced filters, CSV export in V1 |
| Employee Management | Add employee, assign role (studio/admin), deactivate | Payroll in V1 |

**What is NOT in V1 (Admin):**
- Membership management
- Revenue / financial reports
- Inventory management
- Attendance / payroll
- Promotions management
- WhatsApp template management
- Multi-tenant / multi-studio administration
- BigQuery reports
- Bulk CSV exports

---

## V1 Infrastructure Requirements

These must exist before the first user-facing feature is built:

- [ ] Monorepo structure (Turborepo)
- [ ] Firebase projects: dev + staging + prod (Blaze plan — pay-as-you-go, effectively free at dev scale)
- [ ] Firebase Auth: phone OTP
- [ ] Firestore: asia-south1 (Mumbai)
- [ ] Cloud Functions: all business logic (booking, job status, payment recording, invoice)
- [ ] Firebase Emulator Suite: local dev + CI
- [ ] Firestore security rules: customer/studio/admin + tenantId isolation
- [ ] Shared types package: all domain entities
- [ ] CI: GitHub Actions (lint + typecheck + unit tests + emulator integration tests)
- [ ] EAS Build: development and preview profiles for both apps

**Cost in V1 infrastructure:** Zero. Firebase Spark plan covers early development. Blaze plan pay-as-you-go has no minimum charge.

---

## V1 Timeline Estimate

| Phase | Scope | Weeks |
|---|---|---|
| Phase 0: Foundation | Monorepo, Firebase, Cloud Functions middleware, CI, EAS | 3 |
| Phase 1a: Auth | Phone OTP, profile setup, add vehicle | 1.5 |
| Phase 1b: Booking | Service catalogue, availability, booking creation | 2.5 |
| Phase 1c: Studio | Job queue, job card, status advancement, approval | 2.5 |
| Phase 1d: Payment + Invoice | UPI payment link, record payment, generate invoice | 1.5 |
| Phase 1e: Admin Web | Dashboard, catalogue, bookings, customers, studio settings | 2 |
| **V1 Total** | | **~13 weeks** |

This is the minimum complete operational system. Two engineers can deliver this.

---

## V2 Scope (Post-V1)

| Area | Features |
|---|---|
| Payments | Razorpay card integration, subscription billing for membership |
| Membership | Silver/Gold/Platinum tiers, wash credits, discount application |
| Notifications | WhatsApp outbound (after Meta template approval), email (SendGrid/Resend free tier) |
| Studio App | Per-stage photo capture, signed upload to Storage |
| Customer App | Before/after photo gallery, service photos from studio |
| Pickup / Drop | Address entry in booking, pickup status tracking |
| Warranty Certificates | PDF at job completion, customer download |
| Vehicle Passport | Full living history view, protections, warranties |
| Promotions | Promo codes (admin-created, customer-redeemable) |
| Walk-in | Full walk-in flow with customer creation |
| Ratings | Post-delivery rating prompt |
| Admin Reporting | Revenue by service, job completion stats |
| Inventory | Basic stock management, consumption recording |
| Attendance | Employee check-in/out |

---

## V3 Scope (Deferred)

| Feature | Reason Deferred |
|---|---|
| Multi-tenant admin portal | Requires second tenant to exist; build when needed |
| Payroll | After attendance is stable in V2 |
| Arabic localization | Ahmedabad launch — not required |
| BigQuery reporting | When Firestore reporting is insufficient |
| Car marketplace | Separate business decision required |
| Insurance integration | Requires partnership |
| EV-specific services | Service catalogue addition — trivial when ready |
| Franchise / partner studio onboarding | After product-market fit |
| WhatsApp two-way chat | Significant scope; customer support staffing required |
| Advanced analytics (Mixpanel/Amplitude) | After Firebase Analytics is insufficient |
