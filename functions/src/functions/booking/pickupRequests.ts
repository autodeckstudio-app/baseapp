import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { z } from "zod";
import type { Booking } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole, assertTenant } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";

const requestSchema = z.object({
  bookingId: z.string().min(1),
  kind: z.enum(["pickup", "drop", "both"]),
  address: z.string().trim().min(8).max(300),
  preferredTime: z.string().trim().max(100).optional(),
  note: z.string().trim().max(300).optional(),
}).strict();

const updateSchema = z.object({
  requestId: z.string().min(1),
  status: z.enum(["REQUESTED", "CONFIRMED", "DONE", "DECLINED"]),
  staffNote: z.string().trim().max(300).optional(),
}).strict();

/** Customer asks the studio to collect and/or return the car. A request only: the studio confirms or declines. New, additive. */
export const requestPickupDrop = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
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
    note: data.note ?? "",
    status: "REQUESTED" as const,
    staffNote: "",
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
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "Request not found.");
    const cur = snap.data() as { tenantId: string; studioId: string; status: string };
    assertTenant(user, cur.tenantId);
    if (user.claims.role === "studio" && user.claims.studioId !== cur.studioId) throw new HttpsError("permission-denied", "Different studio.");
    tx.update(ref, { status: data.status, staffNote: data.staffNote ?? "", updatedAt: new Date().toISOString() });
    writeAuditLog(tx, { action: "pickup.updated", entityType: "PickupRequest", entityId: ref.id, user, studioId: cur.studioId, before: { status: cur.status }, after: { status: data.status } });
  });
  return { requestId: data.requestId, status: data.status };
});
