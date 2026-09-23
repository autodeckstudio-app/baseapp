import { useState, useEffect } from "react";
import { Pressable, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import type { Service, VehicleCategory, PriceBreakdown as PriceBreakdownData } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { space } from "@autodeck/ui/theme";
import { useExperienceTheme } from "@autodeck/ui/native";
import { Button, Chip, Kicker, Loading, Notice, Pane, Row, Screen, T, rupees } from "../../../ui/kit";
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
  const { colors } = useExperienceTheme();
  const [service, setService] = useState<Service | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<VehicleCategory>("hatchback");
  const [priceBreakdown, setPriceBreakdown] = useState<PriceBreakdownData | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [priceError, setPriceError] = useState(false);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      try {
        const snap = await getDoc(doc(db, COLLECTIONS.services(), id));
        if (snap.exists()) setService(snap.data() as Service);
      } catch {
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  useEffect(() => {
    if (!id || !service) return;
    setPriceLoading(true);
    setPriceError(false);
    void calculateServicePrice(id, selectedCategory)
      .then(({ breakdown }) => setPriceBreakdown(breakdown))
      .catch(() => setPriceError(true))
      .finally(() => setPriceLoading(false));
  }, [id, service, selectedCategory]);

  if (loading) return <Loading label="Opening the menu" />;
  if (loadError) return <Screen><Notice title="Can't load this service" body="Check your connection and try again." /></Screen>;
  if (!service) return <Screen><Notice title="Service not found" body="It may have been taken off the menu." /></Screen>;

  return (
    <Screen
      header={
        <View style={{ gap: space.hair }}>
          <Kicker tone="accent">{service.category}</Kicker>
          <T role="title">{service.name}</T>
          {service.brand !== null ? <T role="caption" tone="secondary">{service.brand}</T> : null}
        </View>
      }
    >
      <T tone="secondary">{service.description}</T>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.breath, alignItems: "center" }}>
        {service.warrantyLabel !== null ? <Chip label={service.warrantyLabel} tone="premium" /> : null}
        <T role="caption" tone="tertiary">~{service.estimatedDurationMinutes} min</T>
      </View>

      <View style={{ gap: space.line }}>
        <Kicker>Price for your car</Kicker>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.breath }}>
          {VEHICLE_CATEGORIES.map(({ value, label }) => {
            const selected = selectedCategory === value;
            return (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => setSelectedCategory(value)}
                style={{ borderRadius: 9999, borderWidth: 1, borderColor: selected ? colors.accent : colors.borderSubtle, backgroundColor: selected ? colors.accentHaze : "transparent", paddingHorizontal: 14, paddingVertical: 8 }}
              >
                <T role="caption" tone={selected ? "accent" : "secondary"}>{label}</T>
              </Pressable>
            );
          })}
        </View>

        {priceLoading ? (
          <T role="caption" tone="tertiary">Working out the price...</T>
        ) : priceError ? (
          <Notice title="Can't get the price" body="Check your connection and try again." />
        ) : priceBreakdown !== null ? (
          <Pane pad="gap">
            <Row title="Base" trailing={<T role="data">{rupees(priceBreakdown.basePrice)}</T>} />
            {priceBreakdown.scopeAdjustment > 0 ? (
              <Row title="Vehicle size adjustment" trailing={<T role="data">+{rupees(priceBreakdown.scopeAdjustment)}</T>} />
            ) : null}
            {priceBreakdown.addOns.map((addOn) => (
              <Row key={addOn.id} title={addOn.name} trailing={<T role="data">{rupees(addOn.price)}</T>} />
            ))}
            {priceBreakdown.membershipDiscount !== null && priceBreakdown.membershipDiscount > 0 ? (
              <Row title="Membership discount" trailing={<T role="data" tone="premium">-{rupees(priceBreakdown.membershipDiscount)}</T>} />
            ) : null}
            <Row title={priceBreakdown.taxDescription} trailing={<T role="data">{rupees(priceBreakdown.tax)}</T>} />
            <Row title={<T role="heading">Total</T>} trailing={<T role="heading">{rupees(priceBreakdown.total)}</T>} last />
          </Pane>
        ) : null}
      </View>

      <Button label="Book this service" onPress={() => router.push(`/(tabs)/book/${id}`)} />
    </Screen>
  );
}
