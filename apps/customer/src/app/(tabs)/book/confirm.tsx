import { SlideToConfirm } from "../../../ui/SlideToConfirm";
import { useState, useEffect } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { GIFT_LIVE, takePendingGiftCode } from "../../../lib/gift";
import { createBooking, generateIdempotencyKey } from "../../../lib/booking-service";
import { calculateServicePrice } from "../../../lib/catalogue-service";
import type { Service, Vehicle, VehicleCategory, PriceBreakdown as PriceBreakdownData } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { FIRST_STUDIO_ID } from "@autodeck/core";
import { space } from "@autodeck/ui/theme";
import { Icon } from "@autodeck/ui/native";
import { ServicePhoto } from "../../../ui/ServicePhoto";
import { MEMBERSHIP_WASH_LIVE, pickWash, todayInIndia, type WashDecision } from "../../../lib/membership-wash";
import { getMyMemberships } from "../../../lib/membership-service";
import { Sheet, SheetTotal, SheetLine, SheetDivider } from "../../../ui/Sheet";
import { Button, Field, Kicker, Loading, Notice, Pane, Row, Screen, T, rupees } from "../../../ui/kit";
import { REFERRAL_LIVE, normaliseReferralCode, referralCodeToSend } from "../../../lib/referral";
import { useAuth } from "../../../hooks/useAuth";

// Multi-day PPF services run into thousands of minutes - "~4320 min" is
// meaningless to a customer. This is service-time (not calendar time - the
// authoritative calendar span, which depends on operating hours/holidays, is
// already shown via "Expected ready" below), so express it in hours once it
// crosses a day rather than implying a calendar-day count.
function formatDuration(minutes: number): string {
  if (minutes < 24 * 60) return `~${minutes} min`;
  const hours = Math.round(minutes / 60);
  return `~${hours} hrs of service time`;
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
  const auth = useAuth();
  const [friendCode, setFriendCode] = useState("");
  const [giftCode] = useState(() => (GIFT_LIVE ? takePendingGiftCode() : null));

  const [service, setService] = useState<Service | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [breakdown, setBreakdown] = useState<PriceBreakdownData | null>(null);
  const [loading, setLoading] = useState(true);
  const [retryTick,setRetryTick] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const [booking, setBooking] = useState(false);
  const [bookError, setBookError] = useState<string | null>(null);
  const [wash, setWash] = useState<WashDecision | null>(null);
  const [useWash, setUseWash] = useState(false);
  const [idempotencyKey] = useState(() => generateIdempotencyKey());

  useEffect(() => {
    if (!params.serviceId || !params.vehicleId || !params.vehicleCategory) {setLoading(false);setLoadError(true);return;}
    setLoading(true);setLoadError(false);
    void (async () => {
      try {
        const [serviceSnap, vehicleSnap, priceResult] = await Promise.all([
          getDoc(doc(db, COLLECTIONS.services(), params.serviceId)),
          getDoc(doc(db, COLLECTIONS.vehicles(), params.vehicleId)),
          calculateServicePrice(params.serviceId, params.vehicleCategory),
        ]);
        if (!serviceSnap.exists() || !vehicleSnap.exists()) throw new Error("Booking details unavailable");
        setService(serviceSnap.data() as Service);
        setVehicle(vehicleSnap.data() as Vehicle);
        setBreakdown(priceResult.breakdown);
      } catch {
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [params.serviceId, params.vehicleId, params.vehicleCategory,retryTick]);

  // One included wash per booking, offered only when every rule passes (see lib/membership-wash.ts). Dark until the server can record it.
  useEffect(() => {
    if (!MEMBERSHIP_WASH_LIVE || !service) return;
    let alive = true;
    void getMyMemberships().then((list) => { if (alive) setWash(pickWash(list, service, todayInIndia())); }).catch(() => { if (alive) setWash(null); });
    return () => { alive = false; };
  }, [service]);
  const washOffer = MEMBERSHIP_WASH_LIVE && wash && wash.ok ? wash : null;
  const washOn = useWash && washOffer !== null;

  const sendCode = auth.status === "ready" ? referralCodeToSend(friendCode, auth.user.uid) : null;

  async function handleConfirm() {
    if(booking || !service || !vehicle || !breakdown) return;
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
        ...(washOn && washOffer ? { membershipId: washOffer.membershipId } : {}),
        ...(sendCode ? { referralCode: sendCode } : {}),
        ...(giftCode ? { giftCode } : {}),
      });
      router.replace({ pathname: "/(tabs)/bookings/[id]", params: { id: result.id, placed: "1" } });
    } catch (err) {
      console.warn("create booking failed", err);
      setBookError("We could not send your request. Check your bookings before trying again. If the request reached the studio, it will appear there.");
    } finally {
      setBooking(false);
    }
  }

  if (loading) return <Loading label="Getting your price" />;
  if (loadError) return <Screen><Notice title="Can't load details" body="Check your connection and try again." action={<Button label="Retry" onPress={()=>setRetryTick(n=>n+1)}/>} /></Screen>;

  const displayDate =
    params.scheduledDate &&
    new Date(`${params.scheduledDate}T12:00:00Z`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });

  const isMultiDay = !!params.estimatedEndDate && params.estimatedEndDate !== params.scheduledDate;
  const displayEndDate =
    params.estimatedEndDate &&
    new Date(`${params.estimatedEndDate}T12:00:00Z`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });

  const durationLabel = service ? formatDuration(service.estimatedDurationMinutes) : "-";

  return (
    <Screen header={<View style={{ gap: space.hair }}><Kicker tone="accent">Confirm</Kicker><T role="title">Review booking</T>{service?.priceOnRequest === true ? <T role="caption" tone="accent">Quote on request</T> : null}</View>}>
      {service ? (
        <View style={{ borderRadius: 24, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.10)" }}>
          <ServicePhoto service={service} aspect={16 / 9} radius={0} />
          <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, ...({ backgroundImage: "linear-gradient(180deg, rgba(5,5,6,0) 35%, rgba(5,5,6,0.85) 100%)" } as object) }} />
          <View pointerEvents="none" style={{ position: "absolute", left: 18, right: 18, bottom: 14 }}>
            <T role="heading" numberOfLines={2} style={{ color: "#FFFFFF" }}>{service.name.replace(/^Kovalent\s+/i, "")}</T>
          </View>
        </View>
      ) : null}
      <Sheet>
        {washOn ? <SheetTotal label="Wash from your plan" value="Included" /> : service?.priceOnRequest !== true && breakdown ? <SheetTotal label="Total, pay at the studio" value={rupees(breakdown.total)} /> : <SheetTotal label="Price" value="Quote" />}
        <SheetDivider />
        <SheetLine label="Service" value={service?.name ?? "-"} />
        <SheetLine label="Car" value={vehicle ? `${vehicle.make} ${vehicle.model} · ${vehicle.registrationNumber}` : "-"} />
        <SheetLine label="Date" value={displayDate ?? "-"} />
        <SheetLine label="Time" value={params.scheduledTime ? `${params.scheduledTime}` : "-"} />
        <SheetLine label="Duration" value={durationLabel} />
        <SheetLine label="Expected ready" value={displayEndDate ? `${displayEndDate}${params.endTime ? `, ${params.endTime}` : ""}` : "-"} last />
      </Sheet>

      {isMultiDay ? (
        <Notice
          title="Multi-day service"
          body={`Your car stays at the studio from ${displayDate} through ${displayEndDate}.`}
        />
      ) : null}

      {REFERRAL_LIVE ? (
        <Pane pad="gap">
          {giftCode ? <Notice title="Covered by your gift" body="You will not pay for this wash. The studio confirms the price is covered." /> : null}
          <Field label="Have a friend's code? (optional)" value={friendCode} onChangeText={setFriendCode} autoCapitalize="characters" placeholder="AD2K7QX" maxLength={12} error={friendCode.trim() !== "" && !normaliseReferralCode(friendCode) ? "That does not look like a code" : undefined} />
        </Pane>
      ) : null}

      {washOffer ? (
        <Pane pad="gap">
          <Row
            title="Use a membership wash"
            detail={<T role="caption" tone="secondary">{`${washOffer.washesLeft} left${washOffer.expiresOn ? `, plan valid until ${new Date(`${washOffer.expiresOn}T12:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}` : ""}. One wash per booking.`}</T>}
            trailing={<Button kind={washOn ? "primary" : "quiet"} label={washOn ? "Using it" : "Use"} onPress={() => setUseWash(!useWash)} />}
            last
          />
        </Pane>
      ) : null}

      {!washOn && service?.priceOnRequest !== true && breakdown ? (
        <Sheet>
          <SheetLine small label="Base" value={rupees(breakdown.basePrice)} />
          {breakdown.scopeAdjustment > 0 ? <SheetLine small label="Vehicle size adjustment" value={`+${rupees(breakdown.scopeAdjustment)}`} /> : null}
          {breakdown.membershipDiscount !== null && breakdown.membershipDiscount > 0 ? <SheetLine small label="Membership discount" value={`-${rupees(breakdown.membershipDiscount)}`} /> : null}
          {breakdown.tax > 0 ? <SheetLine small label={breakdown.taxDescription} value={rupees(breakdown.tax)} /> : null}
          <SheetLine small label="Total" value={rupees(breakdown.total)} last />
        </Sheet>
      ) : null}

      {service?.priceOnRequest === true ? <Pane pad="gap"><Row title="Price" detail={<T role="caption" tone="secondary">Quote on request. The studio sets the price for your car and you approve it before work starts.</T>} last /></Pane> : null}

      <T role="caption" tone="tertiary" style={{ textAlign: "center" }}>
        The studio confirms your slot after you send this. Price may vary based on final work.
      </T>
      <View style={{ gap: space.line }}>
        <Kicker>How will you pay</Kicker>
        <Pane pad="gap">
          <Row title="Pay at the studio" detail={<T role="caption" tone="secondary">Pay when you collect your car. Nothing is charged now.</T>} trailing={<Icon name="check" color="#EC8638" size={20} />} />
          <Row title="Pay online now" detail={<T role="caption" tone="tertiary">Opens when online payments go live. For now, pay at the studio.</T>} last />
        </Pane>
      </View>

      {bookError ? <Notice title="Could not confirm the request" body={bookError} /> : null}

      <View style={{ gap: space.breath }}>
        <SlideToConfirm label={service?.priceOnRequest === true ? "Slide to request a quote" : "Slide to request booking"} busy={booking} onConfirm={() => void handleConfirm()} />
        {bookError ? <Button label="Back to my details" kind="quiet" onPress={() => router.back()} /> : <Button label="Go back" kind="quiet" onPress={() => router.back()} />}
      </View>
    </Screen>
  );
}
