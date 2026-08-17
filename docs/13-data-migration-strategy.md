# 13 — Data Migration Strategy

**Status:** Future planning. Migration is not a day-one requirement.  
**Principle:** AutoModz and AutoDeck are separate products on separate Firebase projects. There is no live migration during development.

---

## 13.1 Migration Philosophy

AutoModz will continue to operate as a separate product throughout AutoDeck's development. The two products share nothing — separate Firebase projects, separate codebases, separate domains, separate App Store/Play Store listings (when AutoDeck ships).

Migration from AutoModz to AutoDeck is a future event that occurs when:
1. AutoDeck reaches production readiness (all Phase 1-2 features shipped)
2. A business decision is made to transition existing customers
3. AutoModz is planned for sunset or continued as a separate PWA product

**Migration is not a blocker for AutoDeck development.** AutoDeck can launch to new customers without migrating AutoModz data.

---

## 13.2 What Can Be Migrated

### High Value — Migrate

| Data | Source Collection | Target Collection | Notes |
|---|---|---|---|
| Customers | `users` | `customers` | Structure changes (see transform) |
| Vehicles | `users/{uid}/vehicles` | `vehicles` | Promoted to top-level collection |
| Service history | `users/{uid}/vehicles/{id}/serviceHistory` | Read into `jobs` | Historical records only |
| Active memberships | `subscriptions` | `memberships` | Tier names may change |
| Protections | `protections` | `vehicles/{id}/protections` | Kind mapping changes |
| Warranties | Embedded in `protections` | `warranties` | New top-level entity |
| Employees | `employees` | `employees` | Role mapping required |

### Migrate With Transformation

| Data | Transformation Required |
|---|---|
| Completed jobs (`jobs`) | Status enum mapping; add required fields with defaults; fix customer linkage (plate string → customerId) |
| Bookings (`bookings`) | Status mapping; snapshot priceBreakdown if not present |
| Invoices (`invoices`) | Preserve for historical access; new format in AutoDeck |
| Attendance/payroll | Carry current month only; historical data stays in AutoModz |

### Do Not Migrate

| Data | Reason |
|---|---|
| Firebase Auth UIDs | Cannot be migrated between Firebase projects. Re-auth on AutoDeck. |
| Stripe payment data | AutoModz has no Stripe; AutoDeck starts fresh |
| walkinCustomers | Merge into unified `customers` collection |
| FCM device tokens | Ephemeral; re-registered on first AutoDeck app launch |
| Sessions and notifications | Ephemeral |
| car marketplace listings | Only if AutoDeck includes car marketplace (currently deferred) |
| referrals | Removed from AutoModz; not in AutoDeck Phase 1 |
| Activity logs | AutoModz activity stays in AutoModz for reference |

---

## 13.3 Schema Transformation Map

### Customer (users → customers)

| AutoModz field | AutoDeck field | Notes |
|---|---|---|
| `uid` | `uid` (Firebase UID) | Different UID in new project; store old as `legacyAutoModzUid` |
| `name` | `name` | Direct copy |
| `email` | `email` | Direct copy |
| `phone` | `phone` | Direct copy |
| `role` | Derived from custom claim | Only 'customer' role migrated; employees separate |
| `upiVpa` | `upiVpa` | Copy if useful |
| `notificationPrefs` | `notificationPrefs` | Re-map structure |
| `quietMode` | `notificationPrefs.quietMode` | Nested |
| `notes` | `notes` | Admin-only field |
| `tags[]` | `tags[]` | Direct copy |
| `welcomedAt` | `createdAt` | Rename |
| — | `preferredLanguage` | Default 'en' |
| — | `legacyAutoModzUid` | Source UID for cross-reference |

### Vehicle (subcollection → top-level)

| AutoModz field | AutoDeck field | Notes |
|---|---|---|
| `id` | `id` | Keep same ID |
| (subcollection path owner uid) | `customerId` | Resolved at migration time |
| `name` | Derived: `{make} {model}` | AutoModz stored combined name string |
| `registrationNumber` | `registrationNumber` | Direct copy; index |
| `photo` | `primaryPhotoUrl` | Rename |
| `photos[]` | `photos[]` | Direct copy |
| `category` | `category` | Map to AutoDeck enum |
| `color` | `color` | Direct copy |
| `year` | `year` | Direct copy |
| `odometer` | `odometer` | Direct copy |
| — | `make` | Extract from name string |
| — | `model` | Extract from name string |
| — | `vin` | null (not in AutoModz) |

### Membership (subscriptions → memberships)

| AutoModz tier | AutoDeck tier | Washes | Discount |
|---|---|---|---|
| silver | silver | 4 (verify against actual record) | 10% |
| gold | gold | 8 (verify — known washesTotal bug) | 15% |
| platinum | platinum | 16 | 20% |

**Critical:** Verify `washesUsed` accuracy before migration. AutoModz has a known `washesTotal` vs `washesIncluded` disagreement. Recalculate from job history before setting migrated `usedWashes`.

### Protection kinds mapping

| AutoModz kind | AutoDeck kind |
|---|---|
| ppf | → warranty (type: ppf) |
| ceramic | → warranty (type: ceramic) |
| glass | → warranty (type: coating) |
| insurance | → vehicles/{id}/protections (kind: insurance) |
| fasttag | → vehicles/{id}/protections (kind: fasttag) |
| puc | → vehicles/{id}/protections (kind: puc) |
| rc | → vehicles/{id}/protections (kind: rc) |
| membership | → migrated separately as membership record |
| warranty | → warranties collection |

### Job status mapping

| AutoModz status | AutoDeck status |
|---|---|
| (no equivalent — walks in) | vehicle_received |
| in_progress | in_progress |
| quality_check | quality_check |
| ready_for_delivery | ready_for_delivery |
| completed | delivered |
| void | void |

---

## 13.4 Migration Execution Plan

### Phase M1: Export (Read-Only — AutoModz)

```bash
# Export script — runs against AutoModz Firebase project
# Uses Firebase Admin SDK with service account read access
# Output: NDJSON files, one per collection

node export.ts --project=automodz-prod --output=./migration/export/
```

Exports in order (respecting relationships):
1. `users` → `customers.ndjson`
2. `users/{uid}/vehicles` → `vehicles.ndjson` (flattened with customerId resolved)
3. `users/{uid}/vehicles/{id}/serviceHistory` → `service_history.ndjson`
4. `subscriptions` → `memberships.ndjson`
5. `protections` → `protections_raw.ndjson`
6. `jobs` (completed only) → `jobs.ndjson`
7. `employees` → `employees.ndjson`
8. Firebase Storage: copy all vehicle and job photos to AutoDeck Storage bucket

**Validation after export:**
- Record counts match Firestore console counts
- Required fields present on all records
- No orphaned vehicles (every vehicle has a valid customerId)
- All referenced photos exist in Storage

### Phase M2: Transform (Local)

Transform script maps AutoModz schema to AutoDeck schema:
```bash
node transform.ts --input=./migration/export/ --output=./migration/transformed/
```

**Key transformations:**
1. Customers: add `legacyAutoModzUid`, restructure `notificationPrefs`, set `preferredLanguage: 'en'`
2. Vehicles: promote to top-level, extract make/model, set `customerId` by ID
3. Jobs: map status enum, add `studioId` field, fix customer linkage (plate → customerId where possible)
4. Memberships: verify wash counts (recalculate from job history), map tier names
5. Protections/warranties: split into `warranties` and `protections` per new schema
6. Employees: map role names, set `studioId`

**All transformed records tagged:** `{ migratedFromAutoModz: true, migratedAt: <ISO date> }`

### Phase M3: Validate (Staging)

Run import against autodeck-staging:
```bash
node import.ts --project=autodeck-staging --input=./migration/transformed/
```

Validation checks:
- Every customer can be found by phone number (for re-auth matching)
- Every vehicle has a valid `customerId`
- Active memberships have correct wash counts
- All protections/warranties have valid `vehicleId`
- All photos load via signed URL

Fix any issues in transform script. Re-run on staging until clean.

### Phase M4: Production Import

Coordinate with business:
1. **Maintenance window:** notify customers 48h in advance; AutoModz takes no new bookings during window
2. Run import against autodeck-prod
3. Validate in production
4. Open AutoDeck to existing customers

### Phase M5: Customer Re-Authentication

AutoDeck uses phone OTP. Existing customers cannot use their old Google Sign-In UID.

**First AutoDeck login flow:**
1. Customer enters their India phone number (+91) in AutoDeck app
2. Firebase Auth sends OTP
3. On successful OTP verification: Cloud Function checks if phone matches a migrated customer record
4. If match: link new Firebase UID to the existing `customers/{id}` document
5. Customer immediately sees their vehicle history, membership, warranties

No data loss — all records are keyed by phone number match, not Firebase UID.

**Edge case: customer registered in AutoModz with a Google account that has no matching phone:**
- Small percentage of customers
- Support process: customer contacts studio → admin manually links account
- Estimated: < 5% of customers (most AutoModz customers registered via Google which may not expose phone number)

---

## 13.5 Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Membership wash count wrong after migration | Medium | High | Recalculate from completed job history in transform step; verify on staging |
| Customer can't find history (phone mismatch) | Low | Medium | Support process for manual linking; admin can link in admin web |
| Photos inaccessible (Storage bucket different) | Low | High | Copy all Storage objects to AutoDeck bucket before migration; verify links |
| AutoModz takes a booking during migration window | Medium | High | Coordinate maintenance window; disable booking creation in AutoModz during migration |
| Active warranty lost or corrupted | Low | Critical | Triple-check every warranty record; generate list pre-migration; verify post-migration |
| Job-customer linkage broken (plate string join) | Medium | Medium | Best-effort match by plate; unmatched jobs stored as orphan with plate reference |
| Firebase Admin SDK quota exceeded during import | Low | Medium | Batch imports in groups of 500; use exponential backoff |
| Migration takes longer than maintenance window | Low | High | Dry-run with timing on staging; extend window if needed |

---

## 13.6 No-Migration Alternative

For a customer base of under 200 active customers, manual data re-entry may be lower risk than a migration script:

**Manual approach:**
1. Export customer list to CSV (admin prints this)
2. Admin manually activates memberships for migrating customers in AutoDeck admin web
3. Admin manually adds vehicle records for frequent customers
4. Staff manually inputs active warranties (PPF, ceramic) for existing cars in service
5. Historical booking data stays in AutoModz (which continues running as archive)
6. New bookings go to AutoDeck only

**Advantages:**
- No migration script to build or test
- Clean start for AutoDeck data
- No schema transformation risk
- AutoModz continues as a read-only archive

**Disadvantages:**
- Customer does not see their history in AutoDeck app immediately
- Manual labour cost for staff
- Opportunity for data entry errors

**Recommendation:** Evaluate customer base size at migration time. If under 200 active customers, manual re-entry of memberships and warranties (the high-value records) is simpler. For 200+ customers, build the migration script.

---

## 13.7 AutoModz Sunset

AutoModz sunset is a business decision, not a technical one. The options:

**Option A: Full sunset**
- AutoModz takes no new bookings after migration date
- Existing customers redirected to AutoDeck
- AutoModz domain redirects to AutoDeck marketing site
- AutoModz codebase archived

**Option B: Parallel operation**
- AutoModz continues as the PWA product (potentially sold/licensed separately)
- AutoDeck is the new native product
- No migration required — they serve different customer segments

**Option C: AutoModz as the web/PWA companion**
- AutoDeck is the native app
- AutoModz is rebranded as autodeck.ae web interface (same Firebase project — this would require significant rearchitecting)

**Recommendation:** Option A (full sunset to AutoDeck) for operational simplicity. Option B if the AutoModz PWA has separate commercial value. Decide this before investing in migration script work.
