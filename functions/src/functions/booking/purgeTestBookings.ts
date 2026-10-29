import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { z } from "zod";
import { COLLECTIONS } from "@autodeck/database";
import type { Booking, ServiceJob } from "@autodeck/core";
import { extractUser, assertRole, assertTenant, assertStudio } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { shouldEnforceAppCheck } from "../../lib/environment.js";
import { planTestBookingPurge, type PurgeCandidate } from "../../lib/test-booking-purge.js";

/**
 * Scoped test-data cleanup, built for the owner-approved removal of named
 * test bookings (29 Oct owner approval). NOT a generalized delete endpoint:
 * admin role only, a strict exact booking-id list, and every booking must
 * re-prove (at call time AND again inside the delete transaction) that it
 * is a cancelled, payment-free, invoice-free record on the one named test
 * customer account with only cancelled jobs - any surprise aborts the whole
 * call with nothing deleted. Before any delete, the full JSON of every doc
 * about to be removed is written to cleanupSnapshots (recovery record),
 * and each removed booking leaves a booking.test_purged auditLog entry.
 *
 * Default is a dry run: with dryRun omitted the call only validates and
 * reports what WOULD be deleted. Payment/invoice discovery runs just before
 * the transaction (Firestore cannot query inside one); the in-transaction
 * re-check then re-validates booking/job/intent/pickup state, so anything
 * that changed under us aborts the commit.
 */

const purgeSchema = z
  .object({
    bookingIds: z.array(z.string().min(1).max(64)).min(1).max(50),
    customerId: z.string().min(1).max(64),
    reason: z.string().trim().min(3).max(300),
    dryRun: z.boolean().optional(),
  })
  .strict();

interface DocBit {
  ref: FirebaseFirestore.DocumentReference;
  data: FirebaseFirestore.DocumentData;
}

interface Collected {
  bookingId: string;
  bookingRef: FirebaseFirestore.DocumentReference;
  exists: boolean;
  booking?: FirebaseFirestore.DocumentData | undefined;
  jobs: DocBit[];
  intents: DocBit[];
  pickups: DocBit[];
  paymentCount: number;
  invoiceCount: number;
}

export const purgeTestBookings = onCall(
  { region: "asia-south1", invoker: "public", enforceAppCheck: shouldEnforceAppCheck() },
  async (request) => {
    const user = extractUser(request);
    assertRole(user, "admin", "superadmin");
    assertTenant(user, user.claims.tenantId);
    const data = validate(purgeSchema, request.data);
    const dryRun = data.dryRun ?? true;
    if (!dryRun) await enforceRateLimit(subjectFrom(user), "booking.purgeTest");

    const db = getFirestore();
    const ids = [...new Set(data.bookingIds)];
    const collected: Collected[] = [];

    for (const bookingId of ids) {
      const bookingRef = db.collection(COLLECTIONS.bookings()).doc(bookingId);
      const snap = await bookingRef.get();
      const booking = snap.exists ? (snap.data() as Booking) : undefined;
      if (booking) {
        assertTenant(user, booking.tenantId);
        assertStudio(user, booking.studioId, "Booking");
      }
      const jobsSnap = await db.collection(COLLECTIONS.jobs()).where("bookingId", "==", bookingId).get();
      const jobs: DocBit[] = jobsSnap.docs.map((d) => ({ ref: d.ref, data: d.data() }));
      const payByBooking = await db.collection(COLLECTIONS.payments()).where("bookingId", "==", bookingId).limit(5).get();
      let paymentCount = payByBooking.size;
      for (const j of jobs) {
        const payByJob = await db.collection(COLLECTIONS.payments()).where("jobId", "==", j.ref.id).limit(5).get();
        paymentCount += payByJob.size;
      }
      const invoicesSnap = await db.collection(COLLECTIONS.invoices()).where("bookingId", "==", bookingId).limit(5).get();
      const intentsSnap = await db.collection(COLLECTIONS.bookingIntents()).where("bookingId", "==", bookingId).get();
      const pickupsSnap = await db.collection(COLLECTIONS.pickupRequests()).where("bookingId", "==", bookingId).get();
      collected.push({
        bookingId,
        bookingRef,
        exists: snap.exists,
        booking,
        jobs,
        intents: intentsSnap.docs.map((d) => ({ ref: d.ref, data: d.data() })),
        pickups: pickupsSnap.docs.map((d) => ({ ref: d.ref, data: d.data() })),
        paymentCount,
        invoiceCount: invoicesSnap.size,
      });
    }

    for (const c of collected) {
      const verdict = planTestBookingPurge(candidateFrom(c), data.customerId);
      if (!verdict.ok) throw new HttpsError("failed-precondition", `${verdict.reason}. Nothing was deleted.`);
    }

    if (dryRun) {
      return {
        dryRun: true,
        validated: collected.map((c) => ({
          bookingId: c.bookingId,
          jobs: c.jobs.map((j) => j.ref.id),
          bookingIntents: c.intents.map((i) => i.ref.id),
          pickupRequests: c.pickups.map((p) => p.ref.id),
        })),
        totalDocs: collected.reduce((n, c) => n + 1 + c.jobs.length + c.intents.length + c.pickups.length, 0),
      };
    }

    const now = new Date().toISOString();
    const snapshotRef = db.collection(COLLECTIONS.cleanupSnapshots()).doc();
    let deletedDocs = 0;
    await db.runTransaction(async (tx) => {
      // Fresh re-read and full re-validation of every target inside the
      // transaction: anything that changed since the discovery reads aborts
      // the commit with nothing deleted.
      const fresh: { c: Collected; booking: FirebaseFirestore.DocumentData; jobs: DocBit[]; intents: DocBit[]; pickups: DocBit[] }[] = [];
      for (const c of collected) {
        const snap = await tx.get(c.bookingRef);
        const booking = snap.exists ? snap.data() : undefined;
        const jobs: DocBit[] = [];
        for (const j of c.jobs) {
          const js = await tx.get(j.ref);
          if (js.exists) jobs.push({ ref: j.ref, data: js.data()! });
        }
        const intents: DocBit[] = [];
        for (const i of c.intents) {
          const is = await tx.get(i.ref);
          if (is.exists) intents.push({ ref: i.ref, data: is.data()! });
        }
        const pickups: DocBit[] = [];
        for (const p of c.pickups) {
          const ps = await tx.get(p.ref);
          if (ps.exists) pickups.push({ ref: p.ref, data: ps.data()! });
        }
        const verdict = planTestBookingPurge(
          {
            bookingId: c.bookingId,
            bookingExists: snap.exists,
            bookingStatus: booking ? String((booking as Booking).status) : undefined,
            bookingCustomerId: booking ? String((booking as Booking).customerId) : undefined,
            jobs: jobs.map((j) => ({ id: j.ref.id, status: String((j.data as ServiceJob).status) })),
            paymentCount: c.paymentCount,
            invoiceCount: c.invoiceCount,
            intentIds: intents.map((i) => i.ref.id),
            pickupRequestIds: pickups.map((p) => p.ref.id),
          },
          data.customerId,
        );
        if (!verdict.ok) throw new HttpsError("failed-precondition", `Re-check just before delete failed: ${verdict.reason}. Nothing was deleted.`);
        fresh.push({ c, booking: booking!, jobs, intents, pickups });
      }

      // Recovery snapshot BEFORE any delete: full JSON of every removed doc.
      tx.set(snapshotRef, {
        id: snapshotRef.id,
        createdAt: now,
        requestedBy: user.uid,
        reason: data.reason,
        bookings: fresh.map((f) => ({ id: f.c.bookingId, data: f.booking })),
        jobs: fresh.flatMap((f) => f.jobs.map((j) => ({ id: j.ref.id, data: j.data }))),
        bookingIntents: fresh.flatMap((f) => f.intents.map((i) => ({ id: i.ref.id, data: i.data }))),
        pickupRequests: fresh.flatMap((f) => f.pickups.map((p) => ({ id: p.ref.id, data: p.data }))),
      });

      for (const f of fresh) {
        const bookingRef = f.c.bookingRef;
        writeAuditLog(tx, {
          action: "booking.test_purged",
          entityType: "Booking",
          entityId: f.c.bookingId,
          user,
          studioId: (f.booking as Booking).studioId,
          before: f.booking,
          after: { snapshotId: snapshotRef.id, reason: data.reason },
        });
        tx.delete(bookingRef);
        deletedDocs += 1;
        for (const j of f.jobs) { tx.delete(j.ref); deletedDocs += 1; }
        for (const i of f.intents) { tx.delete(i.ref); deletedDocs += 1; }
        for (const p of f.pickups) { tx.delete(p.ref); deletedDocs += 1; }
      }
    });

    return { success: true, snapshotId: snapshotRef.id, bookingsPurged: collected.length, deletedDocs };
  },
);

function candidateFrom(c: Collected): PurgeCandidate {
  return {
    bookingId: c.bookingId,
    bookingExists: c.exists,
    bookingStatus: c.booking ? String((c.booking as Booking).status) : undefined,
    bookingCustomerId: c.booking ? String((c.booking as Booking).customerId) : undefined,
    jobs: c.jobs.map((j) => ({ id: j.ref.id, status: String((j.data as ServiceJob).status) })),
    paymentCount: c.paymentCount,
    invoiceCount: c.invoiceCount,
    intentIds: c.intents.map((i) => i.ref.id),
    pickupRequestIds: c.pickups.map((p) => p.ref.id),
  };
}
