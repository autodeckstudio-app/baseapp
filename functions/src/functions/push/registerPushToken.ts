import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser } from "../../middleware/auth.js";

// A signed-in user registers (or removes) this browser's push token. Stored in
// pushTokens/{uid}.tokens. Additive: nothing existing reads or writes this doc.
export const registerPushToken = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  const data = (request.data ?? {}) as { token?: unknown; remove?: unknown };
  if (typeof data.token !== "string" || data.token.length < 20 || data.token.length > 4096) {
    throw new HttpsError("invalid-argument", "Invalid token.");
  }
  const ref = getFirestore().collection("pushTokens").doc(user.uid);
  await ref.set(
    {
      tenantId: user.claims.tenantId,
      tokens: data.remove === true ? FieldValue.arrayRemove(data.token) : FieldValue.arrayUnion(data.token),
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );
  void COLLECTIONS;
  return { success: true };
});
