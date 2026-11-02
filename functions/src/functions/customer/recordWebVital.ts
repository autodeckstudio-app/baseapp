import { onCall } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { recordWebVitalSchema } from "../../schemas/telemetry.js";
import { shouldEnforceAppCheck } from "../../lib/environment.js";

/**
 * First-party real-user monitoring: the web apps report Core Web Vitals
 * (CLS/FCP/INP/LCP/TTFB) here instead of to a third-party analytics service.
 * No new external provider, no paid service; data stays in our own Firestore
 * (webVitals collection, default-deny rules - written here, read by no client).
 * Authenticated + App Check-wired + rate limited. Telemetry is best-effort:
 * the client drops failures silently and never lets reporting break the app.
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
      name: data.name,
      value: data.value,
      rating: data.rating,
      navigationType: data.navigationType ?? null,
      userAgent: (typeof ua === "string" ? ua : "").slice(0, 200),
      recordedAt: new Date().toISOString(),
    });
    return { ok: true };
  },
);
