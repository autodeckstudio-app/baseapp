import { useState, useEffect } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { getBookingById, cancelBooking } from "../../../lib/booking-service";
import { listenToJobForBooking } from "../../../lib/job-service";
import { listenToPaymentForJob, initiatePayment } from "../../../lib/payment-service";
import { listenToApprovalsForJob } from "../../../lib/approval-service";
import { listenToInspection } from "../../../lib/inspection-service";
import type { Booking, ServiceJob, Payment, ApprovalRequest, Inspection } from "@autodeck/core";
import { MAX_CUSTOMER_RESCHEDULES, CANCELLATION_FREE_WINDOW_HOURS } from "@autodeck/core";
import { space } from "@autodeck/ui/theme";
import { Button, Chip, Kicker, Loading, Notice, Pane, Row, Screen, T, rupees } from "../../../ui/kit";

const JOB_STATUS_LABELS: Record<string, string> = {
  PENDING_VEHICLE: "Awaiting vehicle drop-off",
  VEHICLE_RECEIVED: "Vehicle received",
  IN_PROGRESS: "Service in progress",
  QUALITY_CHECK: "Quality check",
  READY_FOR_DELIVERY: "Ready for pickup",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: "Awaiting confirmation at studio",
  processing: "Processing",
  completed: "Paid",
  failed: "Payment failed — please try again",
  cancelled: "Payment cancelled",
  refunded: "Refunded",
};

const BOOKING_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending confirmation",
  CONFIRMED: "Confirmed",
  ACTIVE: "Vehicle at studio",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
};

const BOOKING_CHIP_TONE: Record<string, "neutral" | "accent" | "premium" | "danger"> = {
  PENDING: "neutral",
  CONFIRMED: "accent",
  ACTIVE: "accent",
  COMPLETED: "premium",
  CANCELLED: "danger",
  EXPIRED: "danger",
};

const NON_RESCHEDULABLE_STATUS_REASONS: Record<string, string> = {
  PENDING: "This booking is still awaiting studio confirmation.",
  ACTIVE: "Your vehicle is already at the studio — contact the studio to change the schedule.",
  COMPLETED: "This booking is already completed.",
  CANCELLED: "This booking has been cancelled.",
  EXPIRED: "This booking has expired.",
};

// Multi-day PPF services run into thousands of minutes — express as hours
// once past a day (this is service-time, not calendar time; the
// authoritative calendar span is shown separately via "Expected ready").
function formatDuration(minutes: number): string {
  if (minutes < 24 * 60) return `~${minutes} min`;
  return `~${Math.round(minutes / 60)} hrs of service time`;
}

function getRescheduleEligibility(booking: Booking): { eligible: boolean; reason: string | null } {
  if (booking.status !== "CONFIRMED") {
    return { eligible: false, reason: NON_RESCHEDULABLE_STATUS_REASONS[booking.status] ?? "This booking can't be rescheduled." };
  }
  if (booking.rescheduleCount >= MAX_CUSTOMER_RESCHEDULES) {
    return {
      eligible: false,
      reason: `You've used all ${MAX_CUSTOMER_RESCHEDULES} reschedules for this booking. Contact the studio to change the time.`,
    };
  }
  const hoursUntil = (new Date(booking.scheduledAt).getTime() - Date.now()) / 3600000;
  if (hoursUntil < CANCELLATION_FREE_WINDOW_HOURS) {
    return {
      eligible: false,
      reason: `Less than ${CANCELLATION_FREE_WINDOW_HOURS} hours before your appointment — contact the studio directly to reschedule.`,
    };
  }
  return { eligible: true, reason: null };
}

export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [payRequested, setPayRequested] = useState(false);
  const [job, setJob] = useState<ServiceJob | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [payingNow, setPayingNow] = useState(false);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [inspection, setInspection] = useState<Inspection | null>(null);

  useEffect(() => {
    if (!id) return;
    void getBookingById(id)
      .then(setBooking)
      .catch(() => setBooking(null))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!id || !booking) return;
    return listenToJobForBooking(id, booking.tenantId, booking.customerId, setJob, () => undefined);
  }, [id, booking?.tenantId, booking?.customerId]);

  useEffect(() => {
    if (!job) {
      setInspection(null);
      return undefined;
    }
    return listenToInspection(job.id, setInspection, () => undefined);
  }, [job?.id]);

  useEffect(() => {
    if (!job) return;
    return listenToPaymentForJob(job.id, job.tenantId, job.customerId, setPayment, () => undefined);
  }, [job?.id]);

  useEffect(() => {
    if (!job) return;
    return listenToApprovalsForJob(job.id, job.tenantId, job.customerId, setApprovals, () => undefined);
  }, [job?.id]);

  async function handlePayAtStudio() {
    if (!job) return;
    setPayingNow(true);
    setActionError(null);
    try {
      await initiatePayment(job.id, "cash");
      setPayRequested(true);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Couldn't start payment. Please try again.");
    } finally {
      setPayingNow(false);
    }
  }

  async function handleCancelConfirmed() {
    if (!booking || !id) return;
    setCancelling(true);
    setActionError(null);
    try {
      await cancelBooking(id, "Cancelled by customer");
      setBooking((prev) => (prev ? { ...prev, status: "CANCELLED" } : prev));
      setConfirmingCancel(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Cancellation failed.");
    } finally {
      setCancelling(false);
    }
  }

  if (loading) return <Loading label="Opening your booking" />;
  if (!booking) return <Screen><Notice title="Booking not found" body="It may have been removed, or the link is stale." /></Screen>;

  const canCancel = booking.status === "CONFIRMED" || booking.status === "PENDING";
  const canPay = booking.paymentStatus === "unpaid" && booking.status !== "CANCELLED" && booking.status !== "EXPIRED";
  const showRescheduleSection = booking.status !== "CANCELLED" && booking.status !== "COMPLETED" && booking.status !== "EXPIRED";
  const rescheduleEligibility = getRescheduleEligibility(booking);
  const hasPendingApproval = approvals.some((a) => a.status === "pending");

  const scheduledAt = new Date(booking.scheduledAt);
  const displayDate = scheduledAt.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const displayTime = scheduledAt.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true });

  const isMultiDay = booking.estimatedEndDate !== booking.scheduledDate;
  const displayEndDate = new Date(`${booking.estimatedEndDate}T12:00:00Z`).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <Screen
      header={
        <View style={{ gap: space.breath }}>
          <Chip label={BOOKING_STATUS_LABELS[booking.status] ?? booking.status} tone={BOOKING_CHIP_TONE[booking.status] ?? "neutral"} />
          <T role="title">{displayDate}</T>
        </View>
      }
    >
      <Pane pad="gap">
        <Row title="Time" detail={`${displayTime} IST`} />
        <Row title="Duration" detail={formatDuration(booking.durationMinutes)} />
        <Row title="Expected ready" detail={`${displayEndDate}, ${booking.estimatedEndTime} IST`} />
        {booking.notes !== null ? <Row title="Notes" detail={booking.notes} last /> : <Row title="" detail="" last />}
      </Pane>

      {isMultiDay ? (
        <Notice title="Multi-day service" body={`Your car stays at the studio from ${displayDate} through ${displayEndDate}.`} />
      ) : null}

      {job ? (
        <Pane pad="inset">
          <View style={{ gap: space.hair }}>
            <Kicker tone="accent">Studio status</Kicker>
            <T role="heading">{JOB_STATUS_LABELS[job.status] ?? job.status}</T>
          </View>
        </Pane>
      ) : null}

      {inspection?.status === "finalized" && job ? (
        <Pane pad="inset">
          <Row
            title="Inspection report"
            detail="Ready to view"
            onPress={() => router.push({ pathname: "/(tabs)/bookings/inspection", params: { jobId: job.id } })}
            last
          />
        </Pane>
      ) : null}

      {approvals
        .filter((a) => a.status === "pending")
        .map((a) => (
          <Notice
            key={a.id}
            title="Approval needed"
            body={`${a.serviceName} (+${rupees(a.priceImpact)})`}
            action={<Button label="Review" onPress={() => router.push(`/(tabs)/approvals/${a.id}`)} />}
          />
        ))}

      {job && job.additionalWorkDelta > 0 ? (
        <Pane pad="inset">
          <View style={{ gap: space.hair }}>
            <Kicker tone="premium">Approved additional work</Kicker>
            <T role="heading">+{rupees(job.additionalWorkDelta)}</T>
            <T role="caption" tone="secondary">Current total {rupees(job.totalAmount)}</T>
          </View>
        </Pane>
      ) : null}

      <View style={{ gap: space.line }}>
        <Kicker>Payment</Kicker>
        <Pane pad="gap">
          <Row title="Status" detail={payment ? PAYMENT_STATUS_LABELS[payment.status] ?? payment.status : "Not yet initiated"} last />
          {payment?.invoiceId && job ? (
            <View style={{ marginTop: space.line }}>
              <Button
                label="View invoice"
                kind="quiet"
                onPress={() => router.push({ pathname: "/(tabs)/bookings/invoice", params: { jobId: job.id, tenantId: job.tenantId, customerId: job.customerId } })}
              />
            </View>
          ) : null}
          {canPay && !payment && job ? (
            <View style={{ marginTop: space.line }}>
              {payRequested ? (
                <T role="caption" tone="secondary">Pay the studio team in person — your status will update once confirmed.</T>
              ) : (
                <Button label="Pay at studio" busy={payingNow} onPress={() => void handlePayAtStudio()} />
              )}
            </View>
          ) : null}
        </Pane>
      </View>

      <View style={{ gap: space.line }}>
        <Kicker>Price</Kicker>
        <Pane pad="gap">
          <Row title="Base" trailing={<T role="data">{rupees(booking.priceBreakdown.basePrice)}</T>} />
          {booking.priceBreakdown.scopeAdjustment > 0 ? (
            <Row title="Vehicle size adjustment" trailing={<T role="data">+{rupees(booking.priceBreakdown.scopeAdjustment)}</T>} />
          ) : null}
          {booking.priceBreakdown.addOns.map((addOn) => (
            <Row key={addOn.id} title={addOn.name} trailing={<T role="data">{rupees(addOn.price)}</T>} />
          ))}
          {booking.priceBreakdown.membershipDiscount !== null && booking.priceBreakdown.membershipDiscount > 0 ? (
            <Row title="Membership discount" trailing={<T role="data" tone="premium">-{rupees(booking.priceBreakdown.membershipDiscount)}</T>} />
          ) : null}
          <Row title={booking.priceBreakdown.taxDescription} trailing={<T role="data">{rupees(booking.priceBreakdown.tax)}</T>} />
          <Row title={<T role="heading">Total</T>} trailing={<T role="heading">{rupees(booking.priceBreakdown.total)}</T>} last />
        </Pane>
      </View>

      {actionError ? <Notice title="Something went wrong" body={actionError} /> : null}

      {showRescheduleSection ? (
        rescheduleEligibility.eligible ? (
          <View style={{ gap: space.breath }}>
            {hasPendingApproval ? (
              <T role="caption" tone="tertiary">You have a pending approval on this job — rescheduling won't affect it.</T>
            ) : null}
            {payment && payment.status !== "pending" && payment.status !== "completed" ? (
              <T role="caption" tone="tertiary">Payment status is {PAYMENT_STATUS_LABELS[payment.status] ?? payment.status} — rescheduling won't change this.</T>
            ) : null}
            <Button
              label="Reschedule"
              kind="quiet"
              onPress={() => router.push({ pathname: "/(tabs)/bookings/reschedule", params: { bookingId: booking.id } })}
            />
          </View>
        ) : (
          <T role="caption" tone="tertiary">{rescheduleEligibility.reason}</T>
        )
      ) : null}

      {canCancel ? (
        confirmingCancel ? (
          <Notice
            title="Cancel this booking?"
            body="This can't be undone."
            action={
              <View style={{ gap: space.breath }}>
                <Button label="Yes, cancel booking" kind="danger" busy={cancelling} onPress={() => void handleCancelConfirmed()} />
                <Button label="Keep it" kind="quiet" onPress={() => setConfirmingCancel(false)} />
              </View>
            }
          />
        ) : (
          <Button label="Cancel booking" kind="danger" onPress={() => setConfirmingCancel(true)} />
        )
      ) : null}
    </Screen>
  );
}
