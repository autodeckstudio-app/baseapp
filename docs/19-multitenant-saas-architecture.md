# 19 — Multi-Tenant SaaS Architecture

**Concept:** AutoDeck is an automotive service operating system. legacy source app is the first tenant. Future studios/businesses can be added as tenants without rewriting the platform.

**Not in V1 UI** — tenant management UI is deferred. But the data model and security rules must enforce tenant isolation from day one. Adding tenant isolation later requires a painful data migration.

---

## 19.1 Tenant Model

```
Tenant                    (a business entity — e.g. "legacy source app Detailing")
└── Studio[]              (one or more physical locations)
    ├── Bay[]             (service bays per studio)
    ├── Employee[]        (staff at this studio)
    └── StudioConfig      (hours, holidays, capacity)

Customer                  (belongs to a Tenant — cross-tenant lookup not permitted)
└── Vehicle[]

Booking                   (belongs to Tenant + Studio)
└── ServiceJob
    ├── Payment[]
    ├── Invoice
    └── ApprovalRequest[]
```

legacy source app is Tenant `legacy-source`. Future tenants get their own `tenantId`.

---

## 19.2 Tenant Isolation Strategy: tenantId on Every Document

**Approach:** Single Firestore database, shared across tenants. Every document that is tenant-scoped carries a `tenantId` field. Firestore security rules enforce that users can only read/write documents where `resource.data.tenantId === request.auth.token.tenantId`.

**Why not separate Firestore databases per tenant?**
- Separate databases: complete isolation, but requires different Firebase projects per tenant (very high operational overhead at 10+ tenants)
- Shared database + tenantId: lower ops overhead, enforced by security rules + Cloud Functions, scales to hundreds of tenants without infrastructure changes
- Decision: shared database with tenantId. Revisit for enterprise tenants if data residency requirements demand isolation.

**Why not Firestore native multi-tenancy?**
Firebase Auth has a multi-tenancy feature (Firebase Auth Tenants), but it is complex and designed for B2B SaaS where each tenant has its own auth pool. AutoDeck's model has a single customer identity (a customer can theoretically book at multiple AutoDeck studios) — this makes shared-pool Auth cleaner.

**Trade-off acknowledged:** In a shared database, a Firestore bug in security rules could allow cross-tenant data access. Mitigation: thorough rules testing (required — 100% coverage), regular security audits, and Cloud Functions double-check tenantId before every write.

---

## 19.3 Domain Model with tenantId

### Tenant (/tenants/{tenantId})
```typescript
{
  id: string               // e.g. "autodeck"
  name: string             // "legacy source app Detailing"
  contactEmail: string
  contactPhone: string
  plan: 'starter' | 'growth' | 'enterprise'  // future billing tier
  active: boolean
  createdAt: Timestamp
}
```

**Access:** Read by admin + tenant's own admin-role users.

### Studio (/studios/{studioId})
```typescript
{
  id: string
  tenantId: string          // REQUIRED on all operational documents
  name: string
  address: string
  phone: string
  operatingHours: { [day: string]: { open: string; close: string } | null }
  holidays: string[]
  timezone: 'Asia/Kolkata'
  active: boolean
  createdAt: Timestamp
}
```

### All other entities carry `tenantId`

Every collection document carries `tenantId` (and `studioId` where relevant):

| Entity | tenantId | studioId |
|---|---|---|
| Customer | ✅ | ❌ (customers belong to tenant, not a specific studio) |
| Vehicle | ✅ | ❌ |
| Booking | ✅ | ✅ |
| ServiceJob | ✅ | ✅ |
| Payment | ✅ | ✅ |
| Invoice | ✅ | ✅ |
| Warranty | ✅ | ✅ |
| Service (catalogue) | ✅ | ❌ (catalogue is tenant-wide, not per studio) |
| Employee | ✅ | ✅ |
| Bay | ✅ | ✅ |
| InventoryItem | ✅ | ✅ |
| AuditLog | ✅ | ✅ |
| ApprovalRequest | ✅ | ✅ |
| MembershipUsage | ✅ | ❌ (subcollection of Membership; tenantId inherited from parent but also stored explicitly) |

---

## 19.4 Firebase Custom Claims with Tenant Context

Custom claim on each user token:
```json
{
  "role": "customer" | "studio" | "admin" | "superadmin",
  "tenantId": "autodeck",
  "studioId": "autodeck-ahmedabad"   // optional — only for studio-scoped staff
}
```

**Roles:**
- `superadmin`: AutoDeck platform admin. Can see all tenants. Never assigned to a tenant user.
- `admin`: Tenant admin. Full access within their tenantId. Cannot cross tenants.
- `studio`: Studio staff. Access scoped to their studioId within their tenantId.
- `customer`: Customer. Can access their own data within their tenantId.

**Setting claims:** Only Cloud Functions with Admin SDK can set custom claims. Never from client.

---

## 19.5 Firestore Security Rules Pattern

```javascript
// Core tenant isolation pattern — used in all collection rules
function isAuthenticated() {
  return request.auth != null;
}

function role() {
  return request.auth.token.role;
}

function tenantId() {
  return request.auth.token.tenantId;
}

function studioId() {
  return request.auth.token.studioId;
}

function isSuperAdmin() {
  return role() == 'superadmin';
}

function isAdminOf(doc) {
  return role() == 'admin' && tenantId() == doc.tenantId;
}

function isStudioOf(doc) {
  return role() == 'studio'
    && tenantId() == doc.tenantId
    && studioId() == doc.studioId;
}

function isOwnerCustomer(doc) {
  return role() == 'customer'
    && tenantId() == doc.tenantId
    && request.auth.uid == doc.customerId;
}

// Example: bookings
match /bookings/{bookingId} {
  allow read: if isAuthenticated() && (
    isSuperAdmin() ||
    isAdminOf(resource.data) ||
    isStudioOf(resource.data) ||
    isOwnerCustomer(resource.data)
  );
  allow write: if false;  // all writes via Cloud Functions only
}
```

**Key rule:** `tenantId()` on the request token must match `resource.data.tenantId`. No exceptions. No cross-tenant reads for non-superadmin roles.

---

## 19.6 Cloud Functions: Tenant Context

Every Cloud Function that handles a business mutation must:

1. Extract `tenantId` from the verified custom claim (never from the request body)
2. Scope all Firestore reads/writes to that `tenantId`
3. Write `tenantId` onto every document it creates
4. Validate that any referenced document (e.g., the booking being updated) belongs to the same `tenantId`

```typescript
// Pattern for all Cloud Function handlers
async function advanceJobStatus(req, res) {
  const { uid, role, tenantId, studioId } = verifyToken(req); // from middleware
  
  const job = await db.collection('jobs').doc(req.body.jobId).get();
  
  // ALWAYS verify tenantId before operating
  if (job.data().tenantId !== tenantId) {
    return res.status(403).json({ error: 'TENANT_MISMATCH' });
  }
  
  // proceed...
}
```

---

## 19.7 Service Catalogue: Tenant-Level

Each tenant has their own service catalogue. A future second tenant (e.g., another detailing studio) configures their own services independently.

- `/services/{serviceId}` — always carries `tenantId`
- A tenant's admin can add/edit/deactivate their own services
- Prices, warranties, durations are per-tenant (no platform-level catalogue in V1)
- In V3+: platform-level "template catalogue" that tenants can copy from

---

## 19.8 Customer Identity: Tenant-Scoped

Customers belong to a tenant. A customer who books at legacy source app is an legacy source app customer. If they ever book at a different AutoDeck tenant, they would be a separate customer record for that tenant.

**In V1:** Single tenant only. Customer identity is simple.

**In V2+:** If a customer's phone number exists across tenants (e.g., they booked at two different AutoDeck studios), they remain separate customer records per tenant. Cross-tenant customer identity merging is a V3+ feature requiring explicit customer consent.

**Firebase Auth:** Shared auth pool across all tenants (one phone number = one Firebase Auth UID). The Customer Firestore record links `uid` to `tenantId`. Multiple Customer records can share the same `uid` across tenants (each has their own `customerId` document per tenant).

---

## 19.9 Booking Engine: Multi-Tenant

The booking engine already receives `studioId` and `tenantId` as parameters. No changes needed to the algorithm — it naturally scopes to the correct studio. Bay availability, calendar, and capacity are all studioId-scoped.

---

## 19.10 Tenant Onboarding (V3)

When a new tenant is added to AutoDeck:

1. SuperAdmin creates Tenant document in `/tenants/{tenantId}`
2. SuperAdmin creates Studio document(s)
3. SuperAdmin creates first admin user → Cloud Function sets custom claim `{ role: 'admin', tenantId }`
4. Tenant admin logs in → sets up: service catalogue, bays, operating hours
5. Tenant admin onboards studio staff → each gets `{ role: 'studio', tenantId, studioId }`
6. System is ready for customers to register

This process is not automated in V1 (only one tenant). In V2+, a self-service onboarding portal can be built for future tenants.

---

## 19.11 Data Isolation Verification

Required before any new tenant is added:
- Firestore rules test: Tenant A user cannot read Tenant B documents
- Cloud Function test: tenantId mismatch returns 403
- Audit: no cross-tenant leakage in any query
- No `collectionGroup` queries without `tenantId` filter (collectionGroup ignores collection structure — must always filter by tenantId)

---

## 19.12 Cost Implications of Multi-Tenancy

Shared database model means:
- Firestore costs are shared across all tenants on one bill (billed to AutoDeck operator)
- In V1 (one tenant): effectively zero difference from a single-tenant model
- In V3+ (many tenants): AutoDeck can bill tenants via a SaaS subscription that covers infrastructure costs

**Cost classification:** Firestore — USAGE COST (pay-as-you-go on Blaze plan). At V1 dev/early-prod scale: effectively free.
