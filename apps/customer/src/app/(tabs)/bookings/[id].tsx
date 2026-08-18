import { useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { getBookingById, cancelBooking } from "../../../lib/booking-service";
import { listenToJobForBooking } from "../../../lib/job-service";
import { listenToPaymentForJob, initiatePayment } from "../../../lib/payment-service";
import { listenToApprovalsForJob } from "../../../lib/approval-service";
import type { Booking, ServiceJob, Payment, ApprovalRequest } from "@autodeck/core";
import { MAX_CUSTOMER_RESCHEDULES, CANCELLATION_FREE_WINDOW_HOURS } from "@autodeck/core";
import {
  colors,
  spacing,
  radius,
  typography,
  Button,
  StatusBadge,
  statusTone,
  PriceBreakdown,
  LoadingState,
  ErrorState,
  formatPaise,
} from "@autodeck/ui";

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

const NON_RESCHEDULABLE_STATUS_REASONS: Record<string, string> = {
  PENDING: "This booking is still awaiting studio confirmation.",
  ACTIVE: "Your vehicle is already at the studio — contact the studio to change the schedule.",
  COMPLETED: "This booking is already completed.",
  CANCELLED: "This booking has been cancelled.",
  EXPIRED: "This booking has expired.",
};

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
  const [job, setJob] = useState<ServiceJob | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [payingNow, setPayingNow] = useState(false);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);

  useEffect(() => {
    if (!id) return;
    void getBookingById(id)
      .then(setBooking)
      .catch((err: unknown) => {
        Alert.alert("Error", err instanceof Error ? err.message : "Could not load booking.");
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!id || !booking) return;
    return listenToJobForBooking(id, booking.tenantId, booking.customerId, setJob, () => undefined);
  }, [id, booking?.tenantId, booking?.customerId]);

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
    try {
      await initiatePayment(job.id, "cash");
      Alert.alert("Payment requested", "Pay the studio team in person — your status will update once confirmed.");
    } catch (err) {
      Alert.alert("Couldn't start payment", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setPayingNow(false);
    }
  }

  function handleCancel() {
    if (!booking || !id) return;
    Alert.alert("Cancel Booking", "Are you sure you want to cancel this booking?", [
      { text: "Keep It", style: "cancel" },
      {
        text: "Cancel Booking",
        style: "destructive",
        onPress: async () => {
          setCancelling(true);
          try {
            await cancelBooking(id, "Cancelled by customer");
            setBooking((prev) => (prev ? { ...prev, status: "CANCELLED" } : prev));
          } catch (err) {
            Alert.alert("Cannot cancel", err instanceof Error ? err.message : "Cancellation failed.");
          } finally {
            setCancelling(false);
          }
        },
      },
    ]);
  }

  if (loading) return <LoadingState />;
  if (!booking) return <ErrorState title="Booking not found" />;

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

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.xl }}>
      <StatusBadge label={BOOKING_STATUS_LABELS[booking.status] ?? booking.status} tone={statusTone(booking.status)} />
      <Text style={{ ...typography.heading, color: colors.textPrimary, marginTop: spacing.sm, marginBottom: spacing.lg }}>
        {displayDate}
      </Text>

      <Section>
        <Row label="Time" value={`${displayTime} IST`} />
        <Row label="Duration" value={`~${booking.durationMinutes} min`} />
        {booking.notes !== null && <Row label="Notes" value={booking.notes} />}
      </Section>

      {job && (
        <View style={{ backgroundColor: colors.accentMuted, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.lg }}>
          <Text style={{ ...typography.caption, color: colors.accentPressed }}>Studio status</Text>
          <Text style={{ ...typography.title, color: colors.accentPressed, marginTop: spacing.xxs }}>
            {JOB_STATUS_LABELS[job.status] ?? job.status}
          </Text>
        </View>
      )}

      {approvals
        .filter((a) => a.status === "pending")
        .map((a) => (
          <TouchableOpacity
            key={a.id}
            onPress={() => router.push(`/(tabs)/approvals/${a.id}`)}
            style={{ backgroundColor: colors.warningMuted, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.lg }}
          >
            <Text style={{ ...typography.caption, color: colors.warning }}>Approval needed</Text>
            <Text style={{ ...typography.title, color: colors.warning, marginTop: spacing.xxs }}>
              {a.serviceName} (+{formatPaise(a.priceImpact)}) — tap to review
            </Text>
          </TouchableOpacity>
        ))}

      {job && job.additionalWorkDelta > 0 && (
        <View style={{ backgroundColor: colors.successMuted, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.lg }}>
          <Text style={{ ...typography.caption, color: colors.success }}>Approved additional work</Text>
          <Text style={{ ...typography.title, color: colors.success, marginTop: spacing.xxs }}>
            +{formatPaise(job.additionalWorkDelta)} — current total {formatPaise(job.totalAmount)}
          </Text>
        </View>
      )}

      <Text style={sectionTitle}>Payment</Text>
      <Section>
        <Row label="Status" value={payment ? PAYMENT_STATUS_LABELS[payment.status] ?? payment.status : "Not yet initiated"} />
        {payment?.invoiceId && job && (
          <Button
            label="View invoice"
            variant="ghost"
            size="md"
            fullWidth={false}
            onPress={() => router.push({ pathname: "/(tabs)/bookings/invoice", params: { jobId: job.id, tenantId: job.tenantId, customerId: job.customerId } })}
          />
        )}
        {canPay && !payment && job && (
          <Button label="Pay at studio" onPress={() => void handlePayAtStudio()} loading={payingNow} size="md" />
        )}
      </Section>

      <Text style={sectionTitle}>Price Breakdown</Text>
      <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.lg }}>
        <PriceBreakdown breakdown={booking.priceBreakdown} />
      </View>

      {showRescheduleSection && (
        <View style={{ marginBottom: spacing.lg }}>
          {rescheduleEligibility.eligible ? (
            <>
              {hasPendingApproval && (
                <Text style={{ ...typography.caption, color: colors.textMuted, marginBottom: spacing.sm }}>
                  Note: you have a pending approval on this job — rescheduling won't affect it.
                </Text>
              )}
              {payment && payment.status !== "pending" && payment.status !== "completed" && (
                <Text style={{ ...typography.caption, color: colors.textMuted, marginBottom: spacing.sm }}>
                  Note: payment status is {PAYMENT_STATUS_LABELS[payment.status] ?? payment.status} — rescheduling won't change this.
                </Text>
              )}
              <Button
                label="Reschedule"
                variant="secondary"
                onPress={() => router.push({ pathname: "/(tabs)/bookings/reschedule", params: { bookingId: booking.id } })}
              />
            </>
          ) : (
            <Text style={{ ...typography.caption, color: colors.textMuted }}>{rescheduleEligibility.reason}</Text>
          )}
        </View>
      )}

      {canCancel && (
        <Button label="Cancel Booking" onPress={handleCancel} loading={cancelling} variant="destructive" />
      )}
    </ScrollView>
  );
}

const sectionTitle = { ...typography.title, color: colors.textPrimary, marginBottom: spacing.sm, marginTop: spacing.sm } as const;

function Section({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.lg, gap: spacing.sm }}>
      {children}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
      <Text style={{ ...typography.body, color: colors.textMuted }}>{label}</Text>
      <Text style={{ ...typography.bodyMedium, color: colors.textPrimary, maxWidth: "60%", textAlign: "right" }}>{value}</Text>
    </View>
  );
}
