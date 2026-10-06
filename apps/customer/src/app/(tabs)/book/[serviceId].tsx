import { useState, useEffect } from "react";
import { Pressable, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc} from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { useAuth } from "../../../hooks/useAuth";
import { listenToMyVehicles } from "../../../lib/vehicle-service";
import { getAvailability, todayIST, type AvailableSlot } from "../../../lib/booking-service";
import type { Service, Vehicle, VehicleCategory } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
// V1 is explicitly single-studio-per-tenant (seeded once) - FIRST_STUDIO_ID
// is the correct, intentional value here, unlike tenantId which must always
// come from the authenticated user's own claims (see Phase 3G HANDOFF).
import { FIRST_STUDIO_ID } from "@autodeck/core";
import { space } from "@autodeck/ui/theme";
import { useExperienceTheme } from "@autodeck/ui/native";
import { calculateServicePrice } from "../../../lib/catalogue-service";
import { ServicePhoto } from "../../../ui/ServicePhoto";
import { Button, Chip, Kicker, Loading, Notice, Pane, Plate, Row, Screen, T, rupees } from "../../../ui/kit";

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
  const [retryTick, setRetryTick] = useState(0);
  const [vehiclesError,setVehiclesError] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [total, setTotal] = useState<number | null>(null);
  const { colors } = useExperienceTheme();

  useEffect(() => {
    if (!serviceId) return;
    setTotal(null);
    void calculateServicePrice(serviceId, selectedCategory).then(({ breakdown }) => setTotal(breakdown.total)).catch(() => setTotal(null));
  }, [serviceId, selectedCategory]);

  useEffect(() => {
    if (!serviceId || auth.status !== "ready") return;
    setLoading(true); setLoadError(false);
    void (async () => {
      try {
        const serviceSnap = await getDoc(doc(db, COLLECTIONS.services(), serviceId));
        if (serviceSnap.exists()) setService(serviceSnap.data() as Service);
      } catch {
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [serviceId, auth.status, retryTick]);

  useEffect(() => {
    if (auth.status !== "ready") return;
    return listenToMyVehicles(
      auth.user.uid,
      auth.claims.tenantId,
      (list) => {
        setVehiclesError(false);
        setVehicles(list);
        setSelectedVehicle((cur) => {
          const keep = cur && list.find((v) => v.id === cur.id);
          return keep ?? list[0] ?? null;
        });
      },
      () => setVehiclesError(true),
    );
  }, [auth.status,retryTick]);

  useEffect(()=>{if(selectedVehicle?.category) setSelectedCategory(selectedVehicle.category);},[selectedVehicle?.id,selectedVehicle?.category]);

  useEffect(() => {
    if (!serviceId || !service) return;
    setSlotsLoading(true);
    setSlotsError(false);
    void getAvailability(serviceId, FIRST_STUDIO_ID, todayIST(), 7)
      .then(setSlots)
      .catch(() => setSlotsError(true))
      .finally(() => setSlotsLoading(false));
  }, [serviceId, service,retryTick]);

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
  if (loadError) return <Screen><Notice title="Can't open booking" body="Check your connection and try again." action={<Button label="Retry" onPress={()=>setRetryTick(n=>n+1)}/>} /></Screen>;
  if (!service || service.active === false) return <Screen><Notice title="Service not found" body="It may have been taken off the menu." /></Screen>;

  const slotsByDate = slots.reduce<Record<string, AvailableSlot[]>>((acc, slot) => {
    (acc[slot.date] ??= []).push(slot);
    return acc;
  }, {});

  return (
    <Screen header={<View style={{ gap: space.hair }}><Kicker tone="accent">Book</Kicker><T role="title">{service.name}</T>{service.priceOnRequest === true ? <T role="caption" tone="accent">Quote on request</T> : total !== null ? <T role="caption" tone="accent">Total {rupees(total)} incl. tax</T> : null}</View>}>
      <View style={{ borderRadius: 28, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.10)" }}><ServicePhoto service={service} aspect={16 / 9} radius={0} /><View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, ...({ backgroundImage: "linear-gradient(180deg, rgba(5,5,6,0) 50%, rgba(5,5,6,0.7) 100%)" } as object) }} /></View>
      <View style={{ gap: space.line }}>
        <Kicker>Your car</Kicker>
        {vehiclesError ? <Notice title="Can't load your cars" body="Try again before choosing a time." action={<Button label="Retry" onPress={()=>setRetryTick(n=>n+1)}/>}/> : vehicles.length === 0 ? (
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
        <Kicker>Size</Kicker>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.breath }}>
          {VEHICLE_CATEGORIES.map(({ value, label }) => {
            const selected = selectedCategory === value;
            return (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => setSelectedCategory(value)}
                style={{ borderRadius: 9999, borderWidth: 1, borderColor: selected ? colors.accent : colors.borderSubtle, backgroundColor: selected ? colors.accentHaze : "transparent", paddingHorizontal: 14, paddingVertical: 8, minHeight:44, justifyContent:"center" }}
              >
                <T role="caption" tone={selected ? "accent" : "secondary"}>{label}</T>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={{ gap: space.line }}>
        <Kicker>Pick a time</Kicker>
        {slotsError ? <Notice title="Can't load times" body="Check your connection and try again." action={<Button label="Retry" onPress={()=>setRetryTick(n=>n+1)}/>} /> : null}
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
                        disabled={!selectedVehicle || vehiclesError}
                        onPress={() => handleSelectSlot(slot)}
                        style={({ pressed }) => ({ borderRadius: 9999, borderWidth: 1, borderColor: "rgba(245,154,69,0.55)", backgroundColor: "rgba(245,154,69,0.12)", paddingHorizontal: 16, paddingVertical: 10, opacity: !selectedVehicle ? 0.4 : pressed ? 0.7 : 1, minWidth: 76, minHeight:44, justifyContent:"center", alignItems: "center" })}
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
