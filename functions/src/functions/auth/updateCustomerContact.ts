import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { z } from "zod";
import type { Customer } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole, assertTenant } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";

const schema = z.object({
  customerId: z.string().min(1),
  name: z.string().trim().min(2).max(100).optional(),
  email: z.string().trim().toLowerCase().email().max(200).optional(),
  phone: z.string().trim().regex(/^\+?[0-9]{10,13}$/).optional(),
}).strict();

/**
 * Staff fix-up of a customer's contact details from the admin customer page.
 * Name and email can be corrected. A phone can only be ADDED when none is on
 * file: an existing phone is the customer's login identity and is never changed here.
 */
export const updateCustomerContact = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "studio", "admin", "superadmin");
  assertTenant(user, user.claims.tenantId);
  const data = validate(schema, request.data);
  if (data.name === undefined && data.email === undefined && data.phone === undefined) {
    throw new HttpsError("invalid-argument", "Nothing to update.");
  }
  await enforceRateLimit(subjectFrom(user), "customer.update");

  const db = getFirestore();
  const ref = db.collection(COLLECTIONS.customers()).doc(data.customerId);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "Customer not found.");
    const c = snap.data() as Customer;
    if (c.tenantId !== user.claims.tenantId) throw new HttpsError("permission-denied", "Cross-tenant access denied.");

    const patch: Partial<Customer> = {};
    if (data.name !== undefined && data.name !== c.name) patch.name = data.name;
    if (data.email !== undefined && data.email !== (c.email ?? "")) patch.email = data.email;
    if (data.phone !== undefined) {
      if (c.phone) throw new HttpsError("failed-precondition", "This customer already has a phone number. It is their login, so it cannot be changed here.");
      patch.phone = data.phone.startsWith("+") ? data.phone : `+91${data.phone.slice(-10)}`;
    }
    if (Object.keys(patch).length === 0) return { updated: false };

    const now = new Date().toISOString();
    tx.update(ref, { ...patch, updatedAt: now });
    writeAuditLog(tx, {
      action: "customer.profile_updated",
      entityType: "Customer",
      entityId: c.id,
      user,
      studioId: null,
      before: { name: c.name, email: c.email ?? null, phone: c.phone },
      after: patch as Record<string, unknown>,
    });
    return { updated: true };
  });
});
