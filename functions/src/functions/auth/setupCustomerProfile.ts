import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import type { Customer } from "@autodeck/core";
import { FIRST_TENANT_ID } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractRawAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit } from "../../middleware/rateLimit.js";
import { setupCustomerProfileSchema } from "../../schemas/customer.js";
import { resolveClaims } from "../../lib/roleResolver.js";

/**
 * Creates or restores a customer profile after sign-in (Google, or phone OTP
 * in the emulator).
 *
 * Tenant association is determined server-side only (FIRST_TENANT_ID for V1).
 * Custom claims (role, tenantId) are set here — client cannot influence them.
 * After this call, the client MUST call auth.currentUser.getIdToken(true)
 * to force-refresh the ID token and receive the new claims.
 *
 * Idempotent: safe to call on every sign-in for existing customers.
 *
 * REAL SMS OTP: requires Firebase Blaze plan — REQUIRES APPROVAL.
 * Development uses Firebase Auth Emulator test phone numbers (FREE).
 */
export const setupCustomerProfile = onCall(
  { region: "asia-south1" },
  async (request) => {
    const rawAuth = extractRawAuth(request);
    const data = validate(setupCustomerProfileSchema, request.data);
    await enforceRateLimit({ uid: rawAuth.uid, tenantId: null, role: null }, "auth.setupProfile");

    const { uid, phone } = rawAuth;
    const tenantId = FIRST_TENANT_ID; // Server-determined — not client-settable

    const db = getFirestore();
    const adminAuth = getAuth();
    const customerRef = db.collection(COLLECTIONS.customers()).doc(uid);

    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(customerRef);

      if (snap.exists) {
        const existing = snap.data() as Customer;
        return { customer: existing, isNew: false };
      }

      // First sign-in — name required (Google supplies one)
      const tokenName = typeof request.auth?.token["name"] === "string" ? String(request.auth.token["name"]).trim() : "";
      const name = data.name ?? (tokenName.length >= 2 ? tokenName.slice(0, 100) : undefined);
      if (!name) {
        throw new HttpsError("invalid-argument", "Name is required for new customers.");
      }

      const now = new Date().toISOString();
      const customer: Customer = {
        id: uid,
        tenantId,
        authUid: uid,
        name,
        phone: phone ?? "",
        notificationPrefs: { push: true, quietMode: false },
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };

      tx.set(customerRef, customer);

      // Temporary AuthorizedUser for audit log (claims not set yet at this point)
      const tempUser = {
        uid,
        phone,
        email: rawAuth.email,
        claims: { role: "customer" as const, tenantId, studioId: null },
      };

      writeAuditLog(tx, {
        action: "customer.created",
        entityType: "Customer",
        entityId: uid,
        user: tempUser,
        studioId: null,
        after: { id: uid, tenantId, name, phone },
      });

      return { customer, isNew: true };
    });

    // Set claims after the transaction commits (cannot be inside it). Uses
    // the shared role resolver rather than a flat "customer" so a studio
    // owner or roster staff member who also books through the customer app
    // is never demoted by it.
    await resolveClaims(adminAuth, db, { ...(request.auth?.token as Record<string, unknown>), uid });

    // Phone-OTP sign-in never sets the Firebase Auth displayName on its own —
    // set it here on first setup so the client (Home greeting, Profile) has
    // something other than a blank name to show.
    if (result.isNew) {
      await adminAuth.updateUser(uid, { displayName: result.customer.name });
    }

    return {
      customer: result.customer,
      isNew: result.isNew,
      // Client must call getIdToken(true) to receive updated claims
      claimsUpdated: true,
    };
  },
);
