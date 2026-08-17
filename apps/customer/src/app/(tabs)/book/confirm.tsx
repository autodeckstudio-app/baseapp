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
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { createBooking, generateIdempotencyKey } from "../../../lib/booking-service";
import { calculateServicePrice } from "../../../lib/catalogue-service";
import type { Service, Vehicle, VehicleCategory, PriceBreakdown } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { FIRST_STUDIO_ID } from "@autodeck/core";

function formatPrice(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 0 })}`;
}

export default function BookingConfirmScreen() {
  const params = useLocalSearchParams<{
    serviceId: string;
    vehicleId: string;
    vehicleCategory: VehicleCategory;
    scheduledDate: string;
    scheduledTime: string;
    startAt: string;
    estimatedEndAt: string;
  }>();
  const router = useRouter();

  const [service, setService] = useState<Service | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [breakdown, setBreakdown] = useState<PriceBreakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [idempotencyKey] = useState(() => generateIdempotencyKey());

  useEffect(() => {
    if (!params.serviceId || !params.vehicleId || !params.vehicleCategory) return;
    void (async () => {
      try {
        const [serviceSnap, vehicleSnap, priceResult] = await Promise.all([
          getDoc(doc(db, COLLECTIONS.services(), params.serviceId)),
          getDoc(doc(db, COLLECTIONS.vehicles(), params.vehicleId)),
          calculateServicePrice(params.serviceId, params.vehicleCategory),
        ]);
        if (serviceSnap.exists()) setService(serviceSnap.data() as Service);
        if (vehicleSnap.exists()) setVehicle(vehicleSnap.data() as Vehicle);
        setBreakdown(priceResult.breakdown);
      } catch (err) {
        Alert.alert("Error", err instanceof Error ? err.message : "Could not load details.");
      } finally {
        setLoading(false);
      }
    })();
  }, [params.serviceId, params.vehicleId, params.vehicleCategory]);

  async function handleConfirm() {
    if (!params.serviceId || !params.vehicleId || !params.vehicleCategory || !params.scheduledDate || !params.scheduledTime) return;
    setBooking(true);
    try {
      const result = await createBooking({
        serviceId: params.serviceId,
        vehicleId: params.vehicleId,
        vehicleCategory: params.vehicleCategory,
        studioId: FIRST_STUDIO_ID,
        scheduledDate: params.scheduledDate,
        scheduledTime: params.scheduledTime,
        idempotencyKey,
      });
      router.replace(`/(tabs)/bookings/${result.id}`);
    } catch (err) {
      Alert.alert("Booking failed", err instanceof Error ? err.message : "Could not create booking. Please try again.");
    } finally {
      setBooking(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const displayDate =
    params.scheduledDate &&
    new Date(`${params.scheduledDate}T12:00:00Z`).toLocaleDateString("en-IN", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Confirm Booking</Text>

      <View style={styles.section}>
        <Row label="Service" value={service?.name ?? "—"} />
        <Row label="Vehicle" value={vehicle ? `${vehicle.make} ${vehicle.model}` : "—"} />
        <Row label="Reg." value={vehicle?.registrationNumber ?? "—"} />
        <Row label="Date" value={displayDate ?? "—"} />
        <Row label="Time" value={params.scheduledTime ? `${params.scheduledTime} IST` : "—"} />
        <Row label="Duration" value={service ? `~${service.estimatedDurationMinutes} min` : "—"} />
      </View>

      {breakdown !== null && (
        <>
          <Text style={styles.sectionTitle}>Price</Text>
          <View style={styles.section}>
            <Row label="Base" value={formatPrice(breakdown.basePrice)} />
            {breakdown.scopeAdjustment > 0 && (
              <Row label="Vehicle adj." value={`+${formatPrice(breakdown.scopeAdjustment)}`} />
            )}
            <Row label={breakdown.taxDescription} value={formatPrice(breakdown.tax)} />
            <View style={styles.divider} />
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>{formatPrice(breakdown.total)}</Text>
            </View>
          </View>
        </>
      )}

      <Text style={styles.note}>
        Payment is collected at the studio. Price may vary based on final work.
      </Text>

      <TouchableOpacity
        style={[styles.confirmButton, booking && styles.disabled]}
        onPress={() => void handleConfirm()}
        disabled={booking}
      >
        {booking ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.confirmButtonText}>Confirm Booking</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={styles.cancelLink} onPress={() => router.back()}>
        <Text style={styles.cancelLinkText}>Go back</Text>
      </TouchableOpacity>
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
  heading: { fontSize: 24, fontWeight: "700", marginBottom: 24 },
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
  note: { fontSize: 13, color: "#888", textAlign: "center", marginBottom: 24 },
  confirmButton: {
    backgroundColor: "#1a1a1a",
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  confirmButtonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  disabled: { opacity: 0.5 },
  cancelLink: { alignItems: "center", paddingVertical: 10 },
  cancelLinkText: { color: "#888", fontSize: 15 },
});
