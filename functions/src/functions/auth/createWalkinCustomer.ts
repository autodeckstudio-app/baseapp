import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { z } from "zod";
import type { Customer } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole, assertTenant } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";

const schema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email().max(200),
  phone: z.string().trim().regex(/^\+?[0-9]{10,13}$/).optional(),
}).strict();

/**
 * Studio walk-in: register a new customer by email, or return the existing one.
 * The customer's login is created now (email marked verified) so that when they
 * later sign in with Google using this address, Google links to this same login
 * and they land on this record. No duplicate record, nothing is sent to them.
 * New function, additive.
 */
export const createWalkinCustomer = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "studio", "admin", "superadmin");
  assertTenant(user, user.claims.tenantId);
  const data = validate(schema, request.data);
  await enforceRateLimit(subjectFrom(user), "customer.walkin");

  const db = getFirestore();
  const adminAuth = getAuth();
  const tenantId = user.claims.tenantId;

  let uid: string;
  let existed = true;
  try {
    uid = (await adminAuth.getUserByEmail(data.email)).uid;
  } catch (e) {
    if ((e as { code?: string }).code !== "auth/user-not-found") throw new HttpsError("internal", "Could not check this email.");
    existed = false;
    uid = (await adminAuth.createUser({ email: data.email, emailVerified: true, displayName: data.name })).uid;
  }

  const ref = db.collection(COLLECTIONS.customers()).doc(uid);
  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists) {
      const c = snap.data() as Customer;
      if (c.tenantId !== tenantId) throw new HttpsError("permission-denied", "That email belongs to another business.");
      if (!c.email) tx.update(ref, { email: data.email });
      return { customer: { ...c, email: c.email ?? data.email }, created: false };
    }
    const now = new Date().toISOString();
    const customer: Customer = {
      id: uid,
      tenantId,
      authUid: uid,
      name: data.name,
      phone: data.phone ? (data.phone.startsWith("+") ? data.phone : `+91${data.phone.slice(-10)}`) : "",
      email: data.email,
      notificationPrefs: { push: true, quietMode: false },
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    tx.set(ref, customer);
    writeAuditLog(tx, { action: "customer.created", entityType: "Customer", entityId: uid, user, studioId: null, after: { id: uid, tenantId, name: data.name, via: "walkin" } });
    return { customer, created: true };
  });
  return { customer: result.customer, created: result.created, loginExisted: existed };
});
