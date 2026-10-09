import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { z } from "zod";
import type { Booking } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractCustomerUser, extractUser, assertRole, assertTenant } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { studioLocalToIso } from "../../lib/studio-time.js";

// Customer preference only - never a promised slot. The studio agrees the
// actual time with the customer by phone call and enters it on approval
// (agreedPickupAt / agreedDropAt), which is stored separately so the
// original request is never overwritten. Legacy requests may carry only the
// free-text preferredTime; all fields stay optional so those keep working.
const requestSchema = z.object({
  bookingId: z.string().min(1),
  kind: z.enum(["pickup", "drop", "both"]),
  address: z.string().trim().min(8).max(300),
  preferredTime: z.string().trim().max(100).optional(),
  requestedPickupTime: z.string().trim().max(100).optional(),
  requestedDropTime: z.string().trim().max(100).optional(),
  note: z.string().trim().max(300).optional(),
}).strict();

const updateSchema = z.object({
  requestId: z.string().min(1),
  status: z.enum(["REQUESTED", "CONFIRMED", "DONE", "DECLINED"]),
  staffNote: z.string().trim().max(300).optional(),
  agreedPickupAt: z.string().trim().max(60).optional(),
  agreedDropAt: z.string().trim().max(60).optional(),
}).strict();

interface PickupRequestDoc {
  tenantId: string;
  studioId: string;
  kind: "pickup" | "drop" | "both";
  status: "REQUESTED" | "CONFIRMED" | "DONE" | "DECLINED";
  staffNote: string;
  agreedPickupAt: string | null;
  agreedDropAt: string | null;
}


async function studioTimezone(db: FirebaseFirestore.Firestore, studioId: string): Promise<string> {
  const snap = await db.collection(COLLECTIONS.studioConfig()).doc(studioId).get();
  const tz = (snap.data() as { timezone?: string } | undefined)?.timezone;
  return tz || "Asia/Kolkata";
}

/** Customer asks the studio to collect and/or return the car. A request only: the studio confirms or declines. New, additive. */
export const requestPickupDrop = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractCustomerUser(request);
  assertRole(user, "customer");
  assertTenant(user, user.claims.tenantId);
  const data = validate(requestSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "pickup.request");
  const db = getFirestore();
  const bookingSnap = await db.collection(COLLECTIONS.bookings()).doc(data.bookingId).get();
  if (!bookingSnap.exists) throw new HttpsError("not-found", "Booking not found.");
  const booking = bookingSnap.data() as Booking;
  assertTenant(user, booking.tenantId);
  if (booking.customerId !== user.uid) throw new HttpsError("permission-denied", "That is not your booking.");
  const ref = db.collection(COLLECTIONS.pickupRequests()).doc(`${data.bookingId}`);
  const now = new Date().toISOString();
  const doc = {
    id: ref.id,
    tenantId: booking.tenantId,
    studioId: booking.studioId,
    bookingId: data.bookingId,
    customerId: user.uid,
    kind: data.kind,
    address: data.address,
    preferredTime: data.preferredTime ?? "",
    requestedPickupTime: data.requestedPickupTime ?? "",
    requestedDropTime: data.requestedDropTime ?? "",
    note: data.note ?? "",
    status: "REQUESTED" as const,
    staffNote: "",
    agreedPickupAt: null,
    agreedDropAt: null,
    createdAt: now,
    updatedAt: now,
  };
  await db.runTransaction(async (tx) => {
    const existing = await tx.get(ref);
    if (existing.exists && (existing.data() as { status: string }).status !== "DECLINED") {
      throw new HttpsError("already-exists", "A pickup request is already open for this booking.");
    }
    tx.set(ref, doc);
    writeAuditLog(tx, { action: "pickup.requested", entityType: "PickupRequest", entityId: ref.id, user, studioId: booking.studioId, after: { kind: data.kind } });
  });
  return { request: doc };
});

/** Studio or admin confirms, completes or declines a pickup request. New, additive. */
export const updatePickupRequest = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "studio", "admin", "superadmin");
  assertTenant(user, user.claims.tenantId);
  const data = validate(updateSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "pickup.update");
  const db = getFirestore();
  const ref = db.collection(COLLECTIONS.pickupRequests()).doc(data.requestId);
  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "Request not found.");
    const cur = snap.data() as PickupRequestDoc;
    assertTenant(user, cur.tenantId);
    if (user.claims.role === "studio" && user.claims.studioId !== cur.studioId) throw new HttpsError("permission-denied", "Different studio.");

    // Agreed timing comes from the phone call with the customer. Confirming
    // a service requires a valid agreed date/time for that service -
    // supplied now, or already stored from an earlier confirmation (so a
    // repeat approval click is idempotent rather than an error).
    let agreedPickupAt = cur.agreedPickupAt ?? null;
    let agreedDropAt = cur.agreedDropAt ?? null;
    if (data.agreedPickupAt !== undefined || data.agreedDropAt !== undefined) {
      const tz = await studioTimezone(db, cur.studioId);
      if (data.agreedPickupAt !== undefined) agreedPickupAt = studioLocalToIso(data.agreedPickupAt, tz, "Agreed pickup time");
      if (data.agreedDropAt !== undefined) agreedDropAt = studioLocalToIso(data.agreedDropAt, tz, "Agreed dropoff time");
    }

    if (data.status === "CONFIRMED") {
      const needsPickup = cur.kind === "pickup" || cur.kind === "both";
      const needsDrop = cur.kind === "drop" || cur.kind === "both";
      if (needsPickup && !agreedPickupAt) {
        throw new HttpsError("invalid-argument", "Enter the pickup time agreed with the customer on the call before confirming.");
      }
      if (needsDrop && !agreedDropAt) {
        throw new HttpsError("invalid-argument", "Enter the dropoff time agreed with the customer on the call before confirming.");
      }
    }

    const staffNote = data.staffNote ?? cur.staffNote ?? "";
    const now = new Date().toISOString();

    // No-op guard: identical status with no new note or timing changes
    // writes nothing and adds no audit entry, so repeated approval clicks
    // cannot fan out duplicate customer notifications.
    if (
      cur.status === data.status &&
      staffNote === cur.staffNote &&
      agreedPickupAt === cur.agreedPickupAt &&
      agreedDropAt === cur.agreedDropAt
    ) {
      return { requestId: data.requestId, status: data.status, idempotent: true };
    }

    tx.update(ref, { status: data.status, staffNote, agreedPickupAt, agreedDropAt, updatedAt: now });
    writeAuditLog(tx, {
      action: "pickup.updated",
      entityType: "PickupRequest",
      entityId: ref.id,
      user,
      studioId: cur.studioId,
      before: { status: cur.status },
      after: { status: data.status, agreedPickupAt, agreedDropAt },
    });
    return { requestId: data.requestId, status: data.status, idempotent: false };
  });
  return result;
});
