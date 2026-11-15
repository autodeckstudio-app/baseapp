# AutoDeck OS — Permissions & Security Architecture

## 8.1 Security Principles

AutoDeck is built on a defense-in-depth model. No single layer is trusted in isolation.

1. **Never trust the client for authorization.** Every mutation that matters is validated server-side inside a Cloud Function before touching Firestore. The client UI enforces UX constraints only; the server enforces business and security constraints.

2. **Custom claims over document reads.** Firebase custom claims (`{ role: 'customer' | 'studio' | 'admin' }`) are embedded in the ID token and evaluated inside Firestore rules without a database round-trip. The AutoModz pattern of calling `get(users/{uid})` on every rule evaluation is explicitly rejected — it is slow, expensive, and fails when the document is temporarily unavailable.

3. **Operational truth is server-owned.** Booking status, payment status, price, job status, bay assignment, warranty records, and inventory levels cannot be written by any client. They are written exclusively by Cloud Functions running under the service account.

4. **Principle of least privilege.** Each role is granted only the access required for its function. Studio staff cannot read payroll for other employees. Customers cannot read other customers' data. No role inherits from another except Admin.

5. **Audit all important mutations.** Every state-changing operation that affects money, status, roles, or customer promises produces an immutable `AuditLog` entry in the same Firestore transaction.

6. **Request validation before business logic.** Zod schema validation runs before any handler logic. Unknown fields are rejected in strict mode. Shape errors return 400 with structured detail, never 500.

7. **Rate limiting at the entry point.** Every Cloud Function callable by end users is rate-limited before it reaches business logic.

---

## 8.2 Role Definitions

### CUSTOMER

**Can read:**
- Own profile (`/customers/{uid}`)
- Own vehicles (`/vehicles/{id}` where `ownerId == uid`)
- Own bookings (`/bookings/{id}` where `customerId == uid`)
- Own job status and photos (read-only; `/jobs/{id}` where `customerId == uid`, restricted field set)
- Own invoices by public token (`/invoices/{id}` with valid `publicToken`)
- Own warranties (`/warranties/{id}` where `customerId == uid`)
- Own membership (`/memberships/{id}` where `customerId == uid`)
- Own notifications (`/notifications/{id}` where `userId == uid`)
- Own payment records (`/payments/{id}` where `customerId == uid`)
- Own approval requests (`/approvals/{id}` where `customerId == uid`)

**Can write (via Cloud Function only — never direct Firestore):**
- Create a booking (cannot set `status`, `price`, `bayId`, `membershipDiscountApplied`, `paymentStatus`)
- Respond to an approval request (approve/reject only)
- Submit a rating after job completion
- Update own profile (name, notificationPrefs, quietMode)
- Add or update own vehicle (registration, make, model, year, color, photo)
- Request account deletion (initiates 30-day grace period)

**Cannot write under any circumstances:**
- Booking status, price, bayId, paymentStatus
- Job status, assigned staff, job notes
- Warranty records (created only by system on job seal)
- Inventory records
- Employee data
- Audit log
- Other customers' data
- Role field on any user record

---

### STUDIO (employee/staff)

**Can read:**
- All jobs (`/jobs`) — filtered to studio in application layer (future: studioId field)
- All customers (`/customers`) — for operational lookup by phone or name
- All bookings (`/bookings`)
- Vehicles by plate number lookup
- Studio configuration (`/studioConfig`)
- Inventory items and transactions
- Own attendance and payroll records
- Notification records for customers they serve

**Can write (via Cloud Function only):**
- Advance job status (following legal transition graph)
- Add photos to a job (`/jobs/{id}/photos` subcollection)
- Create an approval request for additional work
- Record a payment (cash/UPI) — marks payment received, does not set `paid` status directly
- Create walk-in customer record
- Create walk-in job
- Record inventory movement (consumption against a job)
- Check in / check out attendance
- Request a notification be sent to a customer

**Cannot write:**
- Prices (without creating an approval request that admin confirms)
- Booking creation for existing customers (admin or customer only)
- Membership terms, activation, or cancellation
- Payroll records for themselves or others
- Service catalogue
- Other employees' records
- Audit log

---

### ADMIN

**Can read:** Everything.

**Can write:** Everything (via Cloud Functions for auditable mutations; direct Admin SDK for bootstrap/maintenance).

**Special powers:**
- Override price on any job or booking
- Activate or cancel memberships
- Hire, modify, and terminate employees (triggers custom claim mutation)
- Configure studio (bays, operating hours, holidays)
- Access and export full audit log
- Manage service catalogue (add, edit, reorder, deactivate)
- Issue refunds
- Hard-delete records (with double confirmation; always logged)

---

### SYSTEM (Cloud Functions / service account)

**Can write:**
- Audit log entries (only writer)
- Denormalized fields (e.g., `customer.activeMembershipId`)
- Notification records
- Scheduled task results (stale booking expiry, retention triggers)
- Generated PDF document references in Firestore
- Status transitions triggered by webhook (e.g., Razorpay `payment_link.paid`)

**Cannot:** Bypass Firestore rules (Admin SDK bypasses rules — this is intentional for trusted writes; however, Cloud Functions must still implement their own authorization logic before using Admin SDK, because Admin SDK bypasses rules silently).

---

## 8.3 Firestore Security Rules Architecture

The following describes the authorization logic for each major collection. Actual rule syntax will be derived from this specification.

**Helper functions available in rules:**
- `isCustomer()` — `request.auth.token.role == 'customer'`
- `isStudio()` — `request.auth.token.role == 'studio'`
- `isAdmin()` — `request.auth.token.role == 'admin'`
- `isStudioOrAdmin()` — `isStudio() || isAdmin()`
- `isOwn(field)` — `request.auth.uid == resource.data[field]`
- `isAuthenticated()` — `request.auth != null`

No `get()` calls inside rules. All role checks use custom claims only.

---

### `/tenants/{tenantId}`

| Operation | Who | Condition |
|-----------|-----|-----------|
| Read | Superadmin | `request.auth.token.role == 'superadmin'` |
| Read | Tenant admin (own) | `request.auth.token.role == 'admin' && request.auth.token.tenantId == tenantId` |
| Read | Anyone else | Denied |
| Create | Superadmin only | Via Admin SDK; no client create |
| Update | Superadmin only | Via Admin SDK |
| Delete | Nobody | Tenants are never hard-deleted; `active: false` to deactivate |

This collection is the root of the multi-tenant tree. Standard tenant isolation rules (`resource.data.tenantId == request.auth.token.tenantId`) do not apply here — the tenantId is the document ID, not a field. Superadmin access is checked via the `superadmin` role claim.

---

### `/customers/{userId}`

| Operation | Who | Condition |
|-----------|-----|-----------|
| Read | Customer | `request.auth.uid == userId` |
| Read | Studio, Admin | Role claim |
| Create | System only | Via Admin SDK on first login |
| Update | Customer (own) | `request.auth.uid == userId` AND field allowlist: `[name, notificationPrefs, quietMode]` only |
| Update | Admin | Any field except `uid` |
| Update — `role` field | Nobody | Blocked at rule level; only Admin SDK can set role (via custom claims, not this field) |
| Delete | Nobody | Soft delete only; `deletedAt` field set by Cloud Function |

---

### `/vehicles/{vehicleId}`

| Operation | Who | Condition |
|-----------|-----|-----------|
| Read | Customer | `resource.data.ownerId == request.auth.uid` |
| Read | Studio, Admin | Role claim |
| Create | Customer (own) | Via Cloud Function; `ownerId` set server-side |
| Update | Customer (own) | Field allowlist: `[make, model, year, color, registrationNumber, photo, odometer]` |
| Update | Studio, Admin | Any field |
| Delete | Admin only | Soft delete preferred |

---

### `/bookings/{bookingId}`

| Operation | Who | Condition |
|-----------|-----|-----------|
| Read | Customer | `resource.data.customerId == request.auth.uid` |
| Read | Studio, Admin | Role claim |
| Create | Nobody directly | Cloud Function only |
| Update | Customer | Denied entirely (reschedule/cancel goes through Cloud Function) |
| Update | Studio | Field allowlist: `[status, bayId, assignedEmployeeId, studioNotes]` |
| Update | Admin | Any field |
| Delete | Nobody | Cancellation sets `status: cancelled` + `cancelledAt` |

Specific field protection: `price`, `totalAmount`, `membershipDiscountApplied`, `paymentStatus`, `breakdown` — no client write under any role.

---

### `/jobs/{jobId}`

| Operation | Who | Condition |
|-----------|-----|-----------|
| Read — status/photos fields only | Customer | `resource.data.customerId == request.auth.uid` |
| Read — full record | Studio, Admin | Role claim |
| Create | Studio, Admin | Via Cloud Function |
| Update — status, photos, payments, notes | Studio | Role claim + field allowlist |
| Update — any field | Admin | Role claim |
| Delete | Nobody | Jobs are permanent records |

Customer explicitly cannot read: `studioNotes`, `cost breakdown internals`, `staffAssignments`.

---

### `/payments/{paymentId}`

| Operation | Who | Condition |
|-----------|-----|-----------|
| Read | Customer | `resource.data.customerId == request.auth.uid` |
| Read | Studio, Admin | Role claim |
| Create | Nobody | Cloud Function / Admin SDK only |
| Update | Nobody | Cloud Function / Admin SDK only |
| Delete | Nobody | Immutable records |

No client of any role writes to `/payments` directly. All payment state changes flow through authenticated Cloud Functions that validate the Razorpay webhook signature or the studio's manual-payment request.

---

### `/warranties/{warrantyId}`

| Operation | Who | Condition |
|-----------|-----|-----------|
| Read | Customer | `resource.data.customerId == request.auth.uid` |
| Read | Studio, Admin | Role claim |
| Create | Nobody (client) | System only, on job seal |
| Update | Admin only | Corrections only; all updates logged |
| Delete | Nobody | Warranties are permanent; `revokedAt` field for exceptional cases |

Warranty terms are captured at job seal time. Subsequent changes to the service catalogue do not retroactively alter warranty records.

---

### `/auditLog/{entryId}`

| Operation | Who | Condition |
|-----------|-----|-----------|
| Read | Admin only | Role claim |
| Create | Nobody (client) | Admin SDK / Cloud Function system account only |
| Update | Nobody | Immutable — no updates ever |
| Delete | Nobody | Immutable — no deletes ever |

The audit log is append-only by design. Even admin users cannot modify or delete entries through Firestore rules. Only a manual GCP console intervention (with its own audit trail) could alter records.

---

### `/employees/{employeeId}`

| Operation | Who | Condition |
|-----------|-----|-----------|
| Read | Employee (own) | `request.auth.uid == resource.data.authUid` |
| Read | Admin | Role claim |
| Read | Customer | Denied entirely |
| Create | Admin via Cloud Function | Sets custom claim simultaneously |
| Update | Admin | Any field |
| Delete | Admin | Soft delete (`terminatedAt` field); Firebase Auth account disabled separately |

Studio staff cannot read each other's salary or payroll data.

---

### `/memberships/{membershipId}`

| Operation | Who | Condition |
|-----------|-----|-----------|
| Read | Customer | `resource.data.customerId == request.auth.uid` |
| Read | Admin | Role claim |
| Create | Cloud Function only | Customer requests via Cloud Function; system creates record in `pending` state |
| Update | Nobody (client) | All updates via Cloud Function |
| Delete | Nobody | Cancelled memberships get `status: cancelled`, `cancelledAt` |

Fields `status`, `activatedAt`, `activatedBy`, `washesTotal`, `washesUsed` — no client write permitted for any role.

---

### `/studioConfig/{configId}`

| Operation | Who | Condition |
|-----------|-----|-----------|
| Read | Studio, Admin | Role claim |
| Read | Customer | Denied |
| Write | Admin only | Via Cloud Function |

---

## 8.4 Cloud Functions Security Middleware

Every Cloud Function (callable and HTTP trigger) must implement the following pipeline in order. Skipping any step requires explicit documented justification.

```
1. Parse request
2. Authenticate
   - Extract and verify Firebase ID token (callable: automatic; HTTP: Authorization header)
   - On failure → 401 Unauthorized
3. Authorize
   - Check custom claim matches required role for this function
   - On failure → 403 Forbidden (do not reveal whether resource exists)
4. Validate input (Zod)
   - Apply strict schema (no unknown fields)
   - On failure → 400 Bad Request with structured field errors
5. Rate limit
   - Token bucket check for this user/IP against function-specific limit
   - On failure → 429 Too Many Requests with Retry-After header
6. Idempotency check (mutations only)
   - Check idempotency key in Firestore atomically
   - If duplicate → return original result immediately
7. Execute business logic
8. Write audit log (in same Firestore transaction as mutation)
9. Return result
```

Middleware is implemented as a composable wrapper, not copy-pasted into each function.

---

## 8.5 Rate Limiting Strategy

### Limits by Endpoint Category

| Category | Limit | Window |
|----------|-------|--------|
| Booking creation | 10 per user | Per hour |
| Cancellation / reschedule | 5 per user | Per hour |
| Payment intent creation | 20 per user | Per hour |
| Media upload signing | 50 per user | Per hour |
| Profile / vehicle mutation | 30 per user | Per hour |
| OTP verification | Handled by Firebase Auth | — |
| General authenticated | 200 per user | Per 15 minutes |
| Unauthenticated (public invoice) | 100 per IP | Per hour |
| Webhook endpoints | IP allowlist only | — |

### Implementation

**Phase 1 (MVP):** Token bucket counters stored in Firestore under `/rateLimits/{userId}/{windowKey}`. Simple, no additional infra. Adequate for hundreds of concurrent users. Bucket is read-atomically in the same transaction as the idempotency check.

**Phase 2 (scale):** Cloud Memorystore (Redis) for sub-millisecond rate limit evaluation at thousands of requests/second. Migrate when Firestore rate-limit reads become a cost concern.

---

## 8.6 Input Validation

All Cloud Function inputs are validated with Zod before any handler logic executes.

**Strategy:**
- One Zod schema per Cloud Function, co-located in the same file as the handler
- `z.object({...}).strict()` — unknown fields cause validation failure (prevents parameter injection)
- Custom refinements for domain rules:
  - `scheduledDate` must be in the future
  - `amount` must be a positive integer (in fils/paise, not decimal)
  - `registrationNumber` matches configured format (India plate format by default; regex configurable per tenant)
  - `serviceId` must reference an active service (cross-referenced in handler after schema validates shape)
- On validation failure: return `400` with `{ errors: ZodError.flatten() }` — structured, field-level detail
- Validation errors are not logged to audit (they are client errors, not security events); rate limit counters still increment

---

## 8.7 Payment Security

### Razorpay (V1 — Payment Links)

- Payment link is created server-side by a Cloud Function (`POST /razorpay/create-payment-link`)
- The function computes amount from `jobId` — the client-supplied amount field is ignored entirely
- Client receives only the `paymentLinkUrl` — it cannot inspect or modify the amount
- Razorpay webhook (`payment_link.paid`, `payment.failed`, `refund.created`) is the authoritative signal for payment state
- Webhook signature validated using `x-razorpay-signature` HMAC-SHA256 before processing
- Refunds are initiated by admin-only Cloud Function; customer cannot request a refund through the API
- Razorpay keys stored in Firebase Secret Manager — never in client bundles

### Manual Payments (cash / bank transfer / UPI)

- Studio staff records payment via Cloud Function: amount, method, reference
- Cloud Function verifies staff role and job ownership before accepting
- Payment record created with `status: pending_verification`
- Admin confirms or rejects in admin panel
- Customer cannot access or modify payment records at any stage

---

## 8.8 File Upload Security

### Upload Flow

1. Customer or studio client calls `POST /signUploadUrl` (authenticated Cloud Function)
2. Cloud Function verifies:
   - Authenticated user with valid role
   - For vehicle photos: `ownerId == request.uid` (customer) or studio role
   - For job photos: active job exists and requester is assigned studio or admin
   - Requested content type is `image/*` only
   - Declared file size ≤ 10MB
3. Cloud Function generates a signed Firebase Storage upload URL (expiry: 5 minutes)
4. Client uploads directly to Firebase Storage using the signed URL
5. After upload, a Cloud Function trigger (Storage `onObjectFinalized`) validates:
   - Actual MIME type matches declared content type
   - File size is within limit
   - Marks the storage object as `verified: true` in its metadata
   - Moves to rejected bucket if validation fails

### Download Security

- Service/studio photos: publicly readable (CDN-served)
- Customer vehicle photos: signed download URL, 1-hour expiry
- Job photos (customer-facing): signed download URL, 1-hour expiry
- Warranty certificates (PDF): signed download URL, 7-day expiry (for external sharing)
- No Firebase Storage rule grants public read to customer-owned objects

---

## 8.9 Authentication Security

### Customer — Phone OTP

- Firebase Auth phone authentication with OTP delivery via SMS
- India country code (+91) pre-selected in phone entry UI; phone format validated client-side before submission
- reCAPTCHA App Check required to prevent automated OTP abuse
- Firebase Auth handles OTP rate limiting (5 attempts per phone per hour)
- No server-side OTP storage needed — Firebase Auth manages the full verification flow

### Customer — Apple Sign-In (NOT in V1)

- V1 uses phone OTP only — no social login — Apple Sign-In is therefore not required by App Store guidelines
- If social login (Google/Apple) is added in V2+: Apple Sign-In must be added simultaneously, nonce generated client-side, hashed, sent to Firebase for verification

### Admin — Email/Password

- Admin accounts are internal, business-managed — no self-registration
- Accounts created manually by owner via Firebase Auth console or admin-only Cloud Function
- Strong password required (min 12 characters, enforced at creation)
- Multi-factor authentication (TOTP) strongly recommended; enforced for owner account
- Session cookie: httpOnly, Secure, SameSite=Strict, 14-day sliding expiry
- Explicit logout revokes session cookie and Firebase refresh token

### Custom Claims

- Set by admin-only Cloud Function: `admin.auth().setCustomUserClaims(uid, { role })`
- Claim takes effect on next ID token refresh (max 1 hour) — for immediate effect, call `auth.currentUser.getIdToken(true)` after claim assignment
- Role field in `/customers/{uid}` is informational only; the custom claim is authoritative
- Claims are included in every ID token — no database round-trip in Firestore rules

### Token Lifecycle

- ID token expiry: 1 hour (Firebase default; not configurable)
- Refresh token expiry: 30 days inactivity
- Refresh token revocation: on account deletion, role change (force re-login), or employee termination
- Session cookie expiry: 14 days; renewed on activity
- Admin session revocation: `admin.auth().revokeRefreshTokens(uid)` + delete session cookie

### Account Deletion

Customer-initiated account deletion Cloud Function:
1. Verify customer ID token
2. Check for active bookings (in `confirmed` or later status) — reject deletion if found
3. Set `customer.deletedAt = now`, `customer.deletionScheduledFor = now + 30 days`
4. Revoke all refresh tokens (force logout on all devices)
5. Schedule a Cloud Task for D+30 to: anonymize personal fields (name, phone, email → hashed), delete vehicle photos, delete FCM tokens
6. Audit log entry

---

## 8.10 API Security

- **HTTPS only.** HTTP requests are rejected at the Firebase Hosting / Cloud Run layer.
- **CORS.** Allowed origins: `https://admin.autodeck.in` (or configured domain), `autodeck://` (mobile deep link), `exp://` (development only). No wildcard.
- **Firebase App Check.** All callable Cloud Functions and HTTP endpoints registered with App Check. Enforced in production. Rejects requests from unauthorized clients (prevents script abuse of public-facing endpoints).
- **Webhook endpoints.** Not protected by App Check (webhook callers cannot run App Check). Instead: signature validation on every payload — `x-razorpay-signature` HMAC-SHA256 for Razorpay; verified before any payload is processed.
- **Internal API routes (admin web).** Next.js API routes are thin proxies to Cloud Functions. They validate the admin session cookie before forwarding. No business logic in Next.js API routes.

---

## 8.11 Customer Data Isolation

- Firestore rules structurally prevent cross-customer data access (rules check `customerId == request.auth.uid`)
- Studio staff can query customer records for operational purposes but cannot export customer lists in bulk (Cloud Function enforces: studio query returns only records with an active or recent job at this studio)
- Customer phone number and email are readable by studio only during an active job (`job.status` not in `[completed, cancelled]`) — historical jobs surface anonymized contact
- Admin access to customer records is logged in AuditLog with reason field required for bulk exports
- No customer data is included in any externally-shared URL except: invoice public token (shares invoice content only, no profile data) and warranty certificate link (shares warranty data only)

---

## 8.12 Secrets Management

| Secret | Storage | Accessible to |
|--------|---------|---------------|
| Firebase Admin SDK service account | Cloud Secret Manager | Cloud Functions only |
| Razorpay key ID + secret | Cloud Secret Manager | Cloud Functions only |
| Razorpay webhook signing secret | Cloud Secret Manager | Webhook handler only |
| WhatsApp API token | Cloud Secret Manager | Notification Cloud Function only |
| FCM server key | Firebase Console (managed) | Cloud Functions (via Firebase SDK) |
| EAS build secrets | EAS Secrets | Build pipeline only |
| GitHub Actions secrets | GitHub Encrypted Secrets | CI/CD pipeline only |

**Rules:**
- No secrets committed to the repository. `.gitignore` includes all `.env*` files.
- No secrets in client bundles. Verified via `strings` scan in CI on release builds.
- Secret rotation: triggered on employee termination (all shared secrets rotated), quarterly otherwise.
- Service account keys: prefer Workload Identity Federation (keyless auth) over JSON key files where GCP-native.

---

## 8.13 Audit Log Specification

### Schema

```
AuditLog {
  id:         string         // auto-generated
  timestamp:  Timestamp      // server-side FieldValue.serverTimestamp()
  actor: {
    uid:       string
    role:      'customer' | 'studio' | 'admin' | 'system'
    displayName: string      // snapshot at time of action
  }
  action:     string         // see action catalogue below
  entityType: string         // 'booking' | 'job' | 'payment' | etc.
  entityId:   string
  before:     object | null  // snapshot of relevant fields before change
  after:      object | null  // snapshot of relevant fields after change
  metadata:   object         // action-specific context (e.g., reason for override)
  ipAddress:  string | null  // for web requests
}
```

### Audited Actions (complete catalogue)

**Bookings**
- `booking.created` — customer uid, serviceId, scheduledDate, bayId, totalAmount
- `booking.confirmed` — by studio/admin
- `booking.rescheduled` — before/after scheduledDate, by whom
- `booking.cancelled` — by whom, reason
- `booking.price_overridden` — before/after totalAmount, by admin
- `booking.expired` — by system

**Jobs**
- `job.created` — source (booking / walkin), customerId
- `job.status_advanced` — before/after status, by whom
- `job.photos_added` — count, stage, by whom
- `job.notes_updated` — by whom (content not logged — privacy)

**Approvals**
- `approval.requested` — jobId, proposed work, price delta, by studio
- `approval.customer_approved` — by customer
- `approval.customer_rejected` — by customer
- `approval.admin_overridden` — by admin (with reason)

**Payments**
- `payment.recorded` — amount, method, by studio
- `payment.confirmed` — by admin or webhook
- `payment.refunded` — amount, reason, by admin
- `payment.failed` — from webhook

**Memberships**
- `membership.requested` — plan, by customer
- `membership.activated` — by admin (after payment verification)
- `membership.cancelled` — by admin or on expiry, reason
- `membership.upgraded` — before/after plan, by admin
- `membership.wash_used` — jobId, washes remaining after

**Warranties**
- `warranty.created` — on job seal, serviceId, terms snapshot
- `warranty.revoked` — by admin, reason (exceptional only)

**Employees**
- `employee.created` — by admin
- `employee.role_changed` — before/after role, by admin
- `employee.terminated` — by admin, effective date
- `employee.payroll_processed` — period, amount, by admin

**Users / Accounts**
- `user.role_assigned` — custom claim set, by admin
- `user.account_deletion_requested` — by customer
- `user.account_deleted` — by system on scheduled date
- `user.login` — platform (iOS / Android / web), ip address

**Admin Actions**
- `admin.bulk_export` — entity type, record count, by admin (with reason)
- `admin.studio_config_changed` — before/after, by admin
- `admin.service_catalogue_changed` — serviceId, before/after fields, by admin
- `admin.inventory_adjusted` — manual correction, before/after qty, by admin

**System**
- `system.booking_expired` — batch job run
- `system.retention_triggered` — customerId
