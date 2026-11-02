import { onCall } from "firebase-functions/v2/https";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { recordWebVitalSchema } from "../../schemas/telemetry.js";
import { shouldEnforceAppCheck } from "../../lib/environment.js";

// Retention: every beacon carries expireAt (recordedAt + 90 days) so a Firestore
// TTL policy on the expireAt field (one-time, free, first-party - configured at
// deploy time, NOT part of this code) deletes old beacons automatically.
const TTL_DAYS = 90;

/**
 * First-party real-user monitoring: the web apps report Core Web Vitals here,
 * one coalesced beacon per page view, instead of to a third-party analytics
 * service. No new external provider, no paid service; data stays in our own
 * Firestore (webVitals collection, default-deny rules - written here, read by
 * no client). Authenticated + rate limited; App Check wiring follows the same
 * staged rollout as sibling callables (inert until enforcement is enabled).
 * Telemetry is best-effort: the client drops failures silently and never lets
 * reporting break the app.
 */
export const recordWebVital = onCall(
  { region: "asia-south1", enforceAppCheck: shouldEnforceAppCheck() },
  async (request) => {
    const user = extractUser(request);
    const data = validate(recordWebVitalSchema, request.data);
    await enforceRateLimit(subjectFrom(user), "telemetry.webVital");
    const db = getFirestore();
    const ua = request.rawRequest?.headers?.["user-agent"];
    await db.collection(COLLECTIONS.webVitals()).add({
      tenantId: user.claims.tenantId,
      uid: user.uid,
      app: data.app,
      page: data.page,
      navigationType: data.navigationType ?? null,
      metrics: data.metrics,
      userAgent: (typeof ua === "string" ? ua : "").slice(0, 200),
      recordedAt: new Date().toISOString(),
      expireAt: Timestamp.fromMillis(Date.now() + TTL_DAYS * 24 * 60 * 60 * 1000),
    });
    return { ok: true };
  },
);
