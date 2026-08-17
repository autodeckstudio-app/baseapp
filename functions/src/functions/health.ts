import { onCall } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";

/**
 * Emulator smoke test. Returns ok if the function and Firestore are reachable.
 * Not exposed in production.
 */
export const healthCheck = onCall(
  { region: "asia-south1" },
  async (_request) => {
    const db = getFirestore();
    await db.collection("_health").doc("ping").set({ ts: new Date().toISOString() });
    return { status: "ok", region: "asia-south1" };
  },
);
