import { onCall } from "firebase-functions/v2/https";
import { shouldEnforceAppCheck } from "../lib/environment.js";
import { getFirestore } from "firebase-admin/firestore";

/**
 * Smoke test callable. Returns ok if the function and Firestore are
 * reachable. Despite the original comment here, this IS exported
 * unconditionally from index.ts and so IS a real production callable with
 * no auth check of any kind — App Check enforcement (Phase 5B P1-13) is the
 * only thing standing between this and an anonymous public write to
 * Firestore, so it is treated as enforced, not excluded.
 */
export const healthCheck = onCall(
  { region: "asia-south1", enforceAppCheck: shouldEnforceAppCheck() },
  async (_request) => {
    const db = getFirestore();
    await db.collection("_health").doc("ping").set({ ts: new Date().toISOString() });
    return { status: "ok", region: "asia-south1" };
  },
);
