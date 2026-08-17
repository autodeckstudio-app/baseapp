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
import { useLocalSearchParams } from "expo-router";
import { getBookingById, cancelBooking } from "../../../lib/booking-service";
import type { Booking } from "@autodeck/core";

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
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!id) return;
    void getBookingById(id)
      .then(setBooking)
      .catch((err: unknown) => {
        Alert.alert("Error", err instanceof Error ? err.message : "Could not load booking.");
      })
      .finally(() => setLoading(false));
  }, [id]);

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
        <Row label="Payment" value={booking.paymentStatus} />
        {booking.notes !== null && <Row label="Notes" value={booking.notes} />}
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
});
