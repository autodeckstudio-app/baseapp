// Bookings: what's coming first, then history.
import { useCallback, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { isBookingMissed, type Booking } from "@autodeck/core";
import { formatDateShort } from "@autodeck/ui";
import { space } from "@autodeck/ui/theme";
import { useAuth } from "../../../hooks/useAuth";
import { listenToMyVehicles } from "../../../lib/vehicle-service";
import { getServiceCatalogue } from "../../../lib/catalogue-service";
import type { Service, Vehicle } from "@autodeck/core";
import { getMyBookings } from "../../../lib/booking-service";
import { listenToMyJobs, bookingFromJob } from "../../../lib/job-service";
import { VisitCard } from "../../../ui/VisitCard";
import { CarThumb } from "../../../ui/CarThumb";
import { sceneImagery } from "../../../lib/imagery";
import { HeroImage, Button, CanvasTitle, Chip, Kicker, Loading, Notice, Pane, Screen, T, rupees } from "../../../ui/kit";
import { colors as palette } from "@autodeck/ui/tokens";

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
  const [walkIns, setWalkIns] = useState<Booking[]>([]);
  const [cars, setCars] = useState<Record<string, Vehicle>>({});
  const [svcs, setSvcs] = useState<Record<string, Service>>({});
  useEffect(() => {
    if (auth.status !== "ready") return;
    const un = listenToMyVehicles(auth.user.uid, auth.claims.tenantId, (vs) => setCars(Object.fromEntries(vs.map((v) => [v.id, v]))), () => {});
    const unJobs = listenToMyJobs(auth.claims.tenantId, auth.user.uid, (js) => setWalkIns(js.filter((j) => !j.bookingId).map(bookingFromJob)), () => {});
    getServiceCatalogue().then((l) => setSvcs(Object.fromEntries(l.map((x) => [x.id, x])))).catch(() => {});
    return () => { un(); unJobs(); };
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
  const all = [...(bookings ?? []), ...walkIns];
  const upcoming = all.filter((b) => b.status === "PENDING" || b.status === "CONFIRMED" || b.status === "ACTIVE").sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  const past = all.filter((b) => !upcoming.includes(b));

  const list = (items: Booking[]) => (
    <View style={{ gap: 12 }}>
      {items.map((b) => {
        const car = cars[b.vehicleId] ?? (b.vehicleSnapshot ? { ...b.vehicleSnapshot, photoUrl: null, category: b.vehicleCategory } : undefined);
        const missed = isBookingMissed(b);
        return (
          <VisitCard key={b.id} onPress={() => router.push(`/(tabs)/bookings/${b.id}`)} photo={<CarThumb car={car} height={92} width={92} radius={0} />} title={svcs[b.serviceId]?.name ?? "Service"} car={car ? `${car.make} ${car.model}` : "Car"} when={`${formatDateShort(b.scheduledDate)} \u00b7 ${b.scheduledTime}`} price={rupees(b.totalAmount)} chip={<Chip label={missed ? "Missed" : STATUS[b.status].label} tone={missed ? "danger" : STATUS[b.status].tone} />} />
        );
      })}
    </View>
  );

  return (
    <Screen header={<Text style={{ color: palette.textPrimary, fontSize: 26, fontWeight: "700" }}>Visits</Text>}>
      {error ? <Notice title="Can't load bookings" body="Check your connection and try again." action={<Button kind="quiet" label="Try again" onPress={() => void load()} />} /> : null}
      {upcoming.length > 0 ? <View style={{ gap: space.line }}><Text style={{ color: palette.textPrimary, fontSize: 19, fontWeight: "700" }}>Coming up</Text>{list(upcoming)}</View> : null}
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
      {past.length > 0 ? <View style={{ gap: space.line }}><Text style={{ color: palette.textPrimary, fontSize: 19, fontWeight: "700" }}>History</Text>{list(past)}</View> : null}
    </Screen>
  );
}
