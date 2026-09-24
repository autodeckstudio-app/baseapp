import { onCall } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { extractRawAuth } from "../../middleware/auth.js";
import { enforceRateLimit } from "../../middleware/rateLimit.js";
import { resolveClaims as resolve } from "../../lib/roleResolver.js";

/**
 * Google sign-in step 2 for the mobile apps: sets this account's AutoDeck
 * role claims from its verified email and the staff roster. The client
 * sends nothing but its own auth; if `changed` is true it must call
 * getIdToken(true) to pick up the new claims.
 *
 * The admin web app does the same thing in /api/auth/resolve-claims so it
 * works before Functions are deployed (Blaze).
 */
export const resolveClaims = onCall({ region: "asia-south1" }, async (request) => {
  const raw = extractRawAuth(request);
  await enforceRateLimit({ uid: raw.uid, tenantId: null, role: null }, "auth.resolveClaims");
  const token = request.auth!.token as Record<string, unknown>;
  return resolve(getAuth(), getFirestore(), { ...token, uid: raw.uid });
});
