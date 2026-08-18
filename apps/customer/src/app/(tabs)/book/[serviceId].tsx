import { useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { useAuth } from "../../../hooks/useAuth";
import { getAvailability, todayIST, type AvailableSlot } from "../../../lib/booking-service";
import type { Service, Vehicle, VehicleCategory } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
// V1 is explicitly single-studio-per-tenant (seeded once) — FIRST_STUDIO_ID
// is the correct, intentional value here, unlike tenantId which must always
// come from the authenticated user's own claims (see Phase 3G HANDOFF).
import { FIRST_STUDIO_ID } from "@autodeck/core";
import { colors, spacing, radius, typography, LoadingState, EmptyState } from "@autodeck/ui";

const VEHICLE_CATEGORIES: { value: VehicleCategory; label: string }[] = [
  { value: "hatchback", label: "Hatchback" },
  { value: "sedan", label: "Sedan" },
  { value: "suv", label: "SUV" },
  { value: "luxury", label: "Luxury / Premium" },
  { value: "van", label: "Van / MUV" },
  { value: "commercial", label: "Commercial" },
];

export default function BookServiceScreen() {
  const { serviceId } = useLocalSearchParams<{ serviceId: string }>();
  const router = useRouter();
  const auth = useAuth();

  const [service, setService] = useState<Service | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<VehicleCategory>("hatchback");
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [slotsLoading, setSlotsLoading] = useState(false);

  useEffect(() => {
    if (!serviceId || auth.status !== "ready") return;
    void (async () => {
      try {
        const [serviceSnap, vehiclesSnap] = await Promise.all([
          getDoc(doc(db, COLLECTIONS.services(), serviceId)),
          getDocs(
            query(
              collection(db, COLLECTIONS.vehicles()),
              where("ownerId", "==", auth.user.uid),
              where("tenantId", "==", auth.claims.tenantId),
              where("deletedAt", "==", null),
            ),
          ),
        ]);
        if (serviceSnap.exists()) setService(serviceSnap.data() as Service);
        const vList = vehiclesSnap.docs.map((d) => d.data() as Vehicle);
        setVehicles(vList);
        if (vList.length > 0 && vList[0]) {
          setSelectedVehicle(vList[0]);
          if (vList[0].category) setSelectedCategory(vList[0].category);
        }
      } catch (err) {
        Alert.alert("Error", err instanceof Error ? err.message : "Could not load data.");
      } finally {
        setLoading(false);
      }
    })();
  }, [serviceId, auth.status]);

  useEffect(() => {
    if (!serviceId || !service) return;
    setSlotsLoading(true);
    void getAvailability(serviceId, FIRST_STUDIO_ID, todayIST(), 7)
      .then(setSlots)
      .catch((err: unknown) => {
        Alert.alert("Slots error", err instanceof Error ? err.message : "Could not load slots.");
      })
      .finally(() => setSlotsLoading(false));
  }, [serviceId, service]);

  function handleSelectSlot(slot: AvailableSlot) {
    if (!selectedVehicle || !serviceId) {
      Alert.alert("Select vehicle", "Please select a vehicle before booking.");
      return;
    }
    router.push({
      pathname: "/(tabs)/book/confirm",
      params: {
        serviceId,
        vehicleId: selectedVehicle.id,
        vehicleCategory: selectedCategory,
        scheduledDate: slot.date,
        scheduledTime: slot.startTime,
        startAt: slot.startAt,
        estimatedEndAt: slot.estimatedEndAt,
      },
    });
  }

  if (loading) return <LoadingState />;
  if (!service) return <EmptyState title="Service not found" />;

  const slotsByDate = slots.reduce<Record<string, AvailableSlot[]>>((acc, slot) => {
    if (!acc[slot.date]) acc[slot.date] = [];
    (acc[slot.date] as AvailableSlot[]).push(slot);
    return acc;
  }, {});

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.xl }}>
      <Text style={{ ...typography.heading, color: colors.textPrimary, marginBottom: spacing.xl }}>Book {service.name}</Text>

      <Text style={sectionTitle}>Select Vehicle</Text>
      {vehicles.length === 0 ? (
        <Text style={{ ...typography.caption, color: colors.textMuted, marginBottom: spacing.lg }}>
          No vehicles found. Add a vehicle in the Cars tab first.
        </Text>
      ) : (
        <View style={{ gap: spacing.xs, marginBottom: spacing.lg }}>
          {vehicles.map((v) => {
            const selected = selectedVehicle?.id === v.id;
            return (
              <TouchableOpacity
                key={v.id}
                onPress={() => {
                  setSelectedVehicle(v);
                  if (v.category) setSelectedCategory(v.category);
                }}
                style={[chipStyle, selected && chipSelectedStyle]}
              >
                <Text style={{ ...typography.body, color: selected ? colors.white : colors.textPrimary }}>
                  {v.make} {v.model} · {v.registrationNumber}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <Text style={sectionTitle}>Vehicle Type</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginBottom: spacing.lg }}>
        {VEHICLE_CATEGORIES.map(({ value, label }) => {
          const selected = selectedCategory === value;
          return (
            <TouchableOpacity key={value} onPress={() => setSelectedCategory(value)} style={[pillStyle, selected && pillSelectedStyle]}>
              <Text style={{ ...typography.caption, color: selected ? colors.accentPressed : colors.textSecondary }}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={sectionTitle}>Available Times</Text>
      {slotsLoading ? (
        <LoadingState fill={false} />
      ) : Object.keys(slotsByDate).length === 0 ? (
        <Text style={{ ...typography.caption, color: colors.textMuted }}>No slots available in the next 7 days.</Text>
      ) : (
        Object.entries(slotsByDate).map(([date, daySlots]) => (
          <View key={date} style={{ marginBottom: spacing.lg }}>
            <Text style={{ ...typography.captionMedium, color: colors.textSecondary, marginBottom: spacing.sm }}>
              {new Date(`${date}T12:00:00Z`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
              {daySlots.map((slot) => (
                <TouchableOpacity
                  key={slot.startAt}
                  onPress={() => handleSelectSlot(slot)}
                  style={{
                    borderWidth: 1,
                    borderColor: colors.accent,
                    borderRadius: radius.md,
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.sm,
                  }}
                >
                  <Text style={{ ...typography.bodyMedium, color: colors.accent }}>{slot.startTime}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const sectionTitle = { ...typography.title, color: colors.textPrimary, marginBottom: spacing.sm } as const;
const chipStyle = {
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: radius.md,
  paddingHorizontal: spacing.md,
  paddingVertical: spacing.sm + 2,
} as const;
const chipSelectedStyle = { backgroundColor: colors.textPrimary, borderColor: colors.textPrimary } as const;
const pillStyle = {
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: radius.full,
  paddingHorizontal: spacing.md,
  paddingVertical: spacing.xs,
} as const;
const pillSelectedStyle = { backgroundColor: colors.accentMuted, borderColor: colors.accent } as const;
