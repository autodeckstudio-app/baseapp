# 03 — AutoDeck Feature Map

**AutoDeck OS Architecture Phase · August 2026**

> This document defines what AutoDeck will build, for whom, and at what priority. It is the product feature contract, not a UI spec. Priorities: **P0** = launch blocker, **P1** = launch target, **P2** = post-launch.

---

## 3.1 Product Principles

### The car is the hero
AutoDeck is not a booking app. It is not a CRM that customers can see. It is a car-care platform where every feature is expressed through the lens of the customer's vehicle.

The customer opens AutoDeck and sees **their car** — its current state, its history, its protection, what's happening to it right now. The service catalogue exists in the context of that vehicle. Bookings are events in a vehicle's life. Warranties are attached to the car, not to a transaction.

This is the opposite of how most service platforms are designed. Do not design it as a service list with a booking button. Design it as a vehicle companion.

### The authority model
Three distinct authority levels, enforced at every layer:

**Customer** — self-service authority only. Customers can submit requests (bookings, payment claims, approvals, reviews), update their own profile and preferences, and read their own data. They cannot write to any operational fact.

**Studio** — operational authority. Studio staff advance job statuses, record work done, assign bays, capture photos, mark payments received, issue invoices, manage inventory. Studio staff cannot modify past completed records or override prices retroactively without admin.

**Admin** — full business authority. Admins can override any operational fact with audit logging. Admins cannot bypass audit requirements.

This model must be enforced at three layers simultaneously: Firestore security rules, Cloud Functions server logic, and application-level guards. No single layer is sufficient.

### Premium positioning
AutoDeck serves customers spending ₹30,000–₹2,20,000+ per service. At this price point, the experience must signal quality and care at every touchpoint:
- No loading spinners left unstyled
- No generic error messages ("Something went wrong")
- No visible internal IDs in customer-facing screens
- Status updates feel like personal messages, not system events
- Documentation (invoices, warranties, receipts) is premium enough to keep

---

## 3.2 Customer App Feature Map

### Onboarding
**What it does**: First-run experience that establishes identity, adds first vehicle, and surfaces the value of the platform.

**Priority**: P0

**Details**:
- Phone OTP authentication (primary) — India standard; +91 pre-selected
- No social login in V1 — avoids Apple Sign-In requirement; adds in V2+ if needed
- Multi-step progressive onboarding: verify phone → add first car → choose notification preferences
- Not a registration wall — show value before asking for details
- Welcome state should be clear: "Your AutoDeck is ready. Add your first car to get started."

**vs AutoModz**: Google-only auth is a critical gap AutoDeck fixes. AutoModz has a welcome flow but its Google-only requirement excludes customers without Google accounts.
**vs GoMechanic**: GoMechanic uses phone OTP as default; this is the right model.

---

### My Garage
**What it does**: A customer's fleet of registered vehicles, each with photo, specs, and quick status.

**Priority**: P0

**Details**:
- Vehicle card: photo (customer-uploaded), make/model/year, registration plate, colour
- Quick status chip per vehicle (idle / booked / in-service / ready for collection)
- VIN support (optional, useful for warranty)
- Odometer log (manual entry at each service)
- Multiple vehicles supported from day one
- Add vehicle: manual entry (registration, make, model, year, colour, fuel type); lookup API optional in V2+

**vs AutoModz**: AutoModz has vehicle profiles but no add/edit UI in production. The concept is right; the implementation is incomplete.

---

### Vehicle Passport
**What it does**: The single most important customer-facing surface. A living document for each vehicle showing all protections, active warranties, service history, and upcoming appointments.

**Priority**: P0

**Details**:
- **Protection summary**: Active PPF (film brand, coverage, expiry, installer), active ceramic (product, grade, expiry), active warranty items
- **Service timeline**: Chronological history of all services at AutoDeck, with: date, mileage, technician name, service type, invoice link, warranty certificate link
- **Upcoming appointments**: Booked slots with status
- **Warranty expiry alerts**: "Your PPF warranty expires in 45 days. Book your annual inspection to maintain coverage."
- **Protection certificates**: Downloadable PDF for each protection item
- **Service records**: Immutable. Cannot be edited post-seal. If customer sells car, history is an asset.
- **Photo gallery per service**: Before/after, coverage documentation, delivery photos
- All records are permanent. Completed records cannot be modified.

**vs AutoModz**: The `/chapter/[id]` vehicle chapter is 0% implemented. This is a rebuild from scratch.
**vs GoMechanic**: GoMechanic shows a service list. AutoDeck must show a vehicle story.

---

### Service Discovery
**What it does**: Browsable service catalogue showing all available services, packages, and pricing.

**Priority**: P0

**Details**:
- Organised by category: PPF, Ceramic Coating, Detailing, Washing & Valeting, Protective Coatings, Other
- Each service card: name, short description, brand/product used, price (fixed, not estimate), duration indicator, warranty included
- Package comparison: show what distinguishes entry/mid/premium tiers side by side
- Admin-managed catalogue — not hardcoded. Studio can add/remove/modify services without a code deployment
- Context-aware: if a vehicle already has PPF installed, show ceramic topper services that are compatible
- Transparent about what is included and what is not

**vs AutoModz**: AutoModz has a hardcoded catalogue. AutoDeck must allow admin management.
**vs GoMechanic**: GoMechanic shows hundreds of services for a mass-market garage. AutoDeck shows a curated, premium selection.

---

### Booking
**What it does**: The core transaction — scheduling a service for a vehicle.

**Priority**: P0

**Details**:
- Always server-authoritative — client sends service ID + vehicle ID + preferred slot; server resolves price, bay, availability
- Step 1: Select vehicle (from garage)
- Step 2: Select service / package
- Step 3: Scope selection (coverage, add-ons, estimate)
- Step 4: Schedule — calendar showing real available slots (server-computed from bay capacity and duration)
- Step 5: Pickup/drop option — address entry, surcharge if applicable
- Step 6: Review (vehicle, service, price, slot, pickup arrangement) — customer confirms
- Step 7: Confirmation screen with booking reference and expected timeline
- Idempotency — server prevents double submission
- Rescheduling: customer may reschedule free if >24h before slot; studio may reschedule anytime
- Cancellation: customer may cancel free if >24h before slot; late cancellation policy TBD
- Address is snapshotted at booking time — changing saved address does not modify past bookings

**vs AutoModz**: AutoModz's booking creation UI has not been migrated to the new server-authoritative flow. Rebuild.
**vs GoMechanic**: GoMechanic offers slot-based booking (fixed appointment blocks). AutoDeck may offer both fixed slots and flexible (drop-off when convenient, studio will fit in). Decide: this is an open question.

---

### Live Tracking
**What it does**: Real-time visibility into what is happening to the customer's car while it is at the studio.

**Priority**: P0

**Details**:
- Status rail (visual stages): Booked → Vehicle Received → Inspection Complete → In Progress → Quality Check → Ready for Collection / Out for Delivery
- Current stage is highlighted; completed stages are checked
- Each stage transition triggers a push notification AND a WhatsApp message
- Photo updates at key stages (e.g., "Inspection complete" photo of vehicle as received; "In progress" photo of PPF application; "Ready" photo of final result)
- Technician name shown: "Rajan is working on your Audi A6"
- Estimated completion time (not guaranteed — studio can update)
- Mid-job updates: studio can push free-text updates that appear as messages in the tracking view
- No polling — real-time via Firestore listeners

**vs AutoModz**: AutoModz has this conceptually (the home state machine) but the photos and WhatsApp delivery are missing. Rebuild.
**vs GoMechanic**: GoMechanic's tracking is generic. AutoDeck's tracking must surface human identity (technician name, studio manager contact).

---

### Customer Approval
**What it does**: When the studio discovers additional work needed mid-job, they must get explicit customer approval before proceeding.

**Priority**: P0

**Details**:
- Studio raises an approval request: describes finding, proposed additional work, price impact, time impact
- Customer receives push notification AND WhatsApp message
- In-app approval screen: shows current service, proposed addition, price delta, time delta, photos of the issue
- Customer can: Approve / Decline
- Studio cannot proceed with unapproved work
- Timeout handling: if customer does not respond in X hours, studio is notified
- All approval decisions are recorded with timestamp and user ID — permanent audit record
- Price after approved additions must be re-computed server-side

**vs AutoModz**: AutoModz has this (`/approval/[id]` route, `approvals` collection). The concept and data model are correct. Rebuild in native app with improved notification delivery.
**vs GoMechanic**: GoMechanic's Service Buddy handles this by phone/WhatsApp manually. AutoDeck formalises it as a structured in-app flow, which creates an audit trail and prevents disputes.

---

### Delivery & Handover
**What it does**: Documents the return of the vehicle to the customer.

**Priority**: P0

**Details**:
- Studio marks vehicle ready and triggers "ready for collection" or "out for delivery" notification
- Delivery confirmation: studio records handover with: timestamp, delivery photo, customer signature (digital), odometer reading
- Any post-service issues reported within 48h are flagged as warranty claims, not new bookings
- Customer receives a delivery summary push + WhatsApp with: service completed, total paid, warranty activated, certificate download link

**vs AutoModz**: Not implemented beyond status change. Rebuild.

---

### Warranty & Protection Certificates
**What it does**: The formal documentation of protections installed on a vehicle.

**Priority**: P0

**Details**:
- Generated as a sealed PDF at job completion (not dynamically computed from current catalogue)
- Certificate contains: customer name, vehicle details (make/model/reg/VIN), service date, mileage at service, product used (brand, grade, batch number), installer name and certification, coverage terms (verbatim, captured at seal), warranty period (start and end dates), annual maintenance requirements, studio contact and stamp
- QR code links to a public verification endpoint (verify.autodeck.com/warranty/[token]) where anyone (e.g., car buyer) can confirm the certificate is genuine
- Stored immutably in Firebase Storage (customer cannot delete, admin cannot edit — only void with reason logged)
- Downloadable by customer at any time from Vehicle Passport
- Resend to WhatsApp or Email on demand

**vs AutoModz**: AutoModz has the terms-captured-at-seal principle but no certificate generation, no PDF, no QR verification. This is a rebuild.
**vs GoMechanic and CarzSpa**: No competitor produces a verifiable digital warranty certificate. This is a genuine product differentiator in the Indian premium detailing market.

---

### Service History (Immutable)
**What it does**: The permanent chronological record of all work done on a vehicle at AutoDeck.

**Priority**: P0

**Details**:
- Each completed job produces one sealed service record containing: date, mileage, technician, service items (verbatim, captured at seal), parts/products used (with brands), photos (intake, progress, completion), invoice reference, total paid, warranty items generated
- Records are immutable post-seal — editing the catalogue, changing prices, or removing a technician does not alter past records
- Accessible from Vehicle Passport
- Downloadable as PDF ("Vehicle Service Report")
- Publicly shareable with customer consent (opt-in, not opt-out) — a vehicle with a verified service history at a premium studio has genuine resale value

**vs AutoModz**: AutoModz has the data model but the seal path has never run in production. Rebuild in Cloud Functions.

---

### Membership / AutoDeck Club
**What it does**: Subscription membership that rewards loyal customers with service inclusions and priority access.

**Priority**: P1

**Details**:
- Tiers (to be finalised — these are design hypotheses):
  - **Care**: Monthly or annual; includes X washes, priority booking, 10% off all services
  - **Shield**: Annual; includes Care benefits + annual detail, free PPF film inspection, 15% off
  - **Signature**: Annual; includes Shield benefits + dedicated service advisor, 20% off, annual ceramic top-up
- Membership billing via Razorpay UPI AutoPay (V2) — not manual UPI
- Wash/service allowances tracked server-side, consumed at booking
- Member pricing computed server-side (never from client)
- Visual membership card in app (premium feel — not a functional element, a trust signal)
- Renewal reminders 30 days before expiry
- Allowances do not roll over (use them or lose them)

**vs AutoModz**: AutoModz's Silver/Gold/Platinum model is the right concept. Rebuild with Razorpay UPI AutoPay billing (V2). INR pricing set by admin.
**vs GoMechanic**: GoMechanic Miles bundles periodic service inclusions. AutoDeck's tiers should bundle detailing-specific inclusions.

---

### Payments
**What it does**: Customer-facing payment flows for booking deposits, service settlement, and membership billing.

**Priority**: P0

**Details**:
- **V1 payment flow**: Razorpay Payment Links — studio triggers a server-side link; customer pays in browser via UPI/card/net banking; Razorpay webhook confirms
- **V2 payment flow**: Razorpay in-app payment sheet (card, UPI, net banking); Razorpay UPI AutoPay for membership recurring
- **BNPL/EMI**: Razorpay-native EMI options (HDFC, ICICI, Simpl, LazyPay) — no separate provider needed; activate in Razorpay dashboard when ready
- **No manual UPI verification**: Razorpay webhook confirms payment automatically; no staff intervention needed for online payments
- Customer can never mark their own payment as received — only Razorpay webhook confirmation or studio manual confirmation triggers `paid` status
- Payment history accessible in-app
- Receipts emailed automatically (Resend — FREE TIER)

**vs AutoModz**: AutoModz has no payment gateway — everything is manual UPI. This is a critical replacement.
**vs GoMechanic**: GoMechanic has UPI/card/wallet; AutoDeck's V1 Payment Link approach matches how premium Indian studios already operate.

---

### Notifications
**What it does**: Keeping customers informed throughout the service lifecycle.

**Priority**: P0

**Details**:
- **Push notifications** (iOS/Android via FCM + APNs) — required from day one
- **WhatsApp Business API (Meta Cloud API)** — first-class channel, non-optional for India market; ~₹0.115/utility message — USAGE COST
- **Email** — booking confirmations, invoices, certificates (via Resend — FREE TIER)
- **SMS** — Firebase Auth OTP only; no separate SMS for notifications
- **In-app notification centre** — all past notifications accessible
- Notification events: booking confirmed, booking reminder (24h), vehicle received, inspection complete, in progress, approval requested (urgent), quality check, ready for collection, vehicle delivered, payment received, warranty certificate issued, membership renewal reminder
- **Quiet mode**: customer can suppress non-critical notifications (approval requests and vehicle ready always break through)
- **Language preference**: English (V1); Hindi/Gujarati (V2+ optional)

**vs AutoModz**: AutoModz has push (web only) and WhatsApp (to studio only). AutoDeck needs push + WhatsApp + email + SMS, all to the customer.

---

### Reviews & Ratings
**What it does**: Post-service feedback from customers.

**Priority**: P1

**Details**:
- Triggered 24h after vehicle delivery (push notification prompt)
- 5-star rating + optional written comment
- Verified purchase gate — only customers who completed a service can leave a review
- Studio can respond to reviews (admin web)
- Aggregate rating displayed on service catalogue pages
- Reviews are public-facing (on the AutoDeck website/marketing, not just internal)
- Report mechanism for inappropriate content

**vs AutoModz**: AutoModz has a ratings collection. Rebuild with proper verified-purchase gate and public display.

---

### Promotions
**What it does**: Discount codes, seasonal offers, and package deals.

**Priority**: P2

**Details**:
- Admin creates promotion: code string, discount type (percentage / fixed amount / service inclusion), validity period, redemption limit, applicable services
- Customer enters promo code at checkout
- Server validates and applies — client cannot compute discount
- Promotion history tracked (which customer used which code, when)
- Stackability rules: promotions do not stack with membership discounts by default

**vs AutoModz**: AutoModz removed promo codes. Re-introduce properly with server-side validation.

---

### Profile & Settings
**What it does**: Customer account management, preferences, and communication settings.

**Priority**: P1

**Details**:
- Display name, phone number (primary identifier), email (for invoices/certs)
- Notification preferences (per channel: push, WhatsApp, email, SMS)
- Language preference (English / Hindi / Gujarati — V2)
- Saved addresses (pickup/drop — V2+)
- Payment method management (V2+, when in-app payment sheet is added)
- Account deletion (must comply with India data protection regulations)
- Biometric app unlock (Face ID / Touch ID)

---

## 3.3 Studio App Feature Map

The Studio App is a native iOS/Android application used by studio staff for daily operations. It is not a reduced version of the admin web app — it is purpose-built for on-floor use.

### Job Queue / Today's Board
**Priority**: P0
- Today's bookings in order of scheduled time
- Colour-coded by service type (PPF, ceramic, wash, etc.)
- Inline status chips (pending intake / in progress / quality check / ready)
- Urgent flags: customer approval pending, overdue, late arrival
- Tomorrow's queue visible in secondary tab

### Job Card
**Priority**: P0
- Full job detail: customer name, vehicle (make/model/reg/photo), service items, bay assigned, technician assigned
- Status advancement: tap to advance through stages (vehicle_received → inspection_complete → in_progress → quality_check → ready)
- Each advancement is timestamped and logged (audit trail)
- Notes field (internal — not visible to customer)
- Customer-facing update field (visible in customer tracking)

### Photo Capture
**Priority**: P0
- Native camera integration for each job stage
- Mandatory photos at: intake (minimum 4 angles), service in progress, completion (minimum 4 angles + coverage documentation for PPF/ceramic)
- Photos automatically tagged with: timestamp, GPS coordinates, job ID, stage
- Uploaded to Firebase Storage immediately (not stored locally)
- Customer can see approved photos in their tracking view

### Customer Approval Requests
**Priority**: P0
- Create approval: select job, describe finding, enter additional items, price delta, time delta, attach photos
- Real-time status: pending / approved / declined
- Studio cannot advance job to next stage while approval is pending
- History of all past approvals for the job

### Bay Management
**Priority**: P0
- Visual board: all bays with current occupant and status
- Manual bay reassignment (admin/manager only)
- Blocked time entry (maintenance, unavailability)
- Capacity indicator: today's utilisation per bay type

### Walk-in Registration
**Priority**: P0
- Register a customer without a prior booking
- Phone number lookup (existing customer) or new customer creation
- Vehicle registration: plate lookup or manual entry
- Service selection from catalogue
- Bay assignment (manual, real-time — studio sees what's free)
- Walk-in jobs count against capacity (same engine as bookings)

### Vehicle Intake & Inspection
**Priority**: P0
- 30-point intake checklist (standardised across all jobs)
- Photo documentation of pre-existing damage
- Fuel level, odometer reading
- Customer condition acknowledgement (digital signature or WhatsApp confirmation)
- Inspection report generated and sent to customer automatically

### Inventory Management
**Priority**: P1
- View current stock levels per item
- Record consumption against a job (PPF film used, ceramic product consumed)
- Low-stock alert badge on item
- Manual stock adjustment (delivery received, adjustment)
- Inventory history per item

### Payment Collection
**Priority**: P0
- View outstanding balance for a job
- Mark payment received (triggers Razorpay Payment Link flow or records manual cash/UPI)
- Payment method: Razorpay Payment Link (sent via WhatsApp), cash, UPI QR at counter (manual record)
- Issue receipt automatically via email/WhatsApp
- Cannot mark payment as received until job is at `ready_for_delivery` or `completed` stage

### Quote Generation
**Priority**: P1
- Select vehicle and services
- Auto-compute price from catalogue (membership discounts applied if applicable)
- Add line-item adjustments (approved by admin only)
- Send quote to customer via WhatsApp or email
- Quote has an expiry (e.g., 7 days)
- Customer can convert quote to booking (via customer app or studio on their behalf)

### Customer Communication
**Priority**: P0
- Send WhatsApp message to customer from within studio app (templated or free-text)
- Pre-built templates: "Your car has arrived", "We've found something, please check the app for your approval request", "Your car is ready"
- Message history per customer per job visible in studio app

### Scheduling View
**Priority**: P1
- Calendar view: all bookings across bays for the week
- Drag-to-reschedule (admin only, with audit log)
- Block time (holidays, maintenance, events)
- Capacity utilisation summary per day

---

## 3.4 Admin Web App Feature Map

The Admin Web App is a Next.js application accessed by the business owner and managers. It is operations-complete — anything a studio app cannot do, admin can.

### Dashboard & KPIs
**Priority**: P0
- Today: jobs in progress, jobs ready, pending approvals, low stock alerts
- This week: bookings received, revenue, average job value
- This month: revenue trend, membership activations, service mix breakdown
- Live activity feed: recent status changes, payments, new bookings

### Booking Management
**Priority**: P0
- All bookings with filters (status, date range, service type, studio)
- Booking detail: full history, status timeline, customer and vehicle info, communications log
- Admin override: move to any status (with reason logged)
- Reschedule on behalf of customer (audit logged)
- Cancel with reason (audit logged)
- Export to CSV

### Customer 360
**Priority**: P1
- Customer profile: name, phone, email, auth methods, account age
- All vehicles registered
- All bookings and jobs (with status and total value)
- Membership status and usage
- Communication history (WhatsApp, push, email)
- Notes (internal — not visible to customer)
- Tags (VIP, warranty claim, etc.)
- Account flag (no service, requires approval, etc.)
- Lifetime value summary

### Vehicle Records
**Priority**: P1
- Search by plate, VIN, or customer name
- Full vehicle profile: all services, all protections, all warranties, all photos
- Protection status by category (PPF: active/expired, ceramic: active/expired, etc.)
- Service history PDF export
- Manual service record entry (for backfill/migration)

### Staff Management
**Priority**: P1
- Employee roster: name, role, phone, auth status, active/inactive
- Role assignment: admin, manager, detailer, washer, helper, customer_service
- Attendance view: daily check-in/check-out, breaks, work hours
- Payroll: monthly computation from attendance + salary configuration
- Leave management (basic: approve/reject leave requests)

### Service Catalogue Management
**Priority**: P1
- Add/edit/deactivate service items
- Service details: name, category, description, price (INR, tenant-configurable), duration (minutes), warranty terms, applicable bay types, active/inactive flag
- Price change history (old prices logged for past booking context)
- Service ordering (display order in customer app)
- Bundle/package configuration (group multiple services at combined price)

### Pricing Management
**Priority**: P1
- Override base prices (admin only)
- Seasonal pricing configuration
- Membership discount configuration per tier
- Pickup/drop fee configuration
- Tax configuration (GST rate — 18% India default; configurable per tenant; snapshotted at booking creation)

### Membership Management
**Priority**: P1
- Active memberships list with status, tier, expiry, usage
- Activate/deactivate membership
- Manual benefit adjustment (add washes, extend period)
- Membership revenue summary

### Financial Reports
**Priority**: P1
- Revenue by day/week/month/year
- Revenue by service category
- Revenue by payment method
- Job count and average job value
- Membership revenue vs service revenue split
- Outstanding balances (jobs completed but unpaid)
- End-of-day closing report (cash received, UPI received, Razorpay settled)
- Export to CSV/PDF

### Invoice Management
**Priority**: P0
- All invoices with status (draft / issued / paid / voided)
- Invoice detail: line items, discounts, GST breakdown, total, payment status
- Resend invoice to customer (email or WhatsApp)
- Mark as paid (with payment reference)
- Void invoice (with reason — permanent audit record)
- Invoice numbering: sequential, formatted (AD-2026-0001)

### Studio Configuration
**Priority**: P0
- Studio profile: name, address, phone, operating hours, photos
- Bay configuration: bay name, bay type (protection / wash / general), active/inactive
- Operating hours: by day, including public holidays
- Capacity settings: max concurrent jobs per bay type
- Buffer configuration: turnover time between jobs

### Promotions Management
**Priority**: P2
- Create promotion codes
- Set discount type, value, validity, usage limit, applicable services
- Usage report: who used what code, when

### Audit Log
**Priority**: P0
- Every write operation by admin or staff is logged: who, what, when, before state, after state
- Non-deletable, non-editable
- Filterable by entity type, user, date range
- Critical events: payment marked received, job status overridden, booking cancelled by admin, invoice voided, membership activated/deactivated, price changed

### System Settings
**Priority**: P1
- Business profile (name, logo, contact, GSTIN registration number)
- Notification template management (WhatsApp templates require Meta Business API approval)
- Webhook configuration (Razorpay)
- User access management (invite admin users, set roles)

---

## 3.5 Features AutoDeck Will NOT Build at Launch

**Car marketplace (buy/sell)**
AutoModz has a used car listing feature. This is a separate business. AutoDeck is a service platform, not a car marketplace. Remove.

**Insurance claims handling**
GoMechanic offers insurance claim facilitation. This requires deep integration with India insurance providers and regulatory knowledge. Defer until a clear demand signal exists.

**Used car inspection for purchase**
Pre-purchase inspections are a viable service category but require a different workflow (visiting the car's current location). Defer.

**Referral programme**
AutoModz has dead referral code. A referral programme is a growth tactic, not a product. Design it when growth phase begins.

**Tyre & battery services**
AutoDeck is a premium detailing and protection studio. Tyre fitting and battery replacement are mass-market commodities. These create operational complexity without margin. Remove.

**Denting & painting**
Panel work is a different skill set and equipment requirement from detailing. Out of scope.

**Fleet management portal**
Multi-vehicle corporate accounts are a future B2B play. Defer.

---

## 3.6 Future Roadmap — DEFER

These are real opportunities but should not be designed into the initial architecture in ways that add complexity before they are validated.

| Feature | Trigger to build |
|---|---|
| Multi-studio support | Second physical studio opened |
| Franchise management | Licensing intent established |
| Insurance partnership | India insurer partner identified |
| EV-specific services | EV services revenue validated |
| Loyalty points system | Membership is live and growing; points add differentiation |
| Gift cards | Marketing/gifting demand confirmed |
| Corporate/fleet accounts | First B2B customer signed |
| Online parts store | Parts margin opportunity validated |
| Mobile detailing (doorstep) | Demand and operational model validated |
| Third-party garages (marketplace) | Not in premium positioning; defer indefinitely |
