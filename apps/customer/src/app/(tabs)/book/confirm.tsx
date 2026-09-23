import { useState, useEffect } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { createBooking, generateIdempotencyKey } from "../../../lib/booking-service";
import { calculateServicePrice } from "../../../lib/catalogue-service";
import type { Service, Vehicle, VehicleCategory, PriceBreakdown as PriceBreakdownData } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { FIRST_STUDIO_ID } from "@autodeck/core";
import { space } from "@autodeck/ui/theme";
import { Button, Kicker, Loading, Notice, Pane, Row, Screen, T, rupees } from "../../../ui/kit";

// Multi-day PPF services run into thousands of minutes — "~4320 min" is
// meaningless to a customer. This is service-time (not calendar time — the
// authoritative calendar span, which depends on operating hours/holidays, is
// already shown via "Expected ready" below), so express it in hours once it
// crosses a day rather than implying a calendar-day count.
function formatDuration(minutes: number): string {
  if (minutes < 24 * 60) return `~${minutes} min`;
  const hours = Math.round(minutes / 60);
  return `~${hours} hrs of service time`;
}

function PricePane({ breakdown: pb }: { breakdown: PriceBreakdownData }) {
  return (
    <Pane pad="gap">
      <Row title="Base" trailing={<T role="data">{rupees(pb.basePrice)}</T>} />
      {pb.scopeAdjustment > 0 ? (
        <Row title="Vehicle size adjustment" trailing={<T role="data">+{rupees(pb.scopeAdjustment)}</T>} />
      ) : null}
      {pb.addOns.map((addOn) => (
        <Row key={addOn.id} title={addOn.name} trailing={<T role="data">{rupees(addOn.price)}</T>} />
      ))}
      {pb.membershipDiscount !== null && pb.membershipDiscount > 0 ? (
        <Row title="Membership discount" trailing={<T role="data" tone="premium">-{rupees(pb.membershipDiscount)}</T>} />
      ) : null}
      <Row title={pb.taxDescription} trailing={<T role="data">{rupees(pb.tax)}</T>} />
      <Row
        title={<T role="heading">Total</T>}
        trailing={<T role="heading">{rupees(pb.total)}</T>}
        last
      />
    </Pane>
  );
}

export default function BookingConfirmScreen() {
  const params = useLocalSearchParams<{
    serviceId: string;
    vehicleId: string;
    vehicleCategory: VehicleCategory;
    scheduledDate: string;
    scheduledTime: string;
    startAt: string;
    estimatedEndAt: string;
    estimatedEndDate: string;
    endTime: string;
  }>();
  const router = useRouter();

  const [service, setService] = useState<Service | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [breakdown, setBreakdown] = useState<PriceBreakdownData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [booking, setBooking] = useState(false);
  const [bookError, setBookError] = useState<string | null>(null);
  const [idempotencyKey] = useState(() => generateIdempotencyKey());

  useEffect(() => {
    if (!params.serviceId || !params.vehicleId || !params.vehicleCategory) return;
    void (async () => {
      try {
        const [serviceSnap, vehicleSnap, priceResult] = await Promise.all([
          getDoc(doc(db, COLLECTIONS.services(), params.serviceId)),
          getDoc(doc(db, COLLECTIONS.vehicles(), params.vehicleId)),
          calculateServicePrice(params.serviceId, params.vehicleCategory),
        ]);
        if (serviceSnap.exists()) setService(serviceSnap.data() as Service);
        if (vehicleSnap.exists()) setVehicle(vehicleSnap.data() as Vehicle);
        setBreakdown(priceResult.breakdown);
      } catch {
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [params.serviceId, params.vehicleId, params.vehicleCategory]);

  async function handleConfirm() {
    if (!params.serviceId || !params.vehicleId || !params.vehicleCategory || !params.scheduledDate || !params.scheduledTime) return;
    setBooking(true);
    setBookError(null);
    try {
      const result = await createBooking({
        serviceId: params.serviceId,
        vehicleId: params.vehicleId,
        vehicleCategory: params.vehicleCategory,
        studioId: FIRST_STUDIO_ID,
        scheduledDate: params.scheduledDate,
        scheduledTime: params.scheduledTime,
        idempotencyKey,
      });
      router.replace(`/(tabs)/bookings/${result.id}`);
    } catch (err) {
      setBookError(err instanceof Error ? err.message : "Could not create booking. Please try again.");
    } finally {
      setBooking(false);
    }
  }

  if (loading) return <Loading label="Getting your price" />;
  if (loadError) return <Screen><Notice title="Can't load details" body="Check your connection and try again." /></Screen>;

  const displayDate =
    params.scheduledDate &&
    new Date(`${params.scheduledDate}T12:00:00Z`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });

  const isMultiDay = !!params.estimatedEndDate && params.estimatedEndDate !== params.scheduledDate;
  const displayEndDate =
    params.estimatedEndDate &&
    new Date(`${params.estimatedEndDate}T12:00:00Z`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });

  const durationLabel = service ? formatDuration(service.estimatedDurationMinutes) : "—";

  return (
    <Screen header={<View style={{ gap: space.hair }}><Kicker tone="accent">4 · Confirm</Kicker><T role="title">Review booking</T></View>}>
      <Pane pad="gap">
        <Row title="Service" detail={service?.name ?? "—"} />
        <Row title="Car" detail={vehicle ? `${vehicle.make} ${vehicle.model} · ${vehicle.registrationNumber}` : "—"} />
        <Row title="Date" detail={displayDate ?? "—"} />
        <Row title="Time" detail={params.scheduledTime ? `${params.scheduledTime} IST` : "—"} />
        <Row title="Duration" detail={durationLabel} />
        <Row
          title="Expected ready"
          detail={displayEndDate ? `${displayEndDate}${params.endTime ? `, ${params.endTime} IST` : ""}` : "—"}
          last
        />
      </Pane>

      {isMultiDay ? (
        <Notice
          title="Multi-day service"
          body={`Your car stays at the studio from ${displayDate} through ${displayEndDate}.`}
        />
      ) : null}

      {breakdown !== null ? <PricePane breakdown={breakdown} /> : null}

      <T role="caption" tone="tertiary" style={{ textAlign: "center" }}>
        Payment is collected at the studio. Price may vary based on final work.
      </T>

      {bookError ? <Notice title="Booking failed" body={bookError} /> : null}

      <View style={{ gap: space.breath }}>
        <Button label="Confirm booking" busy={booking} onPress={() => void handleConfirm()} />
        <Button label="Go back" kind="quiet" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}
