// Maps an AuditLog entry to a customer-facing Notification, or null if the
// action has no customer notification (Phase 2C architecture: AuditLog is
// the sole authoritative event source - no second event bus, no invented
// AuditActions). Reads the referenced entity to resolve the recipient
// (customerId) and to build a concise, human-readable title/body - the
// AuditLog payload alone does not reliably carry the recipient or display
// context needed for a notification.
//
// Entity references are resolved DOWN to what the customer app can actually
// navigate to: job- and payment-sourced events resolve to their owning
// Booking (the customer app has no standalone job/payment detail screen).
import type { Firestore } from "firebase-admin/firestore";
import type {
  AuditLog,
  Booking,
  ServiceJob,
  Payment,
  Invoice,
  Membership,
  Vehicle,
  ApprovalRequest,
  NotificationType,
  NotificationEntityType,
} from "@autodeck/core";
import { isBookingMissed } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";

export interface NotificationDraft {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  entityType: NotificationEntityType | null;
  entityId: string | null;
  // When set, used as the notification document id so a retried source event cannot create a second one.
  dedupeKey?: string;
}

function formatTimeIST(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDateIST(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
  });
}

function cap(t: string): string {
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}

function formatPaise(paise: number): string {
  return `\u20b9${Math.round(paise / 100).toLocaleString("en-IN")}`;
}


/** "Sat, 11 Oct at 4:30 pm" in the studio's configured timezone. */
function formatDateTimeTz(iso: string, timeZone: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-IN", { timeZone, weekday: "short", day: "numeric", month: "short" });
  const time = d.toLocaleTimeString("en-IN", { timeZone, hour: "2-digit", minute: "2-digit", hour12: true });
  return `${date} at ${time}`;
}

async function studioTimezone(db: Firestore, studioId: string): Promise<string> {
  try {
    const snap = await db.collection(COLLECTIONS.studioConfig()).doc(studioId).get();
    const tz = (snap.data() as { timezone?: string } | undefined)?.timezone;
    return tz || "Asia/Kolkata";
  } catch {
    return "Asia/Kolkata";
  }
}

interface PickupRequestForNotification {
  bookingId: string;
  customerId: string;
  studioId: string;
  kind: "pickup" | "drop" | "both";
  status: string;
  staffNote: string;
  agreedPickupAt: string | null;
  agreedDropAt: string | null;
}

async function vehicleLabel(db: Firestore, vehicleId: string): Promise<string> {
  const snap = await db.collection(COLLECTIONS.vehicles()).doc(vehicleId).get();
  if (!snap.exists) return "vehicle";
  const v = snap.data() as Vehicle;
  return v.model || v.make || "vehicle";
}

export async function buildNotification(
  db: Firestore,
  log: AuditLog,
): Promise<NotificationDraft | null> {
  switch (log.action) {
    case "booking.created": {
      const booking = (await db.collection(COLLECTIONS.bookings()).doc(log.entityId).get()).data() as
        | Booking
        | undefined;
      if (!booking) return null;
      const vehicle = await vehicleLabel(db, booking.vehicleId);
      return {
        userId: booking.customerId,
        type: "booking_confirmed",
        title: "You are booked",
        body: `${cap(vehicle)}, ${formatDateIST(booking.scheduledAt)} at ${formatTimeIST(booking.scheduledAt)}. We will have the bay ready.`,
        entityType: "Booking",
        entityId: booking.id,
      };
    }

    case "booking.cancelled": {
      const booking = (await db.collection(COLLECTIONS.bookings()).doc(log.entityId).get()).data() as
        | Booking
        | undefined;
      if (!booking) return null;
      const vehicle = await vehicleLabel(db, booking.vehicleId);
      return {
        userId: booking.customerId,
        type: "booking_cancelled",
        title: log.metadata?.["autoCancelled"] ? "We missed you today" : "Booking cancelled",
        body: log.metadata?.["autoCancelled"] ? `Your ${vehicle} did not make it in, so we released the slot. Pick a new time whenever you like.` : `Your ${vehicle} booking is cancelled. Rebook whenever it suits you.`,
        entityType: "Booking",
        entityId: booking.id,
      };
    }

    case "booking.missed": {
      const booking = (await db.collection(COLLECTIONS.bookings()).doc(log.entityId).get()).data() as
        | Booking
        | undefined;
      // Skip if the customer already rescheduled or cancelled before this was processed.
      if (!booking || !isBookingMissed(booking) || (log.metadata?.["scheduledAt"] && log.metadata["scheduledAt"] !== booking.scheduledAt)) return null;
      const vehicle = await vehicleLabel(db, booking.vehicleId);
      return {
        userId: booking.customerId,
        type: "booking_missed",
        title: "We missed you",
        body: `Your ${vehicle} slot on ${formatDateIST(booking.scheduledAt)} went unused. Pick a new time when you are ready.`,
        entityType: "Booking",
        entityId: booking.id,
      };
    }

    case "booking.rescheduled": {
      const booking = (await db.collection(COLLECTIONS.bookings()).doc(log.entityId).get()).data() as
        | Booking
        | undefined;
      if (!booking) return null;
      const vehicle = await vehicleLabel(db, booking.vehicleId);
      return {
        userId: booking.customerId,
        type: "booking_rescheduled",
        title: "New time confirmed",
        body: `${cap(vehicle)} is now booked for ${formatDateIST(booking.scheduledAt)} at ${formatTimeIST(booking.scheduledAt)}.`,
        entityType: "Booking",
        entityId: booking.id,
      };
    }

    case "job.status_advanced": {
      const nextStatus = (log.after?.["status"] as string | undefined) ?? null;
      if (!["VEHICLE_RECEIVED", "IN_PROGRESS", "QUALITY_CHECK", "READY_FOR_DELIVERY", "DELIVERED"].includes(nextStatus ?? "")) return null;

      const job = (await db.collection(COLLECTIONS.jobs()).doc(log.entityId).get()).data() as
        | ServiceJob
        | undefined;
      if (!job) return null;
      const vehicle = await vehicleLabel(db, job.vehicleId);

      const updates: Record<string, { type: NotificationType; title: string; body: string }> = {
        VEHICLE_RECEIVED: { type: "vehicle_received", title: "Your car is in", body: `${cap(vehicle)} is checked in and in good hands.` },
        QUALITY_CHECK: { type: "quality_check", title: "Final checks", body: `${cap(vehicle)} is getting its last inspection.` },
        DELIVERED: { type: "vehicle_delivered", title: "Thank you", body: `Enjoy your ${vehicle}. See you next time.` },
      };
      const update = nextStatus ? updates[nextStatus] : undefined;
      if (update) return { userId: job.customerId, ...update, entityType: job.bookingId ? "Booking" : null, entityId: job.bookingId };
      if (nextStatus === "IN_PROGRESS") {
        return {
          userId: job.customerId,
          type: "job_started",
          title: "Work has begun",
          body: `${cap(vehicle)} is on the bay now.`,
          entityType: job.bookingId ? "Booking" : null,
          entityId: job.bookingId,
        };
      }
      return {
        userId: job.customerId,
        type: "job_completed",
        title: "Ready for you",
        body: `${cap(vehicle)} is ready. Come collect it.`,
        entityType: job.bookingId ? "Booking" : null,
        entityId: job.bookingId,
      };
    }

    case "payment.completed":
    case "payment.failed": {
      const payment = (await db.collection(COLLECTIONS.payments()).doc(log.entityId).get()).data() as
        | Payment
        | undefined;
      if (!payment) return null;

      const type: NotificationType = log.action === "payment.completed" ? "payment_successful" : "payment_failed";
      const title =
        log.action === "payment.completed"
          ? payment.targetType === "membership" ? "You are in" : "Payment received"
          : "Payment did not go through";
      const amount = formatPaise(payment.amount);
      const body =
        log.action === "payment.completed"
          ? payment.targetType === "membership"
            ? `${amount} received. Welcome to the AutoDeck membership.`
            : `${amount} received. Thank you.`
          : payment.targetType === "membership"
            ? `Your ${amount} membership payment did not complete. Please try again, or ask us at the studio.`
            : `Your ${amount} payment did not complete. Please try again, or ask us at the studio.`;

      let entityType: NotificationEntityType | null = null;
      let entityId: string | null = null;
      if (payment.targetType === "membership" && payment.membershipId) {
        entityType = "Membership";
        entityId = payment.membershipId;
      } else if (payment.jobId) {
        const job = (await db.collection(COLLECTIONS.jobs()).doc(payment.jobId).get()).data() as
          | ServiceJob
          | undefined;
        if (job?.bookingId) {
          entityType = "Booking";
          entityId = job.bookingId;
        }
      }

      return { userId: payment.customerId, type, title, body, entityType, entityId };
    }

    case "invoice.issued": {
      const invoice = (await db.collection(COLLECTIONS.invoices()).doc(log.entityId).get()).data() as
        | Invoice
        | undefined;
      if (!invoice) return null;
      return {
        userId: invoice.customerId,
        type: "invoice_issued",
        title: "Your bill is ready",
        body: `${invoice.invoiceNumber}, ${formatPaise(invoice.total)}. Tap to view.`,
        entityType: "Invoice",
        entityId: invoice.id,
        dedupeKey: `invoice-issued-${invoice.id}`,
      };
    }

    case "membership.activated": {
      const membership = (await db.collection(COLLECTIONS.memberships()).doc(log.entityId).get()).data() as
        | Membership
        | undefined;
      if (!membership) return null;
      return {
        userId: membership.customerId,
        type: "membership_activated",
        title: `Welcome to ${cap(membership.tier)}`,
        body: `Your ${cap(membership.tier)} membership is active.`,
        entityType: "Membership",
        entityId: membership.id,
      };
    }

    case "membership.expired": {
      const membership = (await db.collection(COLLECTIONS.memberships()).doc(log.entityId).get()).data() as
        | Membership
        | undefined;
      if (!membership) return null;
      return {
        userId: membership.customerId,
        type: "membership_expired",
        title: `${cap(membership.tier)} has ended`,
        body: "Renew to keep your member benefits.",
        entityType: "Membership",
        entityId: membership.id,
      };
    }

    case "approval.created": {
      const approval = (await db.collection(COLLECTIONS.approvals()).doc(log.entityId).get()).data() as
        | ApprovalRequest
        | undefined;
      if (!approval) return null;
      const vehicle = await vehicleLabel(db, approval.vehicleId);
      return {
        userId: approval.customerId,
        type: "approval_requested",
        title: "Quick approval needed",
        body: `We found something on your ${vehicle}: ${approval.serviceName}, +${formatPaise(approval.priceImpact)}. Approve or decline in the app.`,
        entityType: "Approval",
        entityId: approval.id,
      };
    }

    case "approval.approved": {
      const approval = (await db.collection(COLLECTIONS.approvals()).doc(log.entityId).get()).data() as
        | ApprovalRequest
        | undefined;
      if (!approval) return null;
      return {
        userId: approval.customerId,
        type: "approval_approved",
        title: "Approved",
        body: `${approval.serviceName} is added. New total ${formatPaise(approval.newTotal)}.`,
        entityType: "Approval",
        entityId: approval.id,
      };
    }

    case "approval.rejected": {
      const approval = (await db.collection(COLLECTIONS.approvals()).doc(log.entityId).get()).data() as
        | ApprovalRequest
        | undefined;
      if (!approval) return null;
      return {
        userId: approval.customerId,
        type: "approval_rejected",
        title: "Noted",
        body: `We will skip ${approval.serviceName} and carry on with the rest.`,
        entityType: "Approval",
        entityId: approval.id,
      };
    }

    case "pickup.updated": {
      const req = (await db.collection(COLLECTIONS.pickupRequests()).doc(log.entityId).get()).data() as
        | PickupRequestForNotification
        | undefined;
      if (!req) return null;
      const next = (log.after?.["status"] as string | undefined) ?? req.status;
      if (next !== "CONFIRMED" && next !== "DECLINED") return null;

      const tz = await studioTimezone(db, req.studioId);
      const wantsPickup = req.kind === "pickup" || req.kind === "both";
      const wantsDrop = req.kind === "drop" || req.kind === "both";
      const pickupAt = req.agreedPickupAt ? formatDateTimeTz(req.agreedPickupAt, tz) : null;
      const dropAt = req.agreedDropAt ? formatDateTimeTz(req.agreedDropAt, tz) : null;

      if (next === "CONFIRMED") {
        const parts: string[] = [];
        if (wantsPickup) parts.push(pickupAt ? `Your pickup is confirmed for ${pickupAt}.` : "Your pickup is confirmed.");
        if (wantsDrop) parts.push(dropAt ? `Your dropoff is confirmed for ${dropAt}.` : "Your dropoff is confirmed.");
        return {
          userId: req.customerId,
          type: "pickup_confirmed",
          title: wantsPickup && wantsDrop ? "Pickup and drop confirmed" : wantsPickup ? "Pickup confirmed" : "Drop confirmed",
          body: parts.join(" "),
          entityType: "Booking",
          entityId: req.bookingId,
        };
      }

      const what = wantsPickup && wantsDrop ? "pickup and dropoff" : wantsPickup ? "pickup" : "dropoff";
      return {
        userId: req.customerId,
        type: "pickup_declined",
        title: "Pickup not available",
        body: `We could not take your ${what} request this time.${req.staffNote ? ` ${req.staffNote}` : ""} Choose another time?`,
        entityType: "Booking",
        entityId: req.bookingId,
      };
    }

    default:
      return null;
  }
}
