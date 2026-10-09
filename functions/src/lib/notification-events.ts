// Maps an AuditLog entry to a customer-facing Notification, or null if the
// action has no customer notification (Phase 2C architecture: AuditLog is
// the sole authoritative event source â no second event bus, no invented
// AuditActions). Reads the referenced entity to resolve the recipient
// (customerId) and to build a concise, human-readable title/body â the
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

function formatPaise(paise: number): string {
  return `â¹${Math.round(paise / 100).toLocaleString("en-IN")}`;
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
        title: "Booking confirmed",
        body: `Your ${vehicle} booking is confirmed for ${formatTimeIST(booking.scheduledAt)}.`,
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
        title: log.metadata?.["autoCancelled"] ? "Booking auto-cancelled" : "Booking cancelled",
        body: log.metadata?.["autoCancelled"] ? `Your ${vehicle} booking was auto-cancelled because the car did not arrive by studio close. Make a new booking when you are ready.` : `Your ${vehicle} booking has been cancelled.`,
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
        title: "Booking missed",
        body: `Your ${vehicle} booking for ${formatDateIST(booking.scheduledAt)} at ${formatTimeIST(booking.scheduledAt)} was not checked in by studio close. Pick a new time or cancel it.`,
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
        title: "Booking rescheduled",
        body: `Your ${vehicle} booking has been moved to ${formatDateIST(booking.scheduledAt)} at ${formatTimeIST(booking.scheduledAt)}.`,
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
        VEHICLE_RECEIVED: { type: "vehicle_received", title: "Vehicle received", body: `Your ${vehicle} has been checked in at the studio.` },
        QUALITY_CHECK: { type: "quality_check", title: "Quality check", body: `Your ${vehicle} is now being checked before handover.` },
        DELIVERED: { type: "vehicle_delivered", title: "Vehicle delivered", body: `Your ${vehicle} has been handed over. Thank you for visiting AutoDeck.` },
      };
      const update = nextStatus ? updates[nextStatus] : undefined;
      if (update) return { userId: job.customerId, ...update, entityType: job.bookingId ? "Booking" : null, entityId: job.bookingId };
      if (nextStatus === "IN_PROGRESS") {
        return {
          userId: job.customerId,
          type: "job_started",
          title: "Work started",
          body: `Work has started on your ${vehicle}.`,
          entityType: job.bookingId ? "Booking" : null,
          entityId: job.bookingId,
        };
      }
      return {
        userId: job.customerId,
        type: "job_completed",
        title: "Your vehicle is ready",
        body: `Your ${vehicle} is ready for pickup.`,
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
      const title = log.action === "payment.completed" ? "Payment received" : "Payment failed";
      const amount = formatPaise(payment.amount);
      const body =
        log.action === "payment.completed"
          ? payment.targetType === "membership"
            ? `Your membership payment of ${amount} was successful.`
            : `We've received your payment of ${amount}.`
          : payment.targetType === "membership"
            ? `Your membership payment of ${amount} could not be processed. Please try again.`
            : `Your payment of ${amount} could not be processed. Please try again.`;

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
        title: "Invoice ready",
        body: `Invoice ${invoice.invoiceNumber} is ready â ${formatPaise(invoice.total)} total.`,
        entityType: "Invoice",
        entityId: invoice.id,
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
        title: "Membership activated",
        body: `Your ${membership.tier} membership is now active.`,
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
        title: "Membership expired",
        body: `Your ${membership.tier} membership has expired.`,
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
        title: "Approval needed",
        body: `Your ${vehicle} needs your approval: ${approval.serviceName} (+${formatPaise(approval.priceImpact)}).`,
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
        title: "Approval confirmed",
        body: `You approved ${approval.serviceName} (+${formatPaise(approval.priceImpact)}). New total: ${formatPaise(approval.newTotal)}.`,
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
        title: "Approval declined",
        body: `You declined ${approval.serviceName}. Original work continues as planned.`,
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
          title: wantsPickup && wantsDrop ? "Pickup and dropoff confirmed" : wantsPickup ? "Pickup confirmed" : "Dropoff confirmed",
          body: parts.join(" "),
          entityType: "Booking",
          entityId: req.bookingId,
        };
      }

      const what = wantsPickup && wantsDrop ? "pickup and dropoff" : wantsPickup ? "pickup" : "dropoff";
      return {
        userId: req.customerId,
        type: "pickup_declined",
        title: "Pickup request not confirmed",
        body: `Your ${what} request was not confirmed.${req.staffNote ? ` Reason: ${req.staffNote}` : ""}`,
        entityType: "Booking",
        entityId: req.bookingId,
      };
    }

    default:
      return null;
  }
}
