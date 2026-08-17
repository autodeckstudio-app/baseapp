import { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { getBookingById, cancelBooking } from "../../../lib/booking-service";
import { listenToJobForBooking } from "../../../lib/job-service";
import { listenToPaymentForJob, initiatePayment } from "../../../lib/payment-service";
import type { Booking, ServiceJob, Payment } from "@autodeck/core";

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

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending confirmation",
  CONFIRMED: "Confirmed",
  ACTIVE: "Vehicle at studio",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
};

function formatPrice(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 0 })}`;
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

  async function handleCancel() {
    if (!booking || !id) return;
    Alert.alert(
      "Cancel Booking",
      "Are you sure you want to cancel this booking?",
      [
        { text: "Keep It", style: "cancel" },
        {
          text: "Cancel Booking",
          style: "destructive",
          onPress: async () => {
            setCancelling(true);
            try {
              await cancelBooking(id, "Cancelled by customer");
              setBooking((prev) =>
                prev ? { ...prev, status: "CANCELLED" } : prev,
              );
            } catch (err) {
              Alert.alert(
                "Cannot cancel",
                err instanceof Error ? err.message : "Cancellation failed.",
              );
            } finally {
              setCancelling(false);
            }
          },
        },
      ],
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!booking) {
    return (
      <View style={styles.centered}>
        <Text>Booking not found.</Text>
      </View>
    );
  }

  const statusLabel = STATUS_LABELS[booking.status] ?? booking.status;
  const canCancel = booking.status === "CONFIRMED" || booking.status === "PENDING";
  const canPay =
    booking.paymentStatus === "unpaid" && booking.status !== "CANCELLED" && booking.status !== "EXPIRED";

  const scheduledAt = new Date(booking.scheduledAt);
  const displayDate = scheduledAt.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const displayTime = scheduledAt.toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const { priceBreakdown: pb } = booking;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.status}>{statusLabel}</Text>

      <View style={styles.section}>
        <Row label="Date" value={displayDate} />
        <Row label="Time" value={`${displayTime} IST`} />
        <Row label="Duration" value={`~${booking.durationMinutes} min`} />
        {booking.notes !== null && <Row label="Notes" value={booking.notes} />}
      </View>

      {job && (
        <View style={styles.jobBox}>
          <Text style={styles.jobLabel}>Studio status</Text>
          <Text style={styles.jobStatus}>{JOB_STATUS_LABELS[job.status] ?? job.status}</Text>
        </View>
      )}

      <Text style={styles.sectionTitle}>Payment</Text>
      <View style={styles.section}>
        <Row label="Status" value={payment ? PAYMENT_STATUS_LABELS[payment.status] ?? payment.status : "Not yet initiated"} />
        {payment?.invoiceId && job && (
          <TouchableOpacity
            style={styles.invoiceLink}
            onPress={() =>
              router.push({
                pathname: "/(tabs)/bookings/invoice",
                params: { jobId: job.id, tenantId: job.tenantId, customerId: job.customerId },
              })
            }
          >
            <Text style={styles.invoiceLinkText}>View invoice</Text>
          </TouchableOpacity>
        )}
        {canPay && !payment && job && (
          <TouchableOpacity
            style={[styles.payButton, payingNow && styles.disabled]}
            onPress={() => void handlePayAtStudio()}
            disabled={payingNow}
          >
            {payingNow ? <ActivityIndicator color="#fff" /> : <Text style={styles.payButtonText}>Pay at studio</Text>}
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.sectionTitle}>Price Breakdown</Text>
      <View style={styles.section}>
        <Row label="Base price" value={formatPrice(pb.basePrice)} />
        {pb.scopeAdjustment > 0 && (
          <Row label="Vehicle adjustment" value={`+${formatPrice(pb.scopeAdjustment)}`} />
        )}
        <Row label={pb.taxDescription} value={formatPrice(pb.tax)} />
        <View style={styles.divider} />
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{formatPrice(booking.totalAmount)}</Text>
        </View>
      </View>

      {canCancel && (
        <TouchableOpacity
          style={[styles.cancelButton, cancelling && styles.disabled]}
          onPress={() => void handleCancel()}
          disabled={cancelling}
        >
          {cancelling ? (
            <ActivityIndicator color="#c00" />
          ) : (
            <Text style={styles.cancelButtonText}>Cancel Booking</Text>
          )}
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  content: { padding: 20 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  status: { fontSize: 24, fontWeight: "700", marginBottom: 20 },
  sectionTitle: { fontSize: 15, fontWeight: "600", marginBottom: 10, marginTop: 8 },
  section: {
    backgroundColor: "#f8f8f8",
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
    gap: 10,
  },
  row: { flexDirection: "row", justifyContent: "space-between" },
  rowLabel: { color: "#888", fontSize: 14 },
  rowValue: { color: "#333", fontSize: 14, fontWeight: "500", maxWidth: "60%", textAlign: "right" },
  divider: { height: 1, backgroundColor: "#e0e0e0", marginVertical: 4 },
  totalRow: { flexDirection: "row", justifyContent: "space-between" },
  totalLabel: { fontSize: 16, fontWeight: "700" },
  totalValue: { fontSize: 16, fontWeight: "700" },
  cancelButton: {
    borderWidth: 1,
    borderColor: "#c00",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  cancelButtonText: { color: "#c00", fontWeight: "600", fontSize: 15 },
  disabled: { opacity: 0.5 },
  jobBox: { backgroundColor: "#e3f2fd", borderRadius: 10, padding: 14, marginBottom: 16 },
  jobLabel: { fontSize: 12, color: "#1565c0" },
  jobStatus: { fontSize: 15, fontWeight: "700", color: "#0d47a1", marginTop: 2 },
  invoiceLink: { alignSelf: "flex-start" },
  invoiceLinkText: { color: "#1a1a1a", fontWeight: "700", textDecorationLine: "underline" },
  payButton: { backgroundColor: "#1a1a1a", borderRadius: 8, paddingVertical: 12, alignItems: "center", marginTop: 4 },
  payButtonText: { color: "#fff", fontWeight: "700" },
});
