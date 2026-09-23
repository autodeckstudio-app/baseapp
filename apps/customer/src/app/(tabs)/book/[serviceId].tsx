import { useState, useEffect } from "react";
import { Pressable, View } from "react-native";
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
import { space } from "@autodeck/ui/theme";
import { useExperienceTheme } from "@autodeck/ui/native";
import { Button, Chip, Kicker, Loading, Notice, Pane, Plate, Row, Screen, T } from "../../../ui/kit";

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
  const [slotsError, setSlotsError] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const { colors } = useExperienceTheme();

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
      } catch {
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [serviceId, auth.status]);

  useEffect(() => {
    if (!serviceId || !service) return;
    setSlotsLoading(true);
    setSlotsError(false);
    void getAvailability(serviceId, FIRST_STUDIO_ID, todayIST(), 7)
      .then(setSlots)
      .catch(() => setSlotsError(true))
      .finally(() => setSlotsLoading(false));
  }, [serviceId, service]);

  function handleSelectSlot(slot: AvailableSlot) {
    if (!selectedVehicle || !serviceId) return;
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
        estimatedEndDate: slot.estimatedEndDate,
        endTime: slot.endTime,
      },
    });
  }

  if (loading) return <Loading label="Finding times" />;
  if (loadError) return <Screen><Notice title="Can't open booking" body="Check your connection and try again." /></Screen>;
  if (!service) return <Screen><Notice title="Service not found" body="It may have been taken off the menu." /></Screen>;

  const slotsByDate = slots.reduce<Record<string, AvailableSlot[]>>((acc, slot) => {
    (acc[slot.date] ??= []).push(slot);
    return acc;
  }, {});

  return (
    <Screen header={<View style={{ gap: space.hair }}><Kicker tone="accent">Book</Kicker><T role="title">{service.name}</T></View>}>
      <View style={{ gap: space.line }}>
        <Kicker>1 · Car</Kicker>
        {vehicles.length === 0 ? (
          <Notice title="Add your car first" body="We price and plan the work around it." action={<Button label="Add a car" onPress={() => router.push("/(tabs)/garage/add")} />} />
        ) : (
          <Pane pad="gap">
            {vehicles.map((v, i) => {
              const selected = selectedVehicle?.id === v.id;
              return (
                <Row
                  key={v.id}
                  title={`${v.make} ${v.model}`}
                  detail={<Plate value={v.registrationNumber} />}
                  trailing={selected ? <Chip label="Selected" tone="accent" /> : null}
                  onPress={() => {
                    setSelectedVehicle(v);
                    if (v.category) setSelectedCategory(v.category);
                  }}
                  last={i === vehicles.length - 1}
                />
              );
            })}
          </Pane>
        )}
      </View>

      <View style={{ gap: space.line }}>
        <Kicker>2 · Size</Kicker>
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
      </View>

      <View style={{ gap: space.line }}>
        <Kicker>3 · Time</Kicker>
        {slotsError ? <Notice title="Can't load times" body="Check your connection and try again." /> : null}
        {slotsLoading ? (
          <T role="caption" tone="tertiary">Checking the studio's calendar...</T>
        ) : !slotsError && Object.keys(slotsByDate).length === 0 ? (
          <Notice title="Fully booked this week" body="No free times in the next 7 days. Try again tomorrow or call the studio." />
        ) : (
          Object.entries(slotsByDate).map(([date, daySlots]) => (
            <Pane key={date} pad="gap">
              <View style={{ gap: space.line }}>
                <T role="heading">{new Date(`${date}T12:00:00Z`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}</T>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.breath }}>
                  {daySlots.map((slot) => {
                    const multiDay = slot.estimatedEndDate !== slot.date;
                    return (
                      <Pressable
                        key={slot.startAt}
                        accessibilityRole="button"
                        accessibilityLabel={`Book ${slot.startTime}`}
                        disabled={!selectedVehicle}
                        onPress={() => handleSelectSlot(slot)}
                        style={({ pressed }) => ({ borderRadius: 12, borderWidth: 1, borderColor: colors.accent, paddingHorizontal: 14, paddingVertical: 10, opacity: !selectedVehicle ? 0.4 : pressed ? 0.7 : 1, minWidth: 76, alignItems: "center" })}
                      >
                        <T role="data" tone="accent">{slot.startTime}</T>
                        {multiDay ? (
                          <T role="caption" tone="tertiary">ready {new Date(`${slot.estimatedEndDate}T12:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</T>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </Pane>
          ))
        )}
      </View>
    </Screen>
  );
}
