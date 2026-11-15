// Google Routes (Compute Routes Essentials) road distance for pickup pricing. Server-only; the API key is
// restricted to routes.googleapis.com and never reaches a client.
//
// Owner-approved spend bounds (3 Nov 2026 WhatsApp proposal + "Okay go ahead"; this comment is only a pointer):
//   1. Vendor per-day project quota override on routes.googleapis.com/compute_routes_requests (100/day) -
//      the outer hard cap; when hit, Google fails requests for the rest of the (Pacific) day.
//   2. The server-side rolling kill-switch below: at most 3,000 call attempts in ANY trailing 31-day window.
//      Every calendar month (28-31 days) sits inside the trailing 31-day window ending on its last day, so no
//      billing month - under any billing-period anchor or timezone - can exceed 3,000 attempts x $5/1,000
//      (global Essentials list rate, no free-cap assumption) == the approved US$15 ceiling.
// Essentials-tier request shape ONLY: no waypoints, no traffic preference, distanceMeters field mask - adding
// TRAFFIC_AWARE or waypoints silently moves billing to the Pro SKU; keep this shape in review.
import { HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { getFirestore } from "firebase-admin/firestore";
import { COLLECTIONS } from "@autodeck/database";

/** Rolling kill-switch: at most this many routing call ATTEMPTS in any trailing ROUTING_WINDOW_DAYS window.
 *  3,000 x $5/1,000 == the approved US$15 ceiling at the global Essentials list rate. */
export const ROUTING_CALL_LIMIT = 3_000;
/** Window length in days. 31 covers the longest calendar month, so every billing month is bounded (above). */
export const ROUTING_WINDOW_DAYS = 31;
/** Single counter doc holding per-day buckets, pruned to the window and updated in one transaction. */
export const ROUTING_USAGE_DOC = "rolling";

const COMPUTE_ROUTES_URL = "https://routes.googleapis.com/directions/v2:computeRoutes";

/** Secure binding: the value lives in Google Secret Manager, bound at deploy (firebase functions:secrets:set),
 *  never in a committed env file. Locally/emulator the same name is read from process.env. */
export const GOOGLE_ROUTES_API_KEY: ReturnType<typeof defineSecret> = defineSecret("GOOGLE_ROUTES_API_KEY");

/** UTC day bucket key. Buckets are a storage detail only; the invariant is the trailing-window sum. */
export function utcDayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/** Atomically take one call slot for the current window BEFORE any vendor attempt - one slot per attempt,
 *  including retries, failures and timeouts (a failed call keeps its slot: conservative by design).
 *  Concurrency-safe (single transactional doc update). Throws unavailable at the limit: fail honest, never estimate. */
async function takeRoutingCallSlot(db: FirebaseFirestore.Firestore): Promise<void> {
  const ref = db.collection(COLLECTIONS.routingUsage()).doc(ROUTING_USAGE_DOC);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const days: Record<string, number> = { ...((snap.data() as { days?: Record<string, number> } | undefined)?.days ?? {}) };
    const cutoff = utcDayKey(new Date(Date.now() - (ROUTING_WINDOW_DAYS - 1) * 86_400_000));
    for (const k of Object.keys(days)) if (k < cutoff) delete days[k];
    const total = Object.values(days).reduce((a, b) => a + b, 0);
    if (total >= ROUTING_CALL_LIMIT) {
      throw new HttpsError("unavailable", "Road-distance checks are paused right now.");
    }
    const today = utcDayKey();
    days[today] = (days[today] ?? 0) + 1;
    tx.set(ref, { days, updatedAt: new Date().toISOString() });
  });
}

/**
 * Road distance in metres between two points, or a thrown HttpsError("unavailable") when it cannot be known
 * (network, vendor error, quota, bad payload). Callers must treat unavailable as "no quote", never as a
 * guessed distance: the owner-approved failure behaviour is a clear message and booking without pickup.
 */
export async function roadMetersBetween(
  origin: { lat: number; lng: number },
  dest: { lat: number; lng: number },
): Promise<number> {
  const key = GOOGLE_ROUTES_API_KEY.value() || "";
  if (!key) throw new HttpsError("unavailable", "Road-distance checking is not configured.");
  const db = getFirestore();
  await takeRoutingCallSlot(db);
  let res: Response;
  try {
    res = await fetch(COMPUTE_ROUTES_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "routes.distanceMeters",
      },
      // Hung vendor calls must not hold the callable; a timed-out attempt still consumed its reserved slot
      // (conservative by design - the kill-switch counts attempts, not just billed successes).
      signal: AbortSignal.timeout(8_000),
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
        destination: { location: { latLng: { latitude: dest.lat, longitude: dest.lng } } },
        travelMode: "DRIVE",
      }),
    });
  } catch {
    throw new HttpsError("unavailable", "Road distance could not be checked right now.");
  }
  if (!res.ok) throw new HttpsError("unavailable", "Road distance could not be checked right now.");
  const body = (await res.json().catch(() => null)) as { routes?: { distanceMeters?: number }[] } | null;
  const meters = body?.routes?.[0]?.distanceMeters;
  if (typeof meters !== "number" || !Number.isFinite(meters) || meters < 0) {
    throw new HttpsError("unavailable", "Road distance could not be checked right now.");
  }
  return meters;
}
