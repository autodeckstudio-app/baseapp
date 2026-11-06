import {hasReleasedBay} from "@autodeck/core";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type {
  Invoice,
  ServiceJob,
  Service,
  StudioConfig,
  Protection,
} from "@autodeck/core";
import { JOB_STATUS_TRANSITIONS } from "@autodeck/core";
import { COLLECTIONS, SUBCOLLECTIONS } from "@autodeck/database";
import {
  extractUser,
  assertRole,
  assertTenant,
} from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { advanceJobStatusSchema } from "../../schemas/job.js";
import {
  readCoveredLink,
  exactCoveredInvoice,
} from "../../lib/membership-covered.js";
import { computeScheduleEnd } from "../../lib/schedule.js";
import { buildOccupiedInterval, hasConflict } from "../../lib/availability.js";
import { buildWarranty } from "../../lib/warranty-builder.js";
import {
  planProtectionEvents,
  type PlannedEvent,
  type ProtectionWorkEvent,
} from "../../lib/protection-effects.js";
import { readConsultPaymentBinding } from "../../lib/consult-payment.js";
import { shouldEnforceAppCheck } from "../../lib/environment.js";

export const advanceJobStatus = onCall(
  { region: "asia-south1", enforceAppCheck: shouldEnforceAppCheck() },
  async (request) => {
    const user = extractUser(request);
    assertRole(user, "studio", "admin", "superadmin");
    const data = validate(advanceJobStatusSchema, request.data);
    await enforceRateLimit(subjectFrom(user), "job.advanceStatus");

    const db = getFirestore();
    const jobSnap = await db
      .collection(COLLECTIONS.jobs())
      .doc(data.jobId)
      .get();
    if (!jobSnap.exists) throw new HttpsError("not-found", "Job not found.");
    const job = jobSnap.data() as ServiceJob;

    assertTenant(user, job.tenantId);

    // Studio users are scoped to their own studio
    if (
      user.claims.role === "studio" &&
      user.claims.studioId !== job.studioId
    ) {
      throw new HttpsError(
        "permission-denied",
        "Job belongs to a different studio.",
      );
    }

    // Fast-fail pre-check (cheap, avoids entering a transaction for an
    // obviously-terminal job) — NOT the authoritative check, since job.status
    // is mutable/racy across concurrent calls. See the re-check inside the
    // transaction below (Phase 5B P1-5 fix).
    const preCheckTransitions = JOB_STATUS_TRANSITIONS[job.status] ?? [];
    if (preCheckTransitions.length === 0) {
      // A resubmitted delivery is the common lost-ack retry: reject it
      // honestly (the committed outcome stands; refresh), never with a fake
      // success and never a double apply. The in-transaction re-check below
      // is the authoritative copy of this same rejection for the race case.
      if (job.status === "DELIVERED") {
        throw new HttpsError(
          "failed-precondition",
          "This job is already delivered - the recorded outcome, including its protection work declaration, stands as committed. Refresh the job instead of resubmitting the delivery.",
        );
      }
      throw new HttpsError(
        "failed-precondition",
        `Job is in terminal status '${job.status}' and cannot be advanced.`,
      );
    }

    const now = new Date().toISOString();

    const result = await db.runTransaction(async (tx) => {
      // All reads before any writes. Re-read the job fresh INSIDE the
      // transaction (Phase 5B P1-5 fix) — this function previously computed
      // nextStatus/statusHistory from the outer, pre-transaction `job` read
      // and then performed a blind tx.update() with no tx.get() on the job
      // document at all, so Firestore's optimistic-concurrency conflict
      // detection never covered it. Two concurrent/retried calls on the same
      // job wouldn't conflict — whichever committed last would win outright,
      // silently dropping the other's statusHistory entry (full-array
      // replace, not arrayUnion), and in the worst case could re-open a job
      // that had already reached a later status. Every other transactional
      // mutation in this codebase (respondToApproval, updateInspection,
      // upsertBay, addHoliday, cancelBooking, rescheduleBooking) correctly
      // tx.get()s the document it mutates — this was the one outlier.
      const freshJobSnap = await tx.get(
        db.collection(COLLECTIONS.jobs()).doc(data.jobId),
      );
      if (!freshJobSnap.exists)
        throw new HttpsError("not-found", "Job not found.");
      const freshJob = freshJobSnap.data() as ServiceJob;
      // The DOCUMENT id is the job's identity; a stored id field is data and
      // can be corrupt. Never let a mismatched stored id redirect ids,
      // provenance, or audit trails.
      if (freshJob.id !== freshJobSnap.id)
        throw new HttpsError(
          "failed-precondition",
          "This job record is inconsistent - its identity cannot be confirmed. No changes were made.",
        );
      const jobId = freshJobSnap.id;

      // Price-on-request bookings: no work starts until the customer approves the quote.
      if (
        ["PENDING_VEHICLE", "VEHICLE_RECEIVED"].includes(freshJob.status) &&
        freshJob.bookingId
      ) {
        const bk = await tx.get(
          db.collection(COLLECTIONS.bookings()).doc(freshJob.bookingId),
        );
        if (
          !bk.exists ||
          bk.data()?.["tenantId"] !== freshJob.tenantId ||
          bk.data()?.["customerId"] !== freshJob.customerId
        )
          throw new HttpsError(
            "failed-precondition",
            "Linked quote scope could not be verified.",
          );
        const q = bk.data() as
          { priceOnRequest?: boolean; quoteStatus?: string } | undefined;
        if (q?.priceOnRequest === true && q.quoteStatus !== "approved") {
          throw new HttpsError(
            "failed-precondition",
            "Waiting for the customer to approve the quote.",
          );
        }
        if (q?.priceOnRequest === true)
          await readConsultPaymentBinding(db, tx, freshJob, bk.data());
      }

      if (freshJob.status === "STANDBY")
        throw new HttpsError(
          "failed-precondition",
          "Admit from standby into an available bay first.",
        );
      if (data.rework && freshJob.status !== "QUALITY_CHECK")
        throw new HttpsError(
          "failed-precondition",
          "Rework is available only during Quality check.",
        );

      if (
        freshJob.status === "PENDING_VEHICLE" &&
        Date.parse(freshJob.estimatedEndAt) <= Date.now()
      )
        throw new HttpsError(
          "failed-precondition",
          "The reserved service window has passed. Use Arrived - standby or reschedule before checking in.",
        );

      if (freshJob.status === "DELIVERED")
        throw new HttpsError(
          "failed-precondition",
          "This job is already delivered - the recorded outcome, including its protection work declaration, stands as committed. Refresh the job instead of resubmitting the delivery.",
        );
      const validTransitions = JOB_STATUS_TRANSITIONS[freshJob.status] ?? [];
      if (validTransitions.length === 0) {
        throw new HttpsError(
          "failed-precondition",
          `Job is in terminal status '${freshJob.status}' and cannot be advanced.`,
        );
      }
      // For forward advancement, pick the first valid non-CANCELLED transition.
      // For CANCELLED specifically, it must be explicitly requested (handled by cancelBooking).
      const nextStatus = data.rework
        ? "IN_PROGRESS"
        : validTransitions.find((s) => s !== "CANCELLED");
      if (!nextStatus) {
        throw new HttpsError(
          "failed-precondition",
          `No forward transition available from status '${freshJob.status}'.`,
        );
      }
      // The performed-work declaration belongs ONLY to the delivery step: supplying it
      // on any other transition is a caller bug, never silently ignored.
      if (data.protectionWork !== undefined && nextStatus !== "DELIVERED") {
        throw new HttpsError(
          "failed-precondition",
          "A protection work declaration is only accepted when delivering the vehicle.",
        );
      }
      // Bay occupancy guard on check-in (PENDING_VEHICLE -> VEHICLE_RECEIVED).
      // Scheduled windows alone do not prove a bay is physically free: a prior
      // job can overrun or never be closed while holding the same bay, and a
      // later booking with a non-overlapping slot would then be admitted into
      // an occupied bay. Mirror the assignBay/standbyBooking rule: serialize on
      // the deterministic bayLocks document inside this transaction, then refuse
      // the check-in while any OTHER job still holds the bay. Physically
      // arrived jobs (any active status) hold until delivered/cancelled,
      // regardless of their schedule; a PENDING_VEHICLE reservation holds only
      // while unexpired AND actually interval-overlapping this job's own
      // window, so an on-time check-in is never blocked by a later
      // non-overlapping booking or an expired no-show. The holding job is
      // named for the operator; it is never auto-closed here.
      if (nextStatus === "VEHICLE_RECEIVED" && freshJob.bayId) {
        // Serialize on the deterministic bayLocks document. Unlike assignBay's
        // read-only touch, this WRITES the lock so two concurrent check-ins for
        // the same bay conflict at the document version and one retries into
        // the other's committed holder. Same documented honesty as
        // COLLECTIONS.bayLocks: this measurably reduces, and for same-bay
        // check-ins closes, the race window; it is not a general admission lock.
        const bayLockRef = db
          .collection(COLLECTIONS.bayLocks())
          .doc(`${freshJob.tenantId}__${freshJob.studioId}__${freshJob.bayId}`);
        await tx.get(bayLockRef);
        // Status-based, NOT scheduledDate-windowed: an overdue IN_PROGRESS job
        // from weeks ago still physically holds its bay and would fall outside
        // any date range around today's check-in. Composite index
        // jobs(studioId, bayId, status) added in firestore.indexes.json.
        const bayJobsSnap = await tx.get(
          db
            .collection(COLLECTIONS.jobs())
            .where("studioId", "==", freshJob.studioId)
            .where("bayId", "==", freshJob.bayId)
            .where("status", "in", [
              "PENDING_VEHICLE",
              "VEHICLE_RECEIVED",
              "IN_PROGRESS",
              "QUALITY_CHECK",
              "READY_FOR_DELIVERY",
            ]),
        );
        const nowMs = Date.parse(now);
        // Physical occupancy runs from the actual check-in instant for the
        // service's full duration - same computation standby admission uses
        // (standbyBooking): computeScheduleEnd(now, duration, operating hours,
        // holidays). The job's stored scheduledAt/estimatedEndAt are NOT
        // rewritten (they remain the customer-facing booked times); using the
        // stale window here would UNDERSTATE occupancy for a late check-in
        // and silently admit a colliding future reservation.
        const configSnap = await tx.get(
          db.collection(COLLECTIONS.studioConfig()).doc(freshJob.studioId),
        );
        if (!configSnap.exists)
          throw new HttpsError("not-found", "Studio config not found.");
        const config = configSnap.data() as StudioConfig;
        const effectiveEnd = computeScheduleEnd(
          new Date(now),
          freshJob.estimatedDurationMinutes,
          config.operatingHours,
          config.holidays,
          config.timezone,
        );
        const holder = bayJobsSnap.docs
          .map((d) => ({ ...(d.data() as ServiceJob), id: d.id }))
          .find((other) => {
            if (other.id === data.jobId||hasReleasedBay(other)) return false;
            // Defensive: only the queried live statuses can ever hold the bay
            // (keeps the rule correct even if the query's status filter widens).
            if (
              ![
                "PENDING_VEHICLE",
                "VEHICLE_RECEIVED",
                "IN_PROGRESS",
                "QUALITY_CHECK",
                "READY_FOR_DELIVERY",
              ].includes(other.status)
            )
              return false;
            // Physically arrived holders block regardless of estimated finish.
            if (other.status !== "PENDING_VEHICLE") return true;
            // A pending reservation blocks only on ACTUAL scheduled-interval
            // overlap with the effective occupancy window, and only while its
            // own window is unexpired. A later non-overlapping booking must
            // never block an on-time check-in; an expired no-show window
            // holds nothing.
            if (Date.parse(other.estimatedEndAt) <= nowMs) return false;
            return hasConflict(new Date(now), effectiveEnd, [
              buildOccupiedInterval(other.scheduledAt, other.estimatedEndAt),
            ]);
          });
        if (holder) {
          throw new HttpsError(
            "failed-precondition",
            `Bay is still held by job ${holder.id} (${holder.status}). Close that job or reassign a bay before checking this vehicle in.`,
          );
        }
        tx.set(
          bayLockRef,
          { lastCheckInAt: now, lastJobId: data.jobId },
          { merge: true },
        );
      }

      const newHistoryEntry = {
        status: nextStatus,
        changedAt: now,
        changedBy: user.uid,
        notes: data.notes ?? null,
      };

      // Warranty issuance is resolved here so the idempotency check (has a
      // Warranty already been written for this job?) sees a fresh,
      // transaction-consistent read — a concurrent/retried call that also
      // reaches DELIVERED will be serialized by Firestore's transaction
      // contention on the job document and, on retry, will see
      // warrantySnap.exists === true and skip re-issuing (same guarantee as
      // bay assignment — doc07 §7.5).
      let warranty: ReturnType<typeof buildWarranty> = null;
      let protectionPlan: { outcomes: PlannedEvent[] } = { outcomes: [] };
      const warrantyRef = db
        .collection(COLLECTIONS.warranties())
        .doc(data.jobId);
      if (nextStatus === "DELIVERED") {
        // Delivery REQUIRES an explicit performed-work declaration: [] means
        // "reviewed - no protection work of any kind on this visit"; an absent
        // field means the staff never made the choice. The two never blur.
        if (data.protectionWork === undefined)
          throw new HttpsError(
            "failed-precondition",
            "Confirm the protection work declaration before delivering - record the work performed, or explicitly record none.",
          );
        // Fresh in-transaction authority revalidation before ANY lifecycle write:
        // the job's tenant/studio and the caller's binding to them (the outer
        // pre-check read is stale by definition), then the vehicle's current
        // truth. A transferred, archived or mismatched job/vehicle writes no
        // coverage for a former owner.
        assertTenant(user, freshJob.tenantId);
        if (
          user.claims.role === "studio" &&
          user.claims.studioId !== freshJob.studioId
        ) {
          throw new HttpsError(
            "permission-denied",
            "Job belongs to a different studio.",
          );
        }
        const vehRef = db
          .collection(COLLECTIONS.vehicles())
          .doc(freshJob.vehicleId);
        const vehSnap = await tx.get(vehRef);
        const veh = vehSnap.data() as
          | { tenantId?: string; ownerId?: string; deletedAt?: unknown }
          | undefined;
        if (
          !vehSnap.exists ||
          !veh ||
          veh.tenantId !== freshJob.tenantId ||
          veh.deletedAt ||
          veh.ownerId !== freshJob.customerId
        ) {
          throw new HttpsError(
            "failed-precondition",
            "This car's current record does not match this job - protection work cannot be recorded for it.",
          );
        }
        if (freshJob.paymentStatus !== "paid")
          throw new HttpsError(
            "failed-precondition",
            "Collect and confirm full payment before delivering this vehicle.",
          );
        // Every delivered visit has a live (not void) invoice. Payment status alone is not enough: a void leaves the job marked paid.
        const invs = await tx.get(
          db
            .collection(COLLECTIONS.invoices())
            .where("jobId", "==", data.jobId)
            .where("tenantId", "==", freshJob.tenantId),
        );
        if (
          freshJob.settlementKind === "membership_covered" ||
          (freshJob.membershipWashUsed && freshJob.totalAmount === 0)
        ) {
          const { booking, membershipId } = await readCoveredLink(
            db,
            tx,
            freshJob,
          );
          if (
            !invs.docs.some((d) =>
              exactCoveredInvoice(
                d.data() as Invoice,
                freshJob,
                booking,
                membershipId,
              ),
            )
          )
            throw new HttpsError(
              "failed-precondition",
              "Membership-covered invoice linkage is invalid.",
            );
        }
        if (
          !invs.docs.some(
            (d) => (d.data() as { status: string }).status !== "void",
          )
        )
          throw new HttpsError(
            "failed-precondition",
            "This visit has no invoice. Record the payment to issue one before delivering.",
          );
        // A job cannot be delivered while additional work is still awaiting
        // the customer's decision — Phase 3 requirement: prevent the studio
        // from treating unauthorized additional work as complete.
        const pendingApprovals = await tx.get(
          db
            .collection(COLLECTIONS.approvals())
            .where("jobId", "==", data.jobId)
            .where("status", "==", "pending")
            .limit(1),
        );
        if (!pendingApprovals.empty) {
          throw new HttpsError(
            "failed-precondition",
            "This job has an approval awaiting the customer's decision. Resolve or cancel it before delivering.",
          );
        }

        const [serviceSnap, warrantySnap] = await Promise.all([
          tx.get(db.collection(COLLECTIONS.services()).doc(freshJob.serviceId)),
          tx.get(warrantyRef),
        ]);
        if (serviceSnap.exists && !warrantySnap.exists) {
          warranty = buildWarranty({
            job: freshJob,
            service: serviceSnap.data() as Service,
            sealedAt: now,
          });
        }

        // Protection lifecycle: ONLY the events staff declare as actually
        // performed at this delivery leave a record - install / replace /
        // remove, each with explicit targets. A purchased protection service
        // (main or add-on) is never treated as performed work, and no record
        // is superseded or removed unless a declared event names it. Existing
        // records are keyed by their AUTHORITATIVE doc id (a corrupt stored id
        // redirects nothing) and must belong to this job's tenant + vehicle.
        const declaredEvents: ProtectionWorkEvent[] = (
          data.protectionWork ?? []
        ).map((w) =>
          w.action === "remove"
            ? {
                action: "remove",
                targetProtectionId: w.targetProtectionId,
                expectedRevision: w.expectedRevision,
              }
            : w.action === "replace"
              ? {
                  action: "replace",
                  targetProtectionId: w.targetProtectionId,
                  expectedRevision: w.expectedRevision,
                  kind: w.kind,
                  coverage: w.coverage,
                  brand: w.brand ?? null,
                  warrantyYears: w.warrantyYears ?? null,
                }
              : {
                  action: "install",
                  kind: w.kind,
                  coverage: w.coverage,
                  brand: w.brand ?? null,
                  warrantyYears: w.warrantyYears ?? null,
                },
        );
        const existing: Protection[] =
          declaredEvents.length === 0
            ? []
            : (
                await tx.get(
                  db.collection(
                    SUBCOLLECTIONS.vehicleProtections(freshJob.vehicleId),
                  ),
                )
              ).docs
                .map((d) => ({ ...(d.data() as Protection), id: d.id }))
                .filter(
                  (rec) =>
                    rec.tenantId === freshJob.tenantId &&
                    rec.vehicleId === freshJob.vehicleId,
                );
        try {
          protectionPlan = planProtectionEvents({
            job: { ...freshJob, id: jobId },
            events: declaredEvents,
            existing,
            actorUid: user.uid,
            now,
          });
        } catch (err) {
          throw new HttpsError(
            "failed-precondition",
            err instanceof Error
              ? err.message
              : "Invalid protection work declaration.",
          );
        }
      }

      tx.update(db.collection(COLLECTIONS.jobs()).doc(data.jobId), {
        status: nextStatus,
        statusHistory: [...freshJob.statusHistory, newHistoryEntry],
        updatedAt: now,
        ...(nextStatus === "DELIVERED"
          ? { sealedAt: now, protectionWork: data.protectionWork ?? [] }
          : {}),
      });

      // Sync booking status
      if (freshJob.bookingId) {
        const bookingUpdate: Record<string, unknown> = { updatedAt: now };
        if (nextStatus === "VEHICLE_RECEIVED") {
          bookingUpdate["status"] = "ACTIVE";
        } else if (nextStatus === "DELIVERED") {
          bookingUpdate["status"] = "COMPLETED";
        }
        if (Object.keys(bookingUpdate).length > 1) {
          tx.update(
            db.collection(COLLECTIONS.bookings()).doc(freshJob.bookingId),
            bookingUpdate,
          );
        }
      }

      {
        const col = db.collection(
          SUBCOLLECTIONS.vehicleProtections(freshJob.vehicleId),
        );
        for (const outcome of protectionPlan.outcomes) {
          if (outcome.action === "remove") {
            tx.update(col.doc(outcome.removeId), {
              lifecycle: "removed",
              removedByJobId: jobId,
              lifecycleAt: now,
              revision: outcome.removeNextRevision,
              updatedAt: now,
            });
            writeAuditLog(tx, {
              action: "protection.removed",
              entityType: "Protection",
              entityId: outcome.removeId,
              user,
              studioId: freshJob.studioId,
              after: {
                byJobId: jobId,
                revision: outcome.removeNextRevision,
                declaredBy: user.uid,
              },
            });
            continue;
          }
          if (outcome.action === "replace") {
            tx.update(col.doc(outcome.supersedeId), {
              lifecycle: "superseded",
              supersededByJobId: jobId,
              lifecycleAt: now,
              revision: outcome.supersedeNextRevision,
              updatedAt: now,
            });
            writeAuditLog(tx, {
              action: "protection.superseded",
              entityType: "Protection",
              entityId: outcome.supersedeId,
              user,
              studioId: freshJob.studioId,
              after: {
                byJobId: jobId,
                revision: outcome.supersedeNextRevision,
                declaredBy: user.uid,
              },
            });
          }
          tx.set(col.doc(outcome.record.id), outcome.record);
          writeAuditLog(tx, {
            action: "protection.installed",
            entityType: "Protection",
            entityId: outcome.record.id,
            user,
            studioId: freshJob.studioId,
            after: {
              jobId,
              kind: outcome.record.kind,
              coverage: outcome.record.coverage,
              revision: 1,
              declaredBy: user.uid,
              ...(outcome.action === "replace"
                ? { replaces: outcome.supersedeId }
                : {}),
            },
          });
        }
      }

      if (warranty) {
        tx.set(warrantyRef, warranty);
        writeAuditLog(tx, {
          action: "warranty.issued",
          entityType: "Warranty",
          entityId: warranty.id,
          user,
          studioId: freshJob.studioId,
          after: {
            jobId,
            vehicleId: freshJob.vehicleId,
            warrantyLabel: warranty.warrantyLabel,
          },
        });
      }

      writeAuditLog(tx, {
        action: "job.status_advanced",
        entityType: "ServiceJob",
        entityId: data.jobId,
        user,
        studioId: freshJob.studioId,
        before: { status: freshJob.status },
        after: { status: nextStatus },
      });

      return { previousStatus: freshJob.status, newStatus: nextStatus };
    });

    return {
      jobId: data.jobId,
      previousStatus: result.previousStatus,
      newStatus: result.newStatus,
    };
  },
);
