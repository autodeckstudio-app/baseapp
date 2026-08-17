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
import { getAuth } from "firebase/auth";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { getAvailability, todayIST, type AvailableSlot } from "../../../lib/booking-service";
import type { Service, Vehicle, VehicleCategory } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { FIRST_STUDIO_ID, FIRST_TENANT_ID } from "@autodeck/core";

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
  const auth = getAuth();

  const [service, setService] = useState<Service | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<VehicleCategory>("hatchback");
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [slotsLoading, setSlotsLoading] = useState(false);

  useEffect(() => {
    if (!serviceId) return;
    void (async () => {
      try {
        const uid = auth.currentUser?.uid;
        if (!uid) return;
        const [serviceSnap, vehiclesSnap] = await Promise.all([
          getDoc(doc(db, COLLECTIONS.services(), serviceId)),
          getDocs(
            query(
              collection(db, COLLECTIONS.vehicles()),
              where("ownerId", "==", uid),
              where("tenantId", "==", FIRST_TENANT_ID),
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
  }, [serviceId]);

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

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!service) {
    return (
      <View style={styles.centered}>
        <Text>Service not found.</Text>
      </View>
    );
  }

  // Group slots by date
  const slotsByDate = slots.reduce<Record<string, AvailableSlot[]>>((acc, slot) => {
    if (!acc[slot.date]) acc[slot.date] = [];
    (acc[slot.date] as AvailableSlot[]).push(slot);
    return acc;
  }, {});

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Book {service.name}</Text>

      {/* Vehicle picker */}
      <Text style={styles.sectionTitle}>Select Vehicle</Text>
      {vehicles.length === 0 ? (
        <Text style={styles.hint}>
          No vehicles found. Add a vehicle in the Cars tab first.
        </Text>
      ) : (
        <View style={styles.vehicleList}>
          {vehicles.map((v) => (
            <TouchableOpacity
              key={v.id}
              style={[styles.vehicleChip, selectedVehicle?.id === v.id && styles.chipSelected]}
              onPress={() => {
                setSelectedVehicle(v);
                if (v.category) setSelectedCategory(v.category);
              }}
            >
              <Text
                style={[
                  styles.vehicleChipText,
                  selectedVehicle?.id === v.id && styles.chipTextSelected,
                ]}
              >
                {v.make} {v.model} · {v.registrationNumber}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Vehicle category picker */}
      <Text style={styles.sectionTitle}>Vehicle Type</Text>
      <View style={styles.categoryRow}>
        {VEHICLE_CATEGORIES.map(({ value, label }) => (
          <TouchableOpacity
            key={value}
            style={[styles.catChip, selectedCategory === value && styles.chipSelected]}
            onPress={() => setSelectedCategory(value)}
          >
            <Text
              style={[styles.catChipText, selectedCategory === value && styles.chipTextSelected]}
            >
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Slot picker */}
      <Text style={styles.sectionTitle}>Available Times</Text>
      {slotsLoading ? (
        <ActivityIndicator style={{ marginTop: 16 }} />
      ) : Object.keys(slotsByDate).length === 0 ? (
        <Text style={styles.hint}>No slots available in the next 7 days.</Text>
      ) : (
        Object.entries(slotsByDate).map(([date, daySlots]) => (
          <View key={date} style={styles.dayGroup}>
            <Text style={styles.dayHeading}>
              {new Date(`${date}T12:00:00Z`).toLocaleDateString("en-IN", {
                weekday: "long",
                day: "numeric",
                month: "short",
              })}
            </Text>
            <View style={styles.slotRow}>
              {daySlots.map((slot) => (
                <TouchableOpacity
                  key={slot.startAt}
                  style={styles.slotChip}
                  onPress={() => handleSelectSlot(slot)}
                >
                  <Text style={styles.slotTime}>{slot.startTime}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  content: { padding: 20 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  heading: { fontSize: 22, fontWeight: "700", marginBottom: 24 },
  sectionTitle: { fontSize: 15, fontWeight: "600", marginBottom: 10, marginTop: 8 },
  hint: { color: "#888", fontSize: 14, marginBottom: 16 },
  vehicleList: { gap: 8, marginBottom: 16 },
  vehicleChip: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  chipSelected: { backgroundColor: "#1a1a1a", borderColor: "#1a1a1a" },
  vehicleChipText: { fontSize: 14, color: "#333" },
  chipTextSelected: { color: "#fff" },
  categoryRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  catChip: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  catChipText: { fontSize: 13, color: "#555" },
  dayGroup: { marginBottom: 20 },
  dayHeading: { fontSize: 14, fontWeight: "600", color: "#444", marginBottom: 10 },
  slotRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  slotChip: {
    borderWidth: 1,
    borderColor: "#1a1a1a",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  slotTime: { fontSize: 14, fontWeight: "600", color: "#1a1a1a" },
});
