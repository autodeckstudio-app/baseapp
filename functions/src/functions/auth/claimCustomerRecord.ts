import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { Customer } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractRawAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit } from "../../middleware/rateLimit.js";
import { claimCustomerRecordSchema } from "../../schemas/customer.js";
import { verifiedCustomerEmail } from "../../lib/customer-identity.js";
import { normalizeClaimCode, hashClaimCode, CLAIM_MAX_ATTEMPTS } from "../../lib/claim-identity.js";
import { resolveClaims } from "../../lib/roleResolver.js";
import { getAuth } from "firebase-admin/auth";
import { shouldEnforceAppCheck } from "../../lib/environment.js";

/**
 * A walk-in customer claims the record the studio created for them, with the
 * one-time counter code plus their own Google-verified email.
 *
 * Candidate selection is by the caller's VERIFIED email, never by the code:
 * the active challenge for that email is found first, then the code is
 * checked against it. A wrong code burns one attempt on that challenge (there
 * is no global code lookup - a code typed by someone who does not own the
 * bound email confirms nothing and burns their own record's attempt budget).
 *
 * Two transactions, because a thrown transaction rolls back and attempt burns
 * must persist:
 *  1. RESERVE: atomically re-read the challenge and increment attempts while
 *     it is active, unexpired and under the cap (commit). Over-cap, expired
 *     or revoked here means the attempt never happened - flat refusal.
 *  2. CLAIM: re-read everything (challenge rev unchanged, still active, same
 *     email; staged doc exists, tenant, NOT deleted, still unclaimed, and its
 *     CURRENT email still matches - a counter email edit revokes codes, so a
 *     stale match cannot claim) and bind: customerUidBindings/{uid} via
 *     tx.create (a second concurrent claim for the uid, or a uid already
 *     bound anywhere, fails closed), authUid on the staged doc, challenge
 *     claimed. No other record is touched.
 *
 * Every failure reads the same to the caller, so responses never confirm
 * that a code or an email binding exists.
 */
export const claimCustomerRecord = onCall({ region: "asia-south1" , enforceAppCheck: shouldEnforceAppCheck() }, async (request) => {
  const rawAuth = extractRawAuth(request);
  const data = validate(claimCustomerRecordSchema, request.data);
  await enforceRateLimit({ uid: rawAuth.uid, tenantId: null, role: null }, "customer.claim");

  let ownedEmail: string | null;
  try { ownedEmail = verifiedCustomerEmail(request.auth?.token as Record<string, unknown>); }
  catch { throw new HttpsError("permission-denied", "Sign in with your verified email before claiming a record."); }
  if (!ownedEmail) throw new HttpsError("permission-denied", "Sign in with your verified email before claiming a record.");

  const bad = new HttpsError("failed-precondition", "That code did not work. Check it with the studio.");
  const review = new HttpsError("failed-precondition", "Your profile needs a studio review. No records were linked or changed.");
  const db = getFirestore();
  const normalized = normalizeClaimCode(data.code);
  if (normalized.length !== 8) throw bad;

  // Candidates are scoped to the caller's verified email, never a global
  // code lookup. Two different walk-in records can legitimately share a
  // contact email (family, counter typo fixed later), so the code picks the
  // one it matches; the hash comparison happens server-side and the caller
  // learns nothing from the outcome shape.
  const candidates = await db
    .collection("claimChallenges")
    .where("email", "==", ownedEmail)
    .where("status", "==", "active")
    .limit(6)
    .get();
  if (candidates.empty) throw bad;
  // More than 5 live candidates for one email is an anomaly the counter must
  // resolve: never pick a truncated subset (wrong burn target, cap evasion).
  if (candidates.docs.length > 5) throw review;
  const codeHash = hashClaimCode(normalized);
  const matched = candidates.docs.filter((d) => d.get("codeHash") === codeHash);
  // No match: burn the most recently issued candidate (the likely intended
  // one). Wrong-code attempts are bounded per challenge and never global.
  const target = matched.length === 1
    ? matched[0]!
    : [...candidates.docs].sort((a, b) => String(b.get("createdAt")).localeCompare(String(a.get("createdAt"))))[0]!;
  const challengeRef = target.ref;
  const now = new Date();

  // TX 1 - reserve one attempt (persists even though the claim may fail).
  const reserved = await db.runTransaction(async (tx) => {
    const snap = await tx.get(challengeRef);
    const ch = snap.data() as { status: string; attempts: number; expiresAt: string; rev: number } | undefined;
    if (!snap.exists || !ch || ch.status !== "active") return null;
    if (Date.parse(ch.expiresAt) <= now.getTime() || ch.attempts >= CLAIM_MAX_ATTEMPTS) return null;
    tx.update(challengeRef, { attempts: ch.attempts + 1, lastAttemptAt: now.toISOString() });
    return { rev: ch.rev ?? 1 };
  });
  if (reserved === null) throw bad;

  // Code check against the RESERVED challenge (after the burn, before the claim).
  if (matched.length !== 1) throw bad;
  const afterReserve = (await challengeRef.get()).data() as { codeHash: string; email: string };
  if (afterReserve.codeHash !== codeHash) throw bad; // reissued under us
  if (afterReserve.email !== ownedEmail) throw review; // changed under us: anomaly, fail closed

  // TX 2 - claim.
  const result = await db.runTransaction(async (tx) => {
    const chSnap = await tx.get(challengeRef);
    const ch = chSnap.data() as {
      tenantId: string; customerDocId: string; email: string; status: string;
      expiresAt: string; rev: number;
    } | undefined;
    if (!chSnap.exists || !ch || ch.status !== "active") throw bad; // reissued/revoked between phases
    if ((ch.rev ?? 1) !== reserved.rev) throw bad;
    if (Date.parse(ch.expiresAt) <= now.getTime()) throw bad;
    if (ch.email !== ownedEmail) throw review;

    const customerRef = db.collection(COLLECTIONS.customers()).doc(ch.customerDocId);
    const custSnap = await tx.get(customerRef);
    if (!custSnap.exists) throw bad;
    const customer = custSnap.data() as Customer;
    if (customer.tenantId !== ch.tenantId || customer.deletedAt || customer.authUid) throw review;
    // The record's CURRENT email must still match; a counter email edit
    // revokes outstanding codes, so reaching here with a mismatch is an anomaly.
    if ((customer.email ?? "").trim().toLowerCase() !== ownedEmail) throw review;

    const bindingRef = db.collection("customerUidBindings").doc(rawAuth.uid);
    if ((await tx.get(bindingRef)).exists) throw review;
    if ((await tx.get(db.collection(COLLECTIONS.customers()).doc(rawAuth.uid))).exists) throw review;

    const nowIso = now.toISOString();
    tx.create(bindingRef, { tenantId: ch.tenantId, customerDocId: ch.customerDocId, createdAt: nowIso });
    tx.update(customerRef, { authUid: rawAuth.uid, email: ownedEmail, claimedAt: nowIso, updatedAt: nowIso });
    tx.update(challengeRef, { status: "claimed", claimedBy: rawAuth.uid, claimedAt: nowIso, rev: (ch.rev ?? 1) + 1 });
    writeAuditLog(tx, {
      action: "customer.claimed",
      entityType: "Customer",
      entityId: ch.customerDocId,
      user: { uid: rawAuth.uid, phone: null, email: ownedEmail, claims: { role: "customer" as const, tenantId: ch.tenantId, studioId: null } },
      studioId: null,
      after: { claimed: true },
    });
    return { customerId: ch.customerDocId };
  });

  // Claims after commit, mirroring setupCustomerProfile (never demotes staff).
  await resolveClaims(getAuth(), db, { ...(request.auth?.token as Record<string, unknown>), uid: rawAuth.uid });
  return result;
});
