import { useState, useEffect } from "react";
import { View, Text, ScrollView, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { createBooking, generateIdempotencyKey } from "../../../lib/booking-service";
import { calculateServicePrice } from "../../../lib/catalogue-service";
import type { Service, Vehicle, VehicleCategory, PriceBreakdown as PriceBreakdownData } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { FIRST_STUDIO_ID } from "@autodeck/core";
import { colors, spacing, radius, typography, Button, PriceBreakdown, LoadingState, ListRow } from "@autodeck/ui";

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
  const [breakdown, setBreakdown] = useState<PriceBreakdownData | null>(null);
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

  if (loading) return <LoadingState />;

  const displayDate =
    params.scheduledDate &&
    new Date(`${params.scheduledDate}T12:00:00Z`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.xl }}>
      <Text style={{ ...typography.heading, color: colors.textPrimary, marginBottom: spacing.xl }}>Confirm Booking</Text>

      <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.lg }}>
        <ListRow label="Service" value={service?.name ?? "—"} />
        <ListRow label="Vehicle" value={vehicle ? `${vehicle.make} ${vehicle.model}` : "—"} />
        <ListRow label="Reg." value={vehicle?.registrationNumber ?? "—"} />
        <ListRow label="Date" value={displayDate ?? "—"} />
        <ListRow label="Time" value={params.scheduledTime ? `${params.scheduledTime} IST` : "—"} />
        <ListRow label="Duration" value={service ? `~${service.estimatedDurationMinutes} min` : "—"} />
      </View>

      {breakdown !== null && (
        <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.lg }}>
          <PriceBreakdown breakdown={breakdown} baseLabel="Base" />
        </View>
      )}

      <Text style={{ ...typography.caption, color: colors.textMuted, textAlign: "center", marginBottom: spacing.xl }}>
        Payment is collected at the studio. Price may vary based on final work.
      </Text>

      <Button label="Confirm Booking" onPress={() => void handleConfirm()} loading={booking} />
      <View style={{ height: spacing.sm }} />
      <Button label="Go back" onPress={() => router.back()} variant="ghost" />
    </ScrollView>
  );
}
