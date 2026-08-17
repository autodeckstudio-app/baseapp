import { useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import type { Service, VehicleCategory, PriceBreakdown as PriceBreakdownData } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { colors, spacing, radius, typography, Button, PriceBreakdown, LoadingState, ErrorState } from "@autodeck/ui";
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

export default function ServiceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [service, setService] = useState<Service | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<VehicleCategory>("hatchback");
  const [priceBreakdown, setPriceBreakdown] = useState<PriceBreakdownData | null>(null);
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

  if (loading) return <LoadingState />;
  if (!service) return <ErrorState title="Service not found" />;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.xl }}>
      <Text style={{ ...typography.label, color: colors.textMuted }}>{service.category.toUpperCase()}</Text>
      <Text style={{ ...typography.heading, color: colors.textPrimary, marginTop: spacing.xxs }}>{service.name}</Text>
      {service.brand !== null && (
        <Text style={{ ...typography.caption, color: colors.textSecondary, marginTop: spacing.xxs }}>{service.brand}</Text>
      )}
      <Text style={{ ...typography.body, color: colors.textSecondary, marginTop: spacing.md, lineHeight: 22 }}>
        {service.description}
      </Text>

      {service.warrantyLabel !== null && (
        <View
          style={{
            backgroundColor: colors.successMuted,
            borderRadius: radius.sm,
            paddingHorizontal: spacing.sm,
            paddingVertical: spacing.xxs,
            alignSelf: "flex-start",
            marginTop: spacing.md,
          }}
        >
          <Text style={{ ...typography.caption, color: colors.success }}>{service.warrantyLabel}</Text>
        </View>
      )}

      <Text style={{ ...typography.caption, color: colors.textMuted, marginTop: spacing.md }}>
        Duration: ~{service.estimatedDurationMinutes} min
      </Text>

      <Text style={{ ...typography.title, color: colors.textPrimary, marginTop: spacing.xl, marginBottom: spacing.md }}>
        Price for your vehicle
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginBottom: spacing.lg }}>
        {VEHICLE_CATEGORIES.map(({ value, label }) => {
          const selected = selectedCategory === value;
          return (
            <TouchableOpacity
              key={value}
              onPress={() => setSelectedCategory(value)}
              style={{
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.xs + 2,
                borderRadius: radius.full,
                borderWidth: 1,
                borderColor: selected ? colors.accent : colors.border,
                backgroundColor: selected ? colors.accentMuted : colors.surface,
              }}
            >
              <Text style={{ ...typography.caption, color: selected ? colors.accentPressed : colors.textSecondary }}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {priceLoading ? (
        <LoadingState fill={false} />
      ) : priceBreakdown !== null ? (
        <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg }}>
          <PriceBreakdown breakdown={priceBreakdown} />
        </View>
      ) : null}

      <View style={{ height: spacing.xl }} />
      <Button label="Book This Service" onPress={() => router.push(`/(tabs)/book/${id}`)} />
    </ScrollView>
  );
}
