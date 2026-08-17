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
import { doc, getDoc } from "firebase/firestore";
import type { Service, VehicleCategory, PriceBreakdown } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { db } from "../../../lib/firebase";
import { calculateServicePrice } from "../../../lib/catalogue-service";

const VEHICLE_CATEGORIES: { value: VehicleCategory; label: string }[] = [
  { value: "hatchback", label: "Hatchback" },
  { value: "sedan", label: "Sedan" },
  { value: "suv", label: "SUV" },
  { value: "luxury", label: "Luxury / Premium" },
  { value: "van", label: "Van / MUV" },
  { value: "commercial", label: "Commercial" },
];

function formatPrice(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default function ServiceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [service, setService] = useState<Service | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<VehicleCategory>("hatchback");
  const [priceBreakdown, setPriceBreakdown] = useState<PriceBreakdown | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      try {
        const snap = await getDoc(doc(db, COLLECTIONS.services(), id));
        if (snap.exists()) setService(snap.data() as Service);
      } catch (err) {
        Alert.alert("Error", err instanceof Error ? err.message : "Could not load service.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  useEffect(() => {
    if (!id || !service) return;
    setPriceLoading(true);
    void calculateServicePrice(id, selectedCategory)
      .then(({ breakdown }) => setPriceBreakdown(breakdown))
      .catch((err: unknown) => {
        Alert.alert("Price error", err instanceof Error ? err.message : "Could not get price.");
      })
      .finally(() => setPriceLoading(false));
  }, [id, service, selectedCategory]);

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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.category}>{service.category.toUpperCase()}</Text>
      <Text style={styles.name}>{service.name}</Text>
      {service.brand !== null && <Text style={styles.brand}>{service.brand}</Text>}
      <Text style={styles.description}>{service.description}</Text>

      {service.warrantyLabel !== null && (
        <View style={styles.warrantyBadge}>
          <Text style={styles.warrantyText}>{service.warrantyLabel}</Text>
        </View>
      )}

      <Text style={styles.duration}>
        Duration: ~{service.estimatedDurationMinutes} min
      </Text>

      <Text style={styles.sectionHeading}>Price for your vehicle</Text>
      <View style={styles.categoryPicker}>
        {VEHICLE_CATEGORIES.map(({ value, label }) => (
          <TouchableOpacity
            key={value}
            style={[styles.chip, selectedCategory === value && styles.chipSelected]}
            onPress={() => setSelectedCategory(value)}
          >
            <Text
              style={[styles.chipText, selectedCategory === value && styles.chipTextSelected]}
            >
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {priceLoading ? (
        <ActivityIndicator style={styles.priceLoader} />
      ) : priceBreakdown !== null ? (
        <View style={styles.priceCard}>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Base price</Text>
            <Text style={styles.priceValue}>{formatPrice(priceBreakdown.basePrice)}</Text>
          </View>
          {priceBreakdown.scopeAdjustment > 0 && (
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Vehicle adjustment</Text>
              <Text style={styles.priceValue}>+{formatPrice(priceBreakdown.scopeAdjustment)}</Text>
            </View>
          )}
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>{priceBreakdown.taxDescription}</Text>
            <Text style={styles.priceValue}>{formatPrice(priceBreakdown.tax)}</Text>
          </View>
          <View style={[styles.priceRow, styles.priceRowTotal]}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{formatPrice(priceBreakdown.total)}</Text>
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  content: { padding: 24 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  category: { fontSize: 11, letterSpacing: 1.5, color: "#888", marginBottom: 4 },
  name: { fontSize: 26, fontWeight: "700", marginBottom: 4 },
  brand: { fontSize: 14, color: "#555", marginBottom: 12 },
  description: { fontSize: 15, color: "#444", lineHeight: 22, marginBottom: 16 },
  warrantyBadge: {
    backgroundColor: "#e8f0fe",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: "flex-start",
    marginBottom: 12,
  },
  warrantyText: { fontSize: 12, color: "#4a90d9" },
  duration: { fontSize: 14, color: "#666", marginBottom: 24 },
  sectionHeading: { fontSize: 15, fontWeight: "600", marginBottom: 12 },
  categoryPicker: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "#fff",
  },
  chipSelected: { backgroundColor: "#1a1a1a", borderColor: "#1a1a1a" },
  chipText: { fontSize: 13, color: "#555" },
  chipTextSelected: { color: "#fff" },
  priceLoader: { marginTop: 16 },
  priceCard: {
    backgroundColor: "#f8f8f8",
    borderRadius: 10,
    padding: 16,
    gap: 10,
  },
  priceRow: { flexDirection: "row", justifyContent: "space-between" },
  priceRowTotal: { borderTopWidth: 1, borderTopColor: "#e0e0e0", paddingTop: 10, marginTop: 4 },
  priceLabel: { color: "#555", fontSize: 14 },
  priceValue: { color: "#333", fontSize: 14 },
  totalLabel: { fontWeight: "700", fontSize: 16 },
  totalValue: { fontWeight: "700", fontSize: 16 },
});
