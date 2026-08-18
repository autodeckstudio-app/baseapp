// Maps an AuditLog entry to a customer-facing Notification, or null if the
// action has no customer notification (Phase 2C architecture: AuditLog is
// the sole authoritative event source — no second event bus, no invented
// AuditActions). Reads the referenced entity to resolve the recipient
// (customerId) and to build a concise, human-readable title/body — the
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
  NotificationType,
  NotificationEntityType,
} from "@autodeck/core";
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
  return `₹${Math.round(paise / 100).toLocaleString("en-IN")}`;
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
        title: "Booking cancelled",
        body: `Your ${vehicle} booking has been cancelled.`,
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
      if (nextStatus !== "IN_PROGRESS" && nextStatus !== "READY_FOR_DELIVERY") return null;

      const job = (await db.collection(COLLECTIONS.jobs()).doc(log.entityId).get()).data() as
        | ServiceJob
        | undefined;
      if (!job) return null;
      const vehicle = await vehicleLabel(db, job.vehicleId);

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
        body: `Invoice ${invoice.invoiceNumber} is ready — ${formatPaise(invoice.total)} total.`,
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

    default:
      return null;
  }
}
