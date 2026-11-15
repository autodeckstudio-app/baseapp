# 10 — Admin Web Application Architecture

**Scope:** The admin web application — the browser-based interface for business owners and administrators.  
**Stack:** Next.js 15 (App Router) + Firebase Admin SDK + Tailwind CSS + shadcn/ui.

---

## 10.1 Technology Decision: Next.js 15 + App Router

**Why Next.js for admin web:**

- Server Components fetch data without client-side waterfalls — dashboards load fast
- Firebase Admin SDK runs server-side (no credentials exposed in browser)
- React Server Actions for form mutations without separate API endpoints
- Tailwind + shadcn/ui: comprehensive, accessible component library; no design-from-scratch cost
- TypeScript shared with Cloud Functions and mobile apps via `packages/shared-types`
- Deployment: Vercel (zero-config) or Firebase Hosting (if keeping everything Firebase)

**The admin web does not use the Firestore client SDK directly.** All data reads go through Server Components (Firebase Admin SDK) or Server Actions (Firebase Admin SDK). This eliminates the need to ship Firebase credentials to the browser.

Exception: real-time features (live job board, bay utilization) use the Firestore client SDK with a short-lived service token — scoped read-only.

---

## 10.2 Project Structure

```
apps/admin/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   │   └── page.tsx           Email/password login
│   │   └── layout.tsx
│   │
│   └── (admin)/                   All routes require admin role
│       ├── layout.tsx             Sidebar + top bar shell
│       ├── page.tsx               Dashboard (redirect to /dashboard)
│       │
│       ├── dashboard/
│       │   └── page.tsx           KPIs, activity feed, alerts
│       │
│       ├── bookings/
│       │   ├── page.tsx           Booking list + calendar view
│       │   └── [id]/
│       │       └── page.tsx       Booking detail + management
│       │
│       ├── jobs/
│       │   └── [id]/
│       │       └── page.tsx       Job card (operational)
│       │
│       ├── customers/
│       │   ├── page.tsx           Customer list
│       │   └── [id]/
│       │       └── page.tsx       Customer 360
│       │
│       ├── vehicles/
│       │   └── [registration]/
│       │       └── page.tsx       Vehicle record by plate
│       │
│       ├── employees/
│       │   ├── page.tsx           Employee roster
│       │   └── [id]/
│       │       └── page.tsx       Employee detail
│       │
│       ├── memberships/
│       │   ├── page.tsx           All memberships
│       │   └── [id]/
│       │       └── page.tsx       Membership detail + activation
│       │
│       ├── services/
│       │   ├── page.tsx           Service catalogue
│       │   └── [id]/
│       │       └── page.tsx       Edit service
│       │
│       ├── inventory/
│       │   ├── page.tsx           Stock levels + alerts
│       │   └── [id]/
│       │       └── page.tsx       Item detail + movement history
│       │
│       ├── invoices/
│       │   ├── page.tsx           Invoice list
│       │   └── [id]/
│       │       └── page.tsx       Invoice detail + void
│       │
│       ├── reports/
│       │   ├── revenue/
│       │   │   └── page.tsx       Revenue by date, service, method
│       │   ├── membership/
│       │   │   └── page.tsx       Membership retention + usage
│       │   ├── jobs/
│       │   │   └── page.tsx       Completion time, by service type
│       │   └── inventory/
│       │       └── page.tsx       Consumption report
│       │
│       ├── audit/
│       │   └── page.tsx           Audit log (searchable, filterable)
│       │
│       └── settings/
│           ├── studio/
│           │   └── page.tsx       Studio config (hours, bays, holidays)
│           ├── services/
│           │   └── page.tsx       (alias to /services)
│           └── account/
│               └── page.tsx       Admin account settings
│
├── components/
│   ├── ui/                        shadcn/ui re-exports + customizations
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   ├── TopBar.tsx
│   │   └── Breadcrumbs.tsx
│   ├── data-tables/
│   │   ├── BookingTable.tsx
│   │   ├── CustomerTable.tsx
│   │   ├── JobTable.tsx
│   │   └── DataTable.tsx          Generic paginated table
│   ├── forms/
│   │   ├── ServiceForm.tsx
│   │   ├── EmployeeForm.tsx
│   │   └── StudioSettingsForm.tsx
│   └── charts/
│       ├── RevenueChart.tsx
│       └── BayUtilizationChart.tsx
│
└── lib/
    ├── firebase-admin.ts          Admin SDK singleton
    ├── auth.ts                    Session cookie management
    ├── middleware.ts              Route protection
    └── queries/
        ├── bookings.ts
        ├── customers.ts
        ├── jobs.ts
        ├── reports.ts
        └── ...
```

---

## 10.3 Authentication

**Method:** Email/password for admin accounts (not phone OTP — admin accounts are provisioned by the business owner for specific staff).

**Session management:**
- Login via Firebase Auth client SDK (email/password)
- On success: POST to `/api/session` with Firebase ID token
- Server mints an httpOnly session cookie (Firebase Admin SDK `createSessionCookie`, 14-day expiry)
- All subsequent requests: cookie sent automatically; middleware validates via `verifySessionCookie`
- Logout: POST to `/api/session` DELETE → `revokeRefreshTokens` + clear cookie

**Middleware (middleware.ts):**
```typescript
// Runs on every request to (admin)/ routes
// Reads session cookie → validates → checks custom claim role === 'admin'
// Redirect to /login on failure
```

**Role enforcement:** Firebase custom claims `{ role: 'admin' }`. If role is not 'admin', redirect to login even with valid session.

---

## 10.4 Key Admin Screens

### Dashboard

**Purpose:** Single-glance studio health. Loaded as Server Component (fast initial render).

**Sections:**

*Today's Overview (real-time, Firestore client SDK listener)*
- Jobs by status: pending / in progress / quality check / ready / completed
- Bay utilization: live grid (which bays occupied, which free)
- Revenue today: sum of paid invoices today

*This Week's KPIs*
- Total revenue (vs last week)
- Jobs completed (vs last week)
- Average job duration
- New customers this week

*Alerts (priority order)*
- Pending approval requests (customers waiting) — with age
- Memberships pending activation — with days waiting
- Low stock items — with current quantity
- Bookings arriving in next 2 hours

*Recent Activity Feed*
- Last 15 audit log entries (human-readable)
- e.g. "Ahmed advanced Job #1042 to Quality Check", "New booking from Sarah Al-Mansoori"

### Booking Management

**Calendar View:**
- Week/day toggle
- Bay swim lanes (one row per bay)
- Bookings rendered as blocks with colour by status
- Click block → booking detail side panel (no full navigation)
- Drag-to-reschedule (Phase 3+)

**List View:**
- Filterable by: status, service type, bay, date range, customer name
- Columns: booking reference, customer, vehicle (plate), service, bay, date/time, status, amount
- Sortable
- Pagination: 25 per page (server-side cursor pagination)
- CSV export

**Booking Detail:**
- All booking fields
- Price breakdown (immutable snapshot)
- History of changes (from AuditLog)
- Actions: Confirm, Reschedule (opens slot picker), Cancel, Override price
- Link to ServiceJob (once active)

### Job Card (Operational View)

Admin's read-heavy view of an active job. Studio app is the primary operational tool, but admin web provides full visibility.

**Sections:**
- Status rail with timestamps
- Customer + vehicle (links to Customer 360 and Vehicle Record)
- Service + scope + add-ons
- Assigned bay + employee
- Photo gallery by stage (with stage labels)
- Approval requests (pending / resolved)
- Payments (all payment records, total paid, balance due)
- Invoice (generate if not yet created, view PDF, resend)
- Internal notes
- AuditLog entries for this job

### Customer 360

Everything about one customer in one view.

**Sections:**
- Profile: name, phone, email, member since, tags, admin notes
- Active membership: tier, washes remaining, expiry, renewal button
- Vehicles: all vehicles with primary photo, registration, last service date
- Booking history: all bookings (paginated), sortable by date/status
- Financial: lifetime spend, average order value, payment method breakdown
- Protections/warranties: all active, with expiry alerts
- Communication: last notifications sent (type, channel, timestamp)

**Actions:**
- Edit tags, notes
- Apply manual discount (reason required, logged)
- Adjust membership (activate, renew, cancel, modify wash count with reason)
- Block customer (with reason)
- Export customer data (GDPR/PDPL compliance)

### Vehicle Record

Lookup by registration number (used by studio when a vehicle arrives).

**Sections:**
- Vehicle specs
- Current owner (customer link)
- All service history (all jobs across all time)
- All active protections
- All warranties
- Photos from all jobs

This is the studio's primary reference when a vehicle arrives — they can quickly see the full history.

### Employee Management

**Employee List:**
- Name, role, phone, status (active/on leave/terminated)
- Today's attendance status (checked in / not yet / checked out)
- Assigned jobs today (count)

**Employee Detail:**
- Profile + role
- Edit role → calls Cloud Function → sets Firebase custom claim
- Attendance summary: this month (days present, late, absent)
- Attendance log: calendar view
- Payroll history: monthly records with status (calculated / approved / paid)
- Jobs handled: list with completion ratings
- Actions: Edit, Mark on leave, Terminate (revokes access)

**Add Employee Flow:**
1. Enter name, phone, email, role, salary type
2. Cloud Function creates employee record + sends SMS/WhatsApp with app invite link
3. Employee authenticates via phone OTP on first login
4. Cloud Function links auth UID to employee record + sets custom claim

### Membership Management

**All Memberships View:**
- Active: customer name, tier, washes remaining, expiry date, monthly amount
- Pending activation: customer submitted payment reference; "Activate" button
- Expired: renewal date, churn date
- Cancelled: with cancellation reason

**Membership Detail + Activation:**
- Activation: admin verifies payment → clicks "Activate" → Cloud Function transitions status from `pending_payment` to `active`, sets dates, confirms to customer via notification
- Upgrade: creates new membership record, links old (history preserved)
- Cancel: Cloud Function; wash count frozen; customer notified

**Membership Analytics:**
- Active count by tier
- Monthly revenue from memberships
- Churn rate (last 3 months)
- Wash utilization rate (are members using their washes?)
- Average tenure

### Service Catalogue Management

**Service List:**
- Active/inactive filter
- Drag-to-reorder (display order)
- Each service: name, category, price, duration, warranty period, active toggle

**Edit Service:**
- All fields editable
- **Warning banner:** "Changes to price, warranty, or description do NOT affect completed bookings or issued warranties. Historical records are immutable."
- Category cannot change if active bookings exist for this service
- Soft delete only (inactive flag, never delete — historical references must resolve)

**Add Service:**
- Required: name, category, price, currency (INR default; tenant-configurable), estimatedDurationMinutes, requiredBayType
- Optional: brand, warranty template, scopes, add-ons, display photo

### Reports

All reports are Server Components reading from Firestore (operational metrics) or BigQuery (historical aggregates in Phase 4+).

**Revenue Report:**
- Date range selector (today / this week / this month / custom)
- Total revenue, paid vs pending
- Breakdown by service category (bar chart)
- Breakdown by payment method (pie chart)
- Day-by-day revenue trend (line chart)
- Top 10 services by revenue
- CSV export

**Jobs Report:**
- Jobs by status
- Average time per status stage (where did jobs spend the most time?)
- Completion rate (jobs completed vs cancelled vs expired)
- By service type breakdown
- By employee breakdown (Phase 3)

**Membership Report:**
- Active members by tier
- New joins this month vs churn
- Wash utilization (average washes used vs included)
- Membership revenue trend
- Renewal forecast (memberships expiring next 30 days)

**Inventory Report:**
- Items consumed this month by category
- Cost of goods used
- Low-stock history (how often items hit threshold)
- Supplier order history

### Audit Log

Append-only, searchable, filterable.

**Filters:**
- Actor (any staff member, or system)
- Entity type (booking, job, payment, membership, employee...)
- Action (created, status_changed, price_changed, activated, cancelled...)
- Date range

**Each entry shows:**
- Timestamp
- Actor (name + role)
- Action (human-readable)
- Entity (linked to the entity's page)
- Before/after JSON diff (expandable)
- IP address (for security review)

**Export:** CSV for compliance or investigation purposes.

### Studio Settings

**Operating Hours:**
- Day-by-day open/close time toggle
- Individual day can be marked closed

**Holiday Calendar:**
- Add/remove holidays (India national holidays and Gujarat state holidays suggested; admin confirms)
- Custom closed dates

**Bay Configuration:**
- Current bays list (name, type, active status)
- Toggle bay active/inactive (e.g. for maintenance)
- Add bay (name + type)
- Bay cannot be deleted if it has historical job associations — only deactivated

**Studio Profile:**
- Name, address, phone, email, WhatsApp number
- Used in customer-facing communications and app display

---

## 10.5 Real-time Updates

**Live features (Firestore client SDK listener):**
- Dashboard bay utilization grid: updates when any job status changes
- Pending approvals counter: updates when customer responds
- Job card status: updates as studio advances status
- Membership pending activation count

**Polling (30-second interval):**
- Booking list (too many documents for efficient real-time listener)
- Customer list
- Report figures

**Server Component (one-time fetch):**
- All other pages: employee detail, audit log, reports, settings
- These don't need real-time updates

---

## 10.6 Data Tables Pattern

All data tables are built on a generic `DataTable` component with:
- Server-side pagination (Firestore cursor-based)
- Column sorting (server-side for large datasets, client-side for small)
- Column visibility toggle
- CSV export via Cloud Function (streams large result sets)
- Consistent loading skeleton (skeleton rows, not spinners)

**Pagination strategy:**
- Default: 25 rows per page
- Large tables (audit log, payment history): cursor-based (no page numbers — "load more" or next/prev)
- Small tables (employees, services): client-side pagination acceptable

---

## 10.7 Performance

**Server Components for initial data load:**
- Dashboard KPIs rendered on server → no client hydration waterfall
- Customer 360 data fetched server-side on page load
- Suspense boundaries per section for parallel data fetching

**Client Components for interactivity:**
- Real-time listeners (bay board, status updates)
- Form state
- Modals and drawers

**Next.js Image:**
- Service catalogue photos optimized via Next.js Image component
- Vehicle photos loaded via signed URL (not through Next.js Image optimization — too expensive for user-uploaded photos)

**Admin panel performance target:** initial page load < 3 seconds on a standard office network connection. Admin is an internal tool; slightly higher tolerance than customer-facing app.

---

## 10.8 Component Library

**shadcn/ui** (built on Radix UI primitives):
- Button, Input, Select, Checkbox, Switch, Badge, Card, Dialog, Sheet, Popover, Tooltip
- DataTable (custom extension of tanstack/react-table)
- DatePicker (react-day-picker)
- Form (react-hook-form + Zod)

**Custom components:**
- StatusRail — consistent status progression display
- BayGrid — live bay occupancy visualization
- AuditEntry — formatted audit log row
- PriceBreakdown — line-item price display (always from server snapshot)
- WarrantyCertificate — certificate preview card

**Charts:**
- Recharts for revenue, membership, and operational charts
- SVG-based — no canvas dependency

---

## 10.9 Deployment

**Vercel** (recommended):
- Zero-config Next.js deployment
- Edge Functions for middleware (route protection runs at edge)
- Environment variables via Vercel dashboard
- Preview deployments per PR (for staging review)
- Custom domain: admin.autodeck.ae

**Alternative: Firebase Hosting + Cloud Run**
- Firebase Hosting for static assets + CDN
- Cloud Run for Next.js server (containerized)
- More infrastructure overhead; chosen if keeping all infrastructure Firebase-native

**Recommendation:** Vercel for development velocity. Reconsider if multi-region requirements emerge.
