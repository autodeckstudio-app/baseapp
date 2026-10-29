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
 * re-prove that it is a cancelled, payment-free, invoice-free record on the
 * one named test customer account with only cancelled jobs - any surprise
 * aborts the whole call with nothing deleted.
 *
 * Every discovery read (booking, jobs, payments by bookingId AND by jobId,
 * invoices, bookingIntents, pickupRequests) runs INSIDE one Firestore
 * transaction. Server-side transactions are serializable: a payment,
 * invoice, or reference document created concurrently makes the commit
 * fail and the callback retried, and the retried read sees the new
 * document and fails validation. There is no preflight window: validation
 * and deletion are one atomic unit. (Transaction.get(query) is supported
 * by the Admin SDK - see @google-cloud/firestore Transaction typings.)
 *
 * Before any delete, the full JSON of every doc about to be removed is
 * written to cleanupSnapshots (admin-read-only per firestore.rules), and
 * each removed booking leaves a booking.test_purged auditLog entry.
 *
 * Default is a dry run: with dryRun omitted the call runs the identical
 * in-transaction read + validation and reports what WOULD be deleted.
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

interface BookingWorld {
  bookingId: string;
  bookingRef: FirebaseFirestore.DocumentReference;
  booking: FirebaseFirestore.DocumentData;
  jobs: DocBit[];
  intents: DocBit[];
  pickups: DocBit[];
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
    const now = new Date().toISOString();
    const snapshotRef = db.collection(COLLECTIONS.cleanupSnapshots()).doc();

    return db.runTransaction(async (tx) => {
      // ALL reads first (Firestore requires reads before writes in a tx).
      const worlds: BookingWorld[] = [];
      for (const bookingId of ids) {
        const bookingRef = db.collection(COLLECTIONS.bookings()).doc(bookingId);
        const snap = await tx.get(bookingRef);
        const booking = snap.exists ? (snap.data() as Booking) : undefined;
        if (booking) {
          assertTenant(user, booking.tenantId);
          assertStudio(user, booking.studioId, "Booking");
        }
        const jobsSnap = await tx.get(db.collection(COLLECTIONS.jobs()).where("bookingId", "==", bookingId));
        const jobs: DocBit[] = jobsSnap.docs.map((d) => ({ ref: d.ref, data: d.data() }));
        // Payment evidence checked both ways it is linked: directly by
        // bookingId and via each job. In-transaction query reads close the
        // concurrency race - a payment/invoice committed concurrently aborts
        // the commit and the retry sees it.
        const payByBooking = await tx.get(db.collection(COLLECTIONS.payments()).where("bookingId", "==", bookingId).limit(5));
        let paymentCount = payByBooking.size;
        for (const j of jobs) {
          const payByJob = await tx.get(db.collection(COLLECTIONS.payments()).where("jobId", "==", j.ref.id).limit(5));
          paymentCount += payByJob.size;
        }
        const invoicesSnap = await tx.get(db.collection(COLLECTIONS.invoices()).where("bookingId", "==", bookingId).limit(5));
        const intentsSnap = await tx.get(db.collection(COLLECTIONS.bookingIntents()).where("bookingId", "==", bookingId));
        const pickupsSnap = await tx.get(db.collection(COLLECTIONS.pickupRequests()).where("bookingId", "==", bookingId));
        const intents: DocBit[] = intentsSnap.docs.map((d) => ({ ref: d.ref, data: d.data() }));
        const pickups: DocBit[] = pickupsSnap.docs.map((d) => ({ ref: d.ref, data: d.data() }));
        const candidate: PurgeCandidate = {
          bookingId,
          bookingExists: snap.exists,
          bookingStatus: booking ? String(booking.status) : undefined,
          bookingCustomerId: booking ? String(booking.customerId) : undefined,
          jobs: jobs.map((j) => ({ id: j.ref.id, status: String((j.data as ServiceJob).status) })),
          paymentCount,
          invoiceCount: invoicesSnap.size,
          intentIds: intents.map((i) => i.ref.id),
          pickupRequestIds: pickups.map((p) => p.ref.id),
        };
        const verdict = planTestBookingPurge(candidate, data.customerId);
        if (!verdict.ok) throw new HttpsError("failed-precondition", `${verdict.reason}. Nothing was deleted.`);
        if (!booking) throw new HttpsError("failed-precondition", `booking ${bookingId} does not exist. Nothing was deleted.`);
        worlds.push({ bookingId, bookingRef, booking, jobs, intents, pickups });
      }

      if (dryRun) {
        return {
          dryRun: true,
          validated: worlds.map((w) => ({
            bookingId: w.bookingId,
            jobs: w.jobs.map((j) => j.ref.id),
            bookingIntents: w.intents.map((i) => i.ref.id),
            pickupRequests: w.pickups.map((p) => p.ref.id),
          })),
          totalDocs: worlds.reduce((n, w) => n + 1 + w.jobs.length + w.intents.length + w.pickups.length, 0),
        };
      }

      // Recovery snapshot BEFORE any delete: full JSON of every removed doc.
      // tenantId is set so the firestore.rules ownTenant admin read applies.
      tx.set(snapshotRef, {
        id: snapshotRef.id,
        createdAt: now,
        tenantId: user.claims.tenantId,
        requestedBy: user.uid,
        reason: data.reason,
        bookings: worlds.map((w) => ({ id: w.bookingId, data: w.booking })),
        jobs: worlds.flatMap((w) => w.jobs.map((j) => ({ id: j.ref.id, data: j.data }))),
        bookingIntents: worlds.flatMap((w) => w.intents.map((i) => ({ id: i.ref.id, data: i.data }))),
        pickupRequests: worlds.flatMap((w) => w.pickups.map((p) => ({ id: p.ref.id, data: p.data }))),
      });

      let deletedDocs = 0;
      for (const w of worlds) {
        const bookingRef = w.bookingRef;
        writeAuditLog(tx, {
          action: "booking.test_purged",
          entityType: "Booking",
          entityId: w.bookingId,
          user,
          studioId: (w.booking as Booking).studioId,
          before: w.booking,
          after: { snapshotId: snapshotRef.id, reason: data.reason },
        });
        tx.delete(bookingRef);
        deletedDocs += 1;
        for (const j of w.jobs) { tx.delete(j.ref); deletedDocs += 1; }
        for (const i of w.intents) { tx.delete(i.ref); deletedDocs += 1; }
        for (const p of w.pickups) { tx.delete(p.ref); deletedDocs += 1; }
      }

      return { success: true, snapshotId: snapshotRef.id, bookingsPurged: worlds.length, deletedDocs };
    });
  },
);
