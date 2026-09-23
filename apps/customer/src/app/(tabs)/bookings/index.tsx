// Bookings: what's coming first, then history.
import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import type { Booking } from "@autodeck/core";
import { formatDateShort } from "@autodeck/ui";
import { space } from "@autodeck/ui/theme";
import { useAuth } from "../../../hooks/useAuth";
import { getMyBookings } from "../../../lib/booking-service";
import { Button, Chip, Kicker, Loading, Notice, Pane, Row, Screen, T, rupees } from "../../../ui/kit";

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

  const load = useCallback(async () => {
    if (auth.status !== "ready") return;
    setError(false);
    try {
      setBookings(await getMyBookings(auth.user.uid, auth.claims.tenantId));
    } catch {
      setError(true);
    }
  }, [auth]);

  useEffect(() => {
    if (auth.status === "ready") void load();
  }, [auth.status, load]);

  if (!bookings && !error) return <Loading label="Loading bookings" />;
  const all = bookings ?? [];
  const upcoming = all.filter((b) => b.status === "PENDING" || b.status === "CONFIRMED" || b.status === "ACTIVE").sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  const past = all.filter((b) => !upcoming.includes(b));

  const list = (items: Booking[]) => (
    <Pane pad="gap">
      {items.map((b, i) => (
        <Row
          key={b.id}
          title={`${formatDateShort(b.scheduledDate)} · ${b.scheduledTime}`}
          detail={<T role="data" tone="tertiary">{rupees(b.totalAmount)}</T>}
          trailing={<Chip label={STATUS[b.status].label} tone={STATUS[b.status].tone} />}
          onPress={() => router.push(`/(tabs)/bookings/${b.id}`)}
          last={i === items.length - 1}
        />
      ))}
    </Pane>
  );

  return (
    <Screen header={<View style={{ gap: space.hair }}><Kicker tone="accent">Bookings</Kicker><T role="title">Visits</T></View>}>
      {error ? <Notice title="Can't load bookings" body="Check your connection and try again." action={<Button kind="quiet" label="Try again" onPress={() => void load()} />} /> : null}
      {upcoming.length > 0 ? <View style={{ gap: space.line }}><Kicker>Coming up</Kicker>{list(upcoming)}</View> : null}
      {!error && upcoming.length === 0 ? (
        <Notice title="Nothing booked" body="Pick a service and a time. The studio confirms it." action={<Button label="Book a service" onPress={() => router.push("/(tabs)/catalogue")} />} />
      ) : null}
      {past.length > 0 ? <View style={{ gap: space.line }}><Kicker>History</Kicker>{list(past)}</View> : null}
    </Screen>
  );
}
