import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { Customer } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole, assertTenant } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { issueClaimCodeSchema } from "../../schemas/customer.js";
import { generateClaimCode, normalizeClaimCode, hashClaimCode, CLAIM_CODE_TTL_MS, CLAIM_MAX_ISSUES } from "../../lib/claim-identity.js";
import { shouldEnforceAppCheck } from "../../lib/environment.js";

/**
 * Staff issues a one-time claim code for an UNCLAIMED walk-in customer record
 * at the counter. The email the code is bound to is confirmed in person - it
 * is contact data the customer stated, never proof of ownership; the claim
 * itself later requires a Google-verified matching email.
 *
 * The plain code is returned exactly once, for the staff screen/receipt. Only
 * its hash is stored. Reissuing revokes every earlier code for the record and
 * is capped (CLAIM_MAX_ISSUES total); beyond that the record needs a manager
 * review, not more codes. Codes are never logged or written to audit.
 */
export const issueClaimCode = onCall({ region: "asia-south1" , enforceAppCheck: shouldEnforceAppCheck() }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "studio", "admin", "superadmin");
  const data = validate(issueClaimCodeSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "customer.claimIssue");

  const db = getFirestore();
  const customerRef = db.collection(COLLECTIONS.customers()).doc(data.customerId);

  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(customerRef);
    if (!snap.exists) throw new HttpsError("not-found", "Customer not found.");
    const customer = snap.data() as Customer;
    assertTenant(user, customer.tenantId);
    if (customer.deletedAt) throw new HttpsError("failed-precondition", "This record is deleted. A manager must review it first.");
    if (customer.authUid) {
      // Already claimed: never leak which account holds it, and never issue a
      // second path in. The customer signs in with their own Google account.
      throw new HttpsError("failed-precondition", "This customer already has their own sign-in. Ask them to sign in with it.");
    }
    const email = (customer.email ?? "").trim().toLowerCase();
    if (!email) throw new HttpsError("failed-precondition", "Confirm the customer's email at the counter and save it on the record first.");

    const prior = await tx.get(
      db.collection("claimChallenges").where("customerDocId", "==", data.customerId).where("tenantId", "==", customer.tenantId),
    );
    if (prior.docs.length >= CLAIM_MAX_ISSUES) {
      throw new HttpsError("failed-precondition", "Too many codes were issued for this record. A manager must review it before a new code.");
    }
    for (const doc of prior.docs) {
      if (doc.get("status") === "active") tx.update(doc.ref, { status: "revoked", revokedAt: new Date().toISOString(), revokedBy: user.uid, rev: (doc.get("rev") ?? 1) + 1 });
    }

    const code = generateClaimCode();
    const ref = db.collection("claimChallenges").doc();
    const now = new Date();
    tx.create(ref, {
      id: ref.id,
      tenantId: customer.tenantId,
      customerDocId: data.customerId,
      codeHash: hashClaimCode(normalizeClaimCode(code)),
      email,
      status: "active",
      attempts: 0,
      rev: 1,
      issueNumber: prior.docs.length + 1,
      createdBy: user.uid,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + CLAIM_CODE_TTL_MS).toISOString(),
      claimedBy: null,
      claimedAt: null,
    });
    writeAuditLog(tx, {
      action: "customer.claim_code_issued",
      entityType: "Customer",
      entityId: data.customerId,
      user,
      studioId: user.claims.studioId,
      after: { issueNumber: prior.docs.length + 1, expiresAt: new Date(now.getTime() + CLAIM_CODE_TTL_MS).toISOString() },
    });
    return { code, expiresAt: new Date(now.getTime() + CLAIM_CODE_TTL_MS).toISOString() };
  });

  return result;
});
