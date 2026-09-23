# 23 - AutoDeck Brand and Tenant Migration

**Decision:** AutoDeck is the only active brand. The retired application's name, marks and identifiers must not appear in product copy, configuration, seeded data, package names or new records.

## Code change

`FIRST_TENANT_ID` changes to `autodeck`. New customer profiles, seeded catalogue records and test fixtures use this identifier.

## Deployment warning

A tenant identifier is a data key, not only display copy. If any deployed Firebase project already contains records under the retired tenant identifier, deploy this code only after migrating those records and claims. Changing the constant without migrating data would make existing users and documents appear to belong to another tenant.

Before deployment, for each environment:

1. Export Firestore and take a rollback snapshot.
2. Count every document whose `tenantId` uses the retired value, including customers, vehicles, bookings, jobs, payments, invoices, memberships, services, staff, studios, audit logs and counters.
3. Copy or transactionally rewrite those records to `tenantId: "autodeck"`. Rename tenant-keyed document IDs and collection paths where the tenant value is part of the key.
4. Update Firebase Auth custom claims for customer, studio, admin and superadmin accounts.
5. Update studio records and any configured studio claim to `autodeck-ahmedabad` only where the retired brand was embedded in that identifier. The current code default `studio-ahmedabad` needs no change.
6. Rebuild indexes or counters whose document ID contains the tenant identifier.
7. Run role/tenant isolation tests and the full booking-to-payment journey in staging.
8. Deploy functions, rules and clients together. Keep the snapshot until production verification passes.

Do not retain the retired value as a user-visible alias. If temporary migration lookup is required, keep it inside a one-time, access-controlled migration script and delete it after verification.

## Brand acceptance check

The repository check is case-insensitive and covers content plus paths:

```bash
rg -n -i 'retired-brand-pattern' . --hidden \
  --glob '!.git/**' --glob '!node_modules/**' --glob '!.next/**' \
  --glob '!functions/lib/**'
```

Replace `retired-brand-pattern` with the retired name when running the private migration check. A release passes only when the result is empty. Historical commit messages are outside the shipped tree and are not rewritten.
