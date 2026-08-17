# 06 — Domain Model

Definitive data dictionary for AutoDeck OS. All Firestore collection paths, field types, ownership rules, and immutability constraints are specified here. Implementation must match this specification.

**Multi-tenant:** Every tenant-scoped document carries `tenantId`. Security rules enforce isolation. See `docs/19-multitenant-saas-architecture.md`.

**Market:** India (Ahmedabad, Gujarat). Currency: INR. Timezone: Asia/Kolkata.

---

## 6.0 Tenant Entity

```
/tenants/{tenantId}
```

| Field | Type | Notes |
|---|---|---|
| id | string | e.g. "automodz" |
| name | string | "AutoModz Detailing" |
| contactEmail | string | |
| contactPhone | string | |
| plan | 'starter' \| 'growth' \| 'enterprise' | Future SaaS billing tier |
| active | boolean | |
| createdAt | Timestamp | |

**Access:** Read/write by superadmin only. Tenant admin reads their own record.

AutoModz is the first tenant: `tenantId = "automodz"`.

---

## 6.1 Domain Entities Overview

```
CUSTOMER DOMAIN
┌──────────────────────────────────────────────────────────────────┐
│  Customer ──────────────────────┐                                │
│     │                          │                                 │
│     │ 1:many                   │ 1:active                        │
│     ▼                          ▼                                 │
│  Vehicle              Membership                                 │
│     │                    │                                       │
│     │ 1:many             │ 1:many                                │
│     ▼                    ▼                                       │
│  Protection         MembershipUsage                              │
│  (insurance/PUC/RC)                                              │
└──────────────────────────────────────────────────────────────────┘

BOOKING / JOB DOMAIN
┌──────────────────────────────────────────────────────────────────┐
│  Customer ──────┐                                                │
│                 │ 1:many                                         │
│  Vehicle ───────┤                                                │
│                 ▼                                                │
│             Booking ──────────────────────────────────────────┐ │
│                 │ 1:1 (on vehicle_received)                    │ │
│                 ▼                                             │ │
│            ServiceJob                                         │ │
│                 │                                             │ │
│     ┌───────────┼──────────────┬──────────────┬──────────┐   │ │
│     ▼           ▼              ▼              ▼          ▼   │ │
│ StatusHistory  Photo      ApprovalRequest  Payment   Invoice │ │
│ (embedded arr) (embedded) (top-level)      (top-lv)  (top-lv)│ │
│                                                       │       │ │
│                         Warranty ◄────────────────────┘       │ │
│                         (generated at job completion)          │ │
└──────────────────────────────────────────────────────────────────┘

STUDIO DOMAIN
┌──────────────────────────────────────────────────────────────────┐
│  Studio ───────────────────────────┐                            │
│     │                             │ 1:many                      │
│     │ 1:many                      ▼                             │
│     ▼                           Bay                             │
│  Employee                         │                             │
│     │                             │ many:1                      │
│     │ 1:many                      ▼                             │
│     ▼                          BayType                          │
│  Attendance                    (protection|wash|general)        │
│     │                                                           │
│     ▼                                                           │
│  Payroll                                                        │
└──────────────────────────────────────────────────────────────────┘

SERVICE CATALOGUE
┌──────────────────────────────────────────────────────────────────┐
│  Service ──────────────────────┐                                │
│     │                         │ 1:many                          │
│     │ 1:many                  ▼                                 │
│     ▼                      ServiceAddOn                         │
│  ServiceScope                                                   │
└──────────────────────────────────────────────────────────────────┘

INVENTORY
┌──────────────────────────────────────────────────────────────────┐
│  InventoryItem ─────────────────────────────────────────────┐   │
│     │                                                       │   │
│     │ 1:many                                                │   │
│     ▼                                                       │   │
│  InventoryMovement                                          │   │
│  (references ServiceJob for consumption records)            │   │
└──────────────────────────────────────────────────────────────────┘

AUDIT
┌──────────────────────────────────────────────────────────────────┐
│  AuditLog (append-only, references all entity types)            │
└──────────────────────────────────────────────────────────────────┘
```

---

## 6.2 Core Entities — Full Specification

### Customer

**Path:** `/customers/{customerId}`

**Written by:** Customer (self, limited fields) / Cloud Functions / Admin SDK

```typescript
interface Customer {
  id: string;                          // Firestore document ID
  tenantId: string;                    // REQUIRED — tenant isolation key
  uid: string;                         // Firebase Auth UID (indexed)
  name: string;
  phone: string;                       // E.164 format, e.g. +919876543210
  email: string | null;
  avatarUrl: string | null;
  preferredLanguage: 'en' | 'hi' | 'gu';  // India: English, Hindi, Gujarati
  notificationPrefs: {
    push: boolean;
    whatsapp: boolean;
    email: boolean;
    sms: boolean;
  };
  quietMode: boolean;                  // suppresses non-critical notifications
  tags: string[];                      // admin-applied tags (VIP, fleet, etc.)
  notes: string | null;                // admin-only field; rules block customer write
  referredBy: string | null;           // customerId of referrer
  createdAt: Timestamp;
  updatedAt: Timestamp;
  deletedAt: Timestamp | null;         // soft delete; customer-facing data hidden
}
```

**Ownership:**
- Customer can update: name, email, avatarUrl, preferredLanguage, notificationPrefs, quietMode
- Admin can update: all fields including tags, notes
- uid, phone, createdAt: immutable after creation

**Subcollections:**
- `/customers/{id}/fcmTokens/{tokenId}` — push notification device tokens
- `/customers/{id}/savedAddresses/{addressId}` — pickup/drop addresses

---

### Vehicle

**Path:** `/vehicles/{vehicleId}`

**Reason for top-level (not subcollection):** Studio needs to query by `registrationNumber` without knowing the customer's UID. Top-level collection enables a composite index on `registrationNumber`.

**Written by:** Customer (add vehicle, limited fields) / Cloud Functions

```typescript
interface Vehicle {
  id: string;
  tenantId: string;                    // REQUIRED — tenant isolation key
  customerId: string;                  // indexed; links to Customer
  make: string;                        // e.g. "Maruti Suzuki"
  model: string;                       // e.g. "Brezza"
  year: number;
  color: string;
  registrationNumber: string;          // indexed; used for studio lookups by plate
  vin: string | null;
  category: 'sedan' | 'suv' | 'hatchback' | 'luxury' | 'commercial' | 'van';
  primaryPhotoUrl: string | null;
  photos: string[];                    // additional vehicle photos
  odometer: number | null;             // km
  fuelType: 'petrol' | 'diesel' | 'electric' | 'hybrid' | 'cng' | null;
  transmission: 'automatic' | 'manual' | null;
  notes: string | null;                // admin/studio notes; not customer-visible
  publicHistoryConsent: boolean;       // customer opts in to public service history (e.g. for resale)
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**Subcollections:**
- `/vehicles/{id}/protections/{protectionId}` — insurance, PUC, RC, FastTag

---

### Studio

**Path:** `/studios/{studioId}`

**Written by:** Admin only

```typescript
interface Studio {
  id: string;
  name: string;
  address: {
    line1: string;
    line2: string | null;
    city: string;
    emirate: string;
    country: string;
    coordinates: { lat: number; lng: number } | null;
  };
  phone: string;
  email: string;
  operatingHours: {
    [day: string]: {               // 'monday' | 'tuesday' | ... | 'sunday'
      open: string;                // HH:MM, e.g. "09:00"
      close: string;               // HH:MM, e.g. "19:00"
      closed: boolean;
    };
  };
  holidays: string[];              // ISO dates, e.g. ["2026-12-01"]
  blockedSlots: Array<{            // admin-defined blocks (maintenance, events)
    date: string;
    bayId: string | null;          // null = entire studio blocked
    reason: string;
  }>;
  timezone: string;                // IANA timezone — e.g. "Asia/Kolkata" (India default)
  active: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

### Bay

**Path:** `/studios/{studioId}/bays/{bayId}`

**Written by:** Admin only

```typescript
interface Bay {
  id: string;
  studioId: string;
  name: string;                    // e.g. "Protection Bay 1", "Wash Bay A"
  type: 'protection' | 'wash' | 'general';
  capacity: number;                // max concurrent jobs (usually 1)
  active: boolean;
  notes: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

### Service (Catalogue Entry)

**Path:** `/services/{serviceId}`

**Written by:** Admin only

**CRITICAL:** This is a TEMPLATE. Completed jobs snapshot service details. Never re-read this for historical records.

```typescript
interface Service {
  id: string;
  name: string;                    // e.g. "LLumar Gloss PPF"
  category: 'ppf' | 'ceramic' | 'washing' | 'coating' | 'inspection' | 'tinting' | 'other';
  brand: string | null;            // e.g. "LLumar", "Kovalent"
  description: string;
  basePrice: number;               // minor currency units (paise for INR) — never decimal
  currency: string;                // ISO 4217 — "INR" (tenant-configurable; AutoModz default)
  estimatedDurationMinutes: number;
  warrantyTemplate: {              // TEMPLATE ONLY — not copied verbatim to completed warranties
    period: number;
    unit: 'days' | 'months' | 'years' | 'lifetime';
    description: string;
  } | null;
  scopes: ServiceScope[];          // inline array — small enough to embed
  addOns: ServiceAddOn[];          // inline array
  requiredBayType: 'protection' | 'wash' | 'general';
  membershipWashEligible: boolean; // can a membership wash redeem this service?
  active: boolean;
  displayOrder: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface ServiceScope {
  id: string;
  name: string;                    // e.g. "Full Body", "Partial Hood + Fenders"
  durationAdjustmentMinutes: number;
  priceMultiplier: number;         // 1.0 = no adjustment; 0.8 = 20% less
}

interface ServiceAddOn {
  id: string;
  name: string;
  price: number;
  durationAdjustmentMinutes: number;
}
```

---

### Booking

**Path:** `/bookings/{bookingId}`

**Written by:** Cloud Functions only (never direct client writes to any booking field)

```typescript
interface Booking {
  id: string;
  idempotencyKey: string;          // (customerId + serviceId + date + time) — prevents duplicates
  customerId: string;              // indexed
  vehicleId: string;
  studioId: string;

  // Service details — snapshotted at creation; immutable
  serviceId: string;
  serviceName: string;             // SNAPSHOT
  serviceCategory: string;         // SNAPSHOT
  scopeId: string | null;
  scopeName: string | null;        // SNAPSHOT
  addOnIds: string[];
  addOnNames: string[];            // SNAPSHOT

  // Schedule
  scheduledDate: string;           // ISO date "2026-09-15"
  scheduledTime: string;           // HH:MM "09:00"
  estimatedEndDate: string;        // ISO date
  estimatedEndTime: string;        // HH:MM
  bayId: string | null;            // assigned at commit; null until confirmed

  // Pricing — snapshotted at creation; immutable
  priceBreakdown: {
    basePrice: number;
    scopeAdjustment: number;
    addOnsTotal: number;
    membershipDiscount: number;
    pickupFee: number;
    dropFee: number;
    tax: number;
    total: number;
    currency: string;
  };
  totalAmount: number;

  // Membership
  membershipId: string | null;
  membershipDiscountApplied: boolean;
  membershipWashUsed: boolean;

  // Pickup / Drop
  pickupRequested: boolean;
  dropRequested: boolean;
  pickupAddress: Address | null;   // SNAPSHOT — edits to saved address never change this
  dropAddress: Address | null;     // SNAPSHOT

  // Status
  status: BookingStatus;
  cancelledAt: Timestamp | null;
  cancellationReason: string | null;
  cancelledBy: string | null;      // actorId
  rescheduleCount: number;
  lastModifiedBy: string;          // actorId

  // Linked job (set when status → ACTIVE)
  jobId: string | null;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'active'        // vehicle received; ServiceJob is now operational record
  | 'completed'
  | 'cancelled'
  | 'expired';

interface Address {
  label: string;
  line1: string;
  line2: string | null;
  city: string;
  emirate: string;
  coordinates: { lat: number; lng: number } | null;
}
```

---

### ServiceJob

**Path:** `/jobs/{jobId}`

**Written by:** Cloud Functions and Admin SDK only. Studio app calls Cloud Functions; never writes directly.

```typescript
interface ServiceJob {
  id: string;
  bookingId: string | null;        // null for walk-in jobs
  customerId: string;
  vehicleId: string;
  studioId: string;
  bayId: string;

  // Denormalized for studio display without sub-queries
  customerName: string;            // SNAPSHOT
  customerPhone: string;           // SNAPSHOT
  vehicleReg: string;              // SNAPSHOT
  vehicleMakeModel: string;        // SNAPSHOT

  // Service items — snapshotted from booking or walk-in selection
  serviceItems: Array<{
    serviceId: string;
    name: string;                  // SNAPSHOT
    scopeName: string | null;      // SNAPSHOT
    price: number;                 // SNAPSHOT
    durationMinutes: number;       // SNAPSHOT
    addOns: Array<{ name: string; price: number }>;
  }>;

  // Status
  status: JobStatus;
  statusHistory: JobStatusEntry[]; // append-only; never modified after write

  // Assignments
  assignedEmployeeIds: string[];

  // Vehicle condition at arrival
  vehicleConditionNotes: string;
  arrivalPhotos: string[];         // Storage URLs of arrival photos

  // Job photos by stage
  photos: Array<{
    stage: 'arrival' | 'in_progress' | 'completion' | 'before' | 'after';
    url: string;
    takenAt: Timestamp;
    takenBy: string;               // employeeId
  }>;

  // Financials
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  currency: string;
  paymentStatus: 'unpaid' | 'partial' | 'paid' | 'refunded';
  amountPaid: number;

  // Linked records
  invoiceId: string | null;
  warrantyIds: string[];

  notes: string;                   // operational notes; not customer-visible

  // Timing
  estimatedCompletion: Timestamp | null;
  actualCompletion: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  completedAt: Timestamp | null;
  sealedAt: Timestamp | null;      // set when job is closed and invoice issued
}

type JobStatus =
  | 'vehicle_received'
  | 'in_progress'
  | 'quality_check'
  | 'ready_for_delivery'
  | 'delivered'
  | 'void';

interface JobStatusEntry {
  status: JobStatus;
  timestamp: Timestamp;
  updatedBy: string;               // employeeId or 'system'
  notes: string | null;
  photoUrls: string[];
}
```

---

### ApprovalRequest

**Path:** `/approvals/{approvalId}`

**Written by:** Studio (via Cloud Function) / Customer responds (via Cloud Function)

```typescript
interface ApprovalRequest {
  id: string;
  tenantId: string;                // REQUIRED — tenant isolation
  studioId: string;                // REQUIRED — studio scoping
  jobId: string;
  customerId: string;
  requestedBy: string;             // employeeId
  reason: string;                  // why additional work is needed
  proposedWork: string;            // what will be done
  priceImpact: number;             // additional cost (can be 0)
  timeImpact: number;              // additional minutes
  photos: string[];                // photos showing the issue
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  respondedAt: Timestamp | null;
  respondedBy: string | null;      // customerId or adminId
  expiresAt: Timestamp;            // 24h from creation; auto-expired by cron
  createdAt: Timestamp;
}
```

---

### Payment

**Path:** `/payments/{paymentId}`

**Written by:** Cloud Functions only (Razorpay webhooks and manual settlement)

**Immutable after:** `status === 'completed'` — fields cannot be changed; refund creates a new linked record

```typescript
interface Payment {
  id: string;
  jobId: string;
  bookingId: string | null;
  customerId: string;              // indexed
  amount: number;
  currency: string;
  method: 'stripe' | 'tabby' | 'cash' | 'upi' | 'bank_transfer';
  status: 'pending' | 'completed' | 'failed' | 'refunded';

  // Gateway references
  stripePaymentIntentId: string | null;
  stripeChargeId: string | null;
  tabbyPaymentId: string | null;

  // Manual payment
  reference: string | null;        // bank transfer ref, UPI ref, cash receipt #
  collectedBy: string | null;      // employeeId for manual collection

  receiptUrl: string | null;       // Razorpay receipt URL or generated PDF
  settledAt: Timestamp | null;
  createdAt: Timestamp;
}
```

---

### Invoice

**Path:** `/invoices/{invoiceId}`

**Written by:** Cloud Functions only (generated at job completion / seal)

**Immutable after:** `status === 'issued'` — line items, amounts, tax are sealed

```typescript
interface Invoice {
  id: string;
  invoiceNumber: string;           // sequential; human-readable e.g. "INV-2026-0042"
  jobId: string;
  bookingId: string | null;
  customerId: string;
  vehicleId: string;

  // SNAPSHOT at issuance — immutable
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  subtotal: number;
  discount: number;
  tax: number;
  taxRate: number;                 // e.g. 0.05 for 5% VAT
  total: number;
  currency: string;

  status: 'draft' | 'issued' | 'paid' | 'void';
  issuedAt: Timestamp | null;
  pdfUrl: string | null;           // Firebase Storage URL

  // Public sharing
  publicToken: string;             // UUID; enables unauthenticated invoice view
  publicUrl: string;               // pre-computed share URL

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

### Warranty

**Path:** `/warranties/{warrantyId}`

**Written by:** Cloud Functions only (generated automatically at job completion)

**CRITICAL IMMUTABILITY RULE:** Once status is `active`, NO field may be updated except `certificateUrl` (set when PDF is generated). The service catalogue warranty template is a snapshot at generation time — future catalogue changes must not affect this record.

```typescript
interface Warranty {
  id: string;
  vehicleId: string;               // indexed
  customerId: string;
  jobId: string;                   // the job that generated this warranty
  serviceId: string;               // reference only; do not re-read for warranty terms

  // ALL FIELDS BELOW ARE SNAPSHOTS — IMMUTABLE AFTER CREATION
  serviceName: string;             // SNAPSHOT from service at job completion
  serviceCategory: string;         // SNAPSHOT
  brand: string | null;            // SNAPSHOT (e.g. "LLumar", "Kovalent")
  productName: string | null;      // SNAPSHOT (e.g. "Gloss PPF 180 Micron")
  productSeries: string | null;    // SNAPSHOT (e.g. "Platinum Series")
  coverageDescription: string;     // SNAPSHOT (exactly what is covered)
  warrantyType: 'ppf' | 'ceramic' | 'coating' | 'service' | 'other';

  // Dates
  startDate: string;               // ISO date; same as job completedAt date
  endDate: string | null;          // ISO date; null for lifetime warranty
  isLifetime: boolean;

  // Maintenance requirements (SNAPSHOT — obligations customer must meet)
  maintenanceRequirements: string | null;

  // Certificate
  issuedBy: string;                // employeeId of technician
  certificateUrl: string | null;   // set when PDF is generated (only mutable field)

  status: 'active' | 'expired' | 'void';

  createdAt: Timestamp;            // immutable
}
```

---

### Membership

**Path:** `/memberships/{membershipId}`

**Written by:** Cloud Functions only

**Immutable after activation:** startDate, endDate, includedWashes, discountPercent cannot change after `status === 'active'`. Upgrading creates a NEW membership document and cancels the previous one.

```typescript
interface Membership {
  id: string;
  customerId: string;              // indexed
  tier: 'silver' | 'gold' | 'platinum';
  status: 'pending_payment' | 'active' | 'expired' | 'cancelled';

  // Terms — immutable after activation
  startDate: string;               // ISO date
  endDate: string;                 // ISO date
  includedWashes: number;
  discountPercent: number;         // e.g. 10, 15, 20

  // Usage
  usedWashes: number;

  // Payment
  amountPaid: number;
  currency: string;
  stripeSubscriptionId: string | null;
  paymentReference: string | null; // for manual payment

  // Admin actions
  activatedAt: Timestamp | null;
  activatedBy: string | null;      // adminId or employeeId
  cancelledAt: Timestamp | null;
  cancelledBy: string | null;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**Subcollection:** `/memberships/{id}/usage/{usageId}`

```typescript
interface MembershipUsage {
  id: string;
  tenantId: string;                // REQUIRED — tenant isolation
  membershipId: string;
  customerId: string;
  usageType: 'wash' | 'discount';
  jobId: string;
  bookingId: string | null;
  valueRedeemed: number;           // INR value of discount or wash (in paise)
  usedAt: Timestamp;
}
```

---

### Protection

**Path:** `/vehicles/{vehicleId}/protections/{protectionId}`

Covers legal/financial protections distinct from service warranties.

**Written by:** Admin / Cloud Functions (after customer-submitted declaration is verified)

```typescript
interface Protection {
  id: string;
  vehicleId: string;
  customerId: string;
  kind: 'insurance' | 'fasttag' | 'puc' | 'rc' | 'extended_warranty' | 'other';
  provider: string | null;
  policyNumber: string | null;
  startDate: string | null;        // ISO date
  expiryDate: string | null;       // ISO date
  documentUrl: string | null;      // Storage signed URL
  status: 'unverified' | 'verified' | 'expired';
  verifiedBy: string | null;       // adminId
  verifiedAt: Timestamp | null;
  notes: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

### InventoryItem

**Path:** `/inventory/{itemId}`

**Written by:** Admin (create/configure) / Cloud Functions (stock adjustments from job consumption)

```typescript
interface InventoryItem {
  id: string;
  studioId: string;
  name: string;
  category: 'ppf_film' | 'ceramic' | 'wash_product' | 'interior' | 'equipment' | 'other';
  unit: 'ml' | 'litre' | 'ft' | 'metre' | 'pcs' | 'gm' | 'kg' | 'roll';
  stockQuantity: number;
  lowStockThreshold: number;
  costPerUnit: number;
  currency: string;
  supplierName: string | null;
  supplierContact: string | null;
  sku: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**Subcollection:** `/inventory/{itemId}/movements/{movementId}`

```typescript
interface InventoryMovement {
  id: string;
  itemId: string;
  type: 'addition' | 'consumption' | 'adjustment' | 'loss';
  quantityDelta: number;           // positive = stock gained; negative = stock reduced
  jobId: string | null;            // set for consumption records
  employeeId: string;
  reason: string | null;
  createdAt: Timestamp;
}
```

---

### Employee

**Path:** `/employees/{employeeId}`

**Written by:** Admin only

```typescript
interface Employee {
  id: string;
  studioId: string;
  name: string;
  phone: string;
  email: string | null;
  authUid: string | null;          // Firebase Auth UID (set if employee has own login)
  role: 'technician' | 'washer' | 'detailer' | 'advisor' | 'manager';
  active: boolean;
  pinHash: string | null;          // bcrypt hash; for shared-tablet PIN login
  salary: {
    type: 'monthly_base' | 'per_day_rate';
    amount: number;
    currency: string;
  };
  joinedAt: string;                // ISO date
  terminatedAt: string | null;     // ISO date; soft termination
  notes: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**Subcollections:**
- `/employees/{id}/attendance/{date}` — daily attendance records
- `/employees/{id}/payroll/{month}` — monthly payroll records (YYYY-MM key)

---

### AuditLog

**Path:** `/auditLog/{logId}`

**Written by:** Cloud Functions / Admin SDK only. No client may write or read this collection — admin web reads via Admin SDK in server routes.

**Append-only. No document may ever be deleted, modified, or overwritten.**

```typescript
interface AuditLog {
  id: string;                      // auto-generated
  timestamp: Timestamp;
  actorId: string;                 // customerId, employeeId, adminId, or 'system'
  actorRole: 'customer' | 'studio' | 'admin' | 'system';
  actorName: string;               // denormalized for readability
  action: string;                  // e.g. 'booking.create', 'job.status.update', 'payment.settle'
  entityType: string;              // e.g. 'booking', 'job', 'membership', 'payment'
  entityId: string;
  before: Record<string, unknown> | null;  // document state before change
  after: Record<string, unknown> | null;   // document state after change
  ip: string | null;
  userAgent: string | null;
  notes: string | null;
  source: 'customer_app' | 'studio_app' | 'admin_web' | 'cloud_function' | 'cron';
}
```

---

## 6.3 Ownership Matrix

| Entity | Customer Create | Customer Read | Customer Update | Studio Create | Studio Read | Studio Update | Admin | Mechanism |
|---|---|---|---|---|---|---|---|---|
| Customer | CF (on signup) | Own only | Own (limited fields) | — | Name/phone (for job display) | — | Full | CF + Admin SDK |
| Vehicle | CF | Own | Own (limited) | — | By registration | Notes only | Full | CF |
| Booking | CF | Own | CF (reschedule only) | — | Assigned jobs | — | Full | CF |
| ServiceJob | — | Linked (status, photos only) | — | CF | Full | CF (status advance) | Full | CF + Admin SDK |
| ApprovalRequest | — | Own (linked to job) | CF (respond only) | CF (create) | Full | — | Full | CF |
| Payment | — | Own (amount, status) | — | CF (manual settle) | Full | — | Full | CF |
| Invoice | — | Own | — | CF (generate) | Full | — | Full | CF |
| Warranty | — | Own | — | — | Full | — | Full | CF |
| Membership | CF (request) | Own | — | CF (activate) | Full | — | Full | CF |
| Protection | CF (declare) | Own | — | — | Full | CF (verify) | Full | CF |
| Service | — | Public | — | — | Read | — | Full | Direct (admin web → Admin SDK) |
| Studio | — | Name/hours/active only | — | — | Full | — | Full | Direct |
| Bay | — | Available types only | — | — | Full | — | Full | Direct |
| Employee | — | — | — | — | Own record | Own (limited) | Full | Direct |
| Inventory | — | — | — | CF (adjust) | Full | CF (adjust) | Full | CF |
| AuditLog | — | — | — | — | — | — | Read (server-side only) | Admin SDK |

**CF = Cloud Function** (never direct client SDK writes to these paths)

---

## 6.4 Historical Truth Rules

These rules are immutable design constraints. Any implementation that would violate them must be challenged.

### Rule 1: Price is Immutable After Booking Confirmation
The `priceBreakdown` and `totalAmount` fields in a `Booking` document are written at creation and must not be modified thereafter. If a price change is required (e.g., additional work discovered), an `ApprovalRequest` is created — customer approves the delta — and the delta is recorded on the `ServiceJob`, not on the original `Booking`.

### Rule 2: Invoice Line Items are Immutable After Issuance
Once `Invoice.status` becomes `issued`, all financial fields (`lineItems`, `subtotal`, `discount`, `tax`, `total`) are frozen. Issuing a correction requires voiding the invoice and creating a new one (new `invoiceNumber`, new document).

### Rule 3: Warranty Coverage is Immutable After Creation
`Warranty` documents are sealed at job completion. The `coverageDescription`, `brand`, `productName`, `startDate`, `endDate`, and all snapshot fields are immutable. Changes to the `Service` catalogue document after this point must not propagate to past warranty records. The only mutable field is `certificateUrl` (set when the PDF is generated asynchronously).

### Rule 4: Job Status History is Append-Only
`ServiceJob.statusHistory` is an embedded array. Individual entries in this array are never modified or deleted. New entries are only appended via Cloud Functions that call `arrayUnion`.

### Rule 5: AuditLog is Append-Only
The `/auditLog` collection is insert-only. No document may be updated, deleted, or overwritten. Admin SDK calls to this collection must use `addDoc` never `setDoc`. Firestore rules for this collection: no reads from client, no writes from client.

### Rule 6: Payments are Immutable After Settlement
Once `Payment.status === 'completed'`, the document is frozen. A refund creates a new `Payment` document with `method` referencing the original (Razorpay refund API sends a `refund.created` webhook; Cloud Function creates the refund record). Payment amounts and methods on settled records cannot be changed.

### Rule 7: Membership Terms are Immutable After Activation
Once `Membership.status === 'active'`, the fields `startDate`, `endDate`, `includedWashes`, and `discountPercent` cannot be changed. Tier upgrades or renewals create a new Membership document. The old document's status is set to `cancelled` with a reason of `upgraded`.

### Rule 8: Booking Address Snapshots Are Immutable
`Booking.pickupAddress` and `Booking.dropAddress` are copied from the customer's saved address at booking creation time. Subsequent edits to the saved address in `/customers/{id}/savedAddresses/` must not propagate to existing bookings.

### Rule 9: Service Names in Jobs are Snapshots
`ServiceJob.serviceItems[*].name`, `price`, and `durationMinutes` are copied from the service catalogue at job creation time. Subsequent admin edits to the service catalogue must not change these values in existing jobs.

---

## 6.5 Denormalization Strategy

Firestore has no server-side joins. The following fields are intentionally duplicated at write time to enable queries and display without sub-queries.

| Denormalized Field | Stored On | Source | Reason |
|---|---|---|---|
| `customerName`, `customerPhone` | `ServiceJob` | `Customer` | Studio board must show customer without fetching Customer document |
| `vehicleReg`, `vehicleMakeModel` | `ServiceJob` | `Vehicle` | Studio board must show vehicle without fetching Vehicle document |
| `serviceName`, `serviceCategory` | `Booking`, `ServiceJob` | `Service` | History display does not re-query catalogue; supports catalogue changes |
| `scopeName` | `Booking`, `ServiceJob` | `Service.scopes[]` | Scope may be renamed; history must show name at booking time |
| `bayName` | `ServiceJob` | `Bay` | Bay may be renamed; job history must show name at job time |
| `membershipTier` | `Booking` (if membership applied) | `Membership` | Display context without Membership query |
| `coverageDescription`, `brand`, `productName` | `Warranty` | `Service` (at job completion) | Warranty record is a sealed document |

**Denormalization is write-time only.** Updating the source (renaming a Bay, updating a Service) does not back-propagate to documents written before the change. This is intentional — historical records reflect the state at the time of the transaction.

---

## 6.6 Collection Group Queries

Firestore Collection Group queries allow querying across all subcollections with the same name. The following require explicit `collectionGroup` indexes in `firestore.indexes.json`:

| Collection Group | Index Fields | Use Case |
|---|---|---|
| `usage` (under memberships) | `customerId ASC, usedAt DESC` | Customer usage history across all their memberships |
| `movements` (under inventory) | `jobId ASC, createdAt DESC` | All inventory movements for a given job |
| `attendance` (under employees) | `date ASC, employeeId ASC` | Cross-employee attendance reports |
| `payroll` (under employees) | `month ASC, status ASC` | Monthly payroll processing across all employees |

**Note:** Top-level collections (`jobs`, `bookings`, `payments`, `warranties`) do not use collectionGroup — they are already top-level. Their primary query patterns:

| Collection | Key Query Patterns |
|---|---|
| `jobs` | by `customerId + status + createdAt`; by `studioId + status + updatedAt`; by `bayId + scheduledDate` |
| `bookings` | by `customerId + status`; by `studioId + scheduledDate + status`; by `bayId + scheduledDate` |
| `payments` | by `customerId + createdAt`; by `jobId`; by `status + settledAt` |
| `warranties` | by `vehicleId + status`; by `customerId + endDate` (for expiry reminders) |
| `memberships` | by `customerId + status`; by `status + endDate` (for expiry cron) |
| `inventory` | by `studioId + category`; by `studioId + stockQuantity` (for low-stock alerts) |
| `auditLog` | by `entityType + entityId + timestamp`; by `actorId + timestamp` |
