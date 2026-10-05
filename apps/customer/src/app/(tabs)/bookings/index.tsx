// Bookings: what's coming first, then history.
import { useCallback, useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { isBookingMissed, type Booking } from "@autodeck/core";
import { formatDateShort } from "@autodeck/ui";
import { space } from "@autodeck/ui/theme";
import { useAuth } from "../../../hooks/useAuth";
import { listenToMyVehicles } from "../../../lib/vehicle-service";
import { getServiceCatalogue } from "../../../lib/catalogue-service";
import type { Service, Vehicle } from "@autodeck/core";
import { getMyBookings } from "../../../lib/booking-service";
import { CarThumb } from "../../../ui/CarThumb";
import { sceneImagery } from "../../../lib/imagery";
import { HeroImage, Button, Chip, Kicker, Loading, Notice, Pane, Row, Screen, T, rupees } from "../../../ui/kit";

const STATUS: Record<Booking["status"], { label: string; tone: "accent" | "premium" | "neutral" | "danger" }> = {
  PENDING: { label: "Awaiting confirm", tone: "accent" },
  CONFIRMED: { label: "Confirmed", tone: "premium" },
  ACTIVE: { label: "In the studio", tone: "accent" },
  COMPLETED: { label: "Done", tone: "neutral" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
  EXPIRED: { label: "Expired", tone: "neutral" },
};

export default function BookingsScreen() {
  const router = useRouter();
  const auth = useAuth();
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [error, setError] = useState(false);
  const [cars, setCars] = useState<Record<string, Vehicle>>({});
  const [svcs, setSvcs] = useState<Record<string, Service>>({});
  useEffect(() => {
    if (auth.status !== "ready") return;
    const un = listenToMyVehicles(auth.user.uid, auth.claims.tenantId, (vs) => setCars(Object.fromEntries(vs.map((v) => [v.id, v]))), () => {});
    getServiceCatalogue().then((l) => setSvcs(Object.fromEntries(l.map((x) => [x.id, x])))).catch(() => {});
    return un;
  }, [auth]);

  const load = useCallback(async () => {
    if (auth.status !== "ready") return;
    setError(false);
    try {
      setBookings(await getMyBookings(auth.user.uid, auth.claims.tenantId));
    } catch {
      setError(true);
    }
  }, [auth]);

  // Tabs stay mounted: reload every time the screen gains focus so a fresh booking shows up.
  useFocusEffect(
    useCallback(() => {
      if (auth.status === "ready") void load();
    }, [auth.status, load]),
  );

  if (!bookings && !error) return <Loading label="Loading bookings" />;
  const all = bookings ?? [];
  const upcoming = all.filter((b) => b.status === "PENDING" || b.status === "CONFIRMED" || b.status === "ACTIVE").sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  const past = all.filter((b) => !upcoming.includes(b));

  const list = (items: Booking[]) => (
    <View style={{ gap: space.breath }}>
      {items.map((b) => {
        const car = cars[b.vehicleId] ?? (b.vehicleSnapshot ? { ...b.vehicleSnapshot, category: b.vehicleCategory } : undefined);
        return (
          <Pressable key={b.id} accessibilityRole="button" onPress={() => router.push(`/(tabs)/bookings/${b.id}`)} style={({ pressed }) => ({ width: "100%", borderRadius: 22, overflow: "hidden", backgroundColor: "#303238", borderWidth: 1, borderColor: "rgba(255,255,255,0.09)", opacity: pressed ? 0.85 : 1 })}>
            <CarThumb car={car} height={120} radius={0} />
            <View style={{ gap: space.hair, padding: space.inset }}>
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space.breath }}>
                <View style={{ flex: 1, minWidth: 0 }}><T role="bodyStrong" numberOfLines={2}>{svcs[b.serviceId]?.name ?? "Service"}</T></View>
                <Chip label={isBookingMissed(b) ? "Missed" : STATUS[b.status].label} tone={isBookingMissed(b) ? "danger" : STATUS[b.status].tone} />
              </View>
              <T role="caption" tone="secondary" numberOfLines={1}>{car ? `${car.make} ${car.model}` : "Car"}</T>
              <T role="data" tone="tertiary" numberOfLines={2}>{`${formatDateShort(b.scheduledDate)} · ${b.scheduledTime} · ${rupees(b.totalAmount)}`}</T>
            </View>
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <Screen header={<View style={{ gap: space.hair }}><Kicker tone="accent">Bookings</Kicker><T role="title">Visits</T></View>}>
      {error ? <Notice title="Can't load bookings" body="Check your connection and try again." action={<Button kind="quiet" label="Try again" onPress={() => void load()} />} /> : null}
      {upcoming.length > 0 ? <View style={{ gap: space.line }}><Kicker>Coming up</Kicker>{list(upcoming)}</View> : null}
      {!error && upcoming.length === 0 ? (
        <Pane pad="none" round="hero">
          <HeroImage source={sceneImagery.heroHome} />
          <View style={{ padding: space.inset, gap: space.breath }}>
            <T role="heading">Nothing booked</T>
            <T tone="secondary">Pick a service and a time. The studio confirms it.</T>
            <Button label="Book a service" onPress={() => router.push("/(tabs)/catalogue")} />
          </View>
        </Pane>
      ) : null}
      {past.length > 0 ? <View style={{ gap: space.line }}><Kicker>History</Kicker>{list(past)}</View> : null}
    </Screen>
  );
}
