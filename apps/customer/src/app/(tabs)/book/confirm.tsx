import { formatServiceTime } from "../../../lib/duration";
import { useState, useEffect, useMemo, useRef } from "react";
import { extrasFromParam } from "../../../lib/visit-extras";
import { Pressable, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { GIFT_LIVE, takePendingGiftCode } from "../../../lib/gift";
import type { LiveStudioInfo } from "../../../lib/studio-info";
import { createBooking, generateIdempotencyKey, getStudioInfo } from "../../../lib/booking-service";
import { calculateServicePrice } from "../../../lib/catalogue-service";
import type { Service, Vehicle, VehicleCategory, PriceBreakdown as PriceBreakdownData } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { FIRST_STUDIO_ID, bookingPayment } from "@autodeck/core";
import { getJobIdForBooking } from "../../../lib/job-service";
import { initiatePayment } from "../../../lib/payment-service";
import { checkoutSupported, payWithCheckout } from "../../../lib/razorpay-checkout";
import { space } from "@autodeck/ui/theme";
import { Icon } from "@autodeck/ui/native";
import { ServicePhoto } from "../../../ui/ServicePhoto";
import { MEMBERSHIP_WASH_LIVE, pickWash, todayInIndia, type WashDecision } from "../../../lib/membership-wash";
import { getMyMemberships, getMembershipPlans } from "../../../lib/membership-service";
import { memberSaving } from "../../../lib/member-save";
import { Sheet, SheetTotal, SheetLine, SheetDivider } from "../../../ui/Sheet";
import { Button, Field, Kicker, Loading, Notice, Pane, Row, Screen, T, rupees } from "../../../ui/kit";
import { REFERRAL_LIVE, normaliseReferralCode, referralCodeToSend } from "../../../lib/referral";
import { getDeviceLocation, requestPickupDrop } from "../../../lib/pickup-service";
import { pickupSlotsFor, PICKUP_SLOT_OPEN } from "../../../lib/pickup-slots";
import { PICKUP_POLICY, pickupFeeText } from "../../../lib/pickup-policy";
import { pickupZone } from "@autodeck/core";
import { SelectField } from "../../../ui/inputs";
import { useAuth } from "../../../hooks/useAuth";

const PICKUP_KINDS: { value: "pickup" | "drop" | "both"; label: string }[] = [
  { value: "pickup", label: "Pickup" },
  { value: "drop", label: "Drop-off" },
  { value: "both", label: "Pickup and drop" },
];

// Multi-day PPF services run into thousands of minutes - "~4320 min" is
// meaningless to a customer. This is service-time (not calendar time - the
// authoritative calendar span, which depends on operating hours/holidays, is
// already shown via "Expected ready" below), so express it in hours once it
// crosses a day rather than implying a calendar-day count.

export default function BookingConfirmScreen() {
  const params = useLocalSearchParams<{
    serviceId: string;
    extras?: string;
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
  const [payAtStudio, setPayAtStudio] = useState(false);
  // Optional pickup/drop chosen here and sent with "Confirm booking" (round 8):
  // nothing is selected by default, and tapping the chosen chip again clears
  // the whole selection so nothing pickup-related is sent.
  const [pickupKind, setPickupKind] = useState<"pickup" | "drop" | "both" | null>(null);
  const [pickupAddress, setPickupAddress] = useState("");
  const [pickupSlot, setPickupSlot] = useState("");
  const [pickupWhere, setPickupWhere] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  // Pay online holds the slot for 15 minutes. The booking exists (pending) while the customer pays or retries.
  const [held, setHeld] = useState<{ bookingId: string; paymentJobId: string | null; expiresAt: number; pickupSent: boolean } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const heldOver = held !== null && now >= held.expiresAt;
  const payBusy = useRef(false);
  useEffect(() => {
    if (!held) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [held]);
  // More services in the same visit. The server prices them again; this is what the customer sees first.
  const extraIds = useMemo(() => extrasFromParam(params.extras), [params.extras]);
  const [extraRows, setExtraRows] = useState<Array<{ id: string; name: string; minutes: number; total: number }>>([]);
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
        const rows = await Promise.all(extraIds.map(async (id) => {
          const [es, ep] = await Promise.all([getDoc(doc(db, COLLECTIONS.services(), id)), calculateServicePrice(id, params.vehicleCategory)]);
          if (!es.exists()) throw new Error("Booking details unavailable");
          const e = es.data() as Service;
          return { id, name: e.name, minutes: e.estimatedDurationMinutes, total: ep.breakdown.total };
        }));
        setExtraRows(rows);
      } catch {
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [params.serviceId, params.vehicleId, params.vehicleCategory, extraIds.join(","), retryTick]);

  // One included wash per booking, offered only when every rule passes (see lib/membership-wash.ts). Dark until the server can record it.
  useEffect(() => {
    if (!MEMBERSHIP_WASH_LIVE || !service) return;
    let alive = true;
    void getMyMemberships().then((list) => { if (alive) setWash(pickWash(list, service, todayInIndia())); }).catch(() => { if (alive) setWash(null); });
    return () => { alive = false; };
  }, [service]);
  // "Members save" line: only for people with no plan yet, from real plan data, hidden when it is not above zero.
  const [plans, setPlans] = useState<Awaited<ReturnType<typeof getMembershipPlans>> | null>(null);
  useEffect(() => {
    let alive = true;
    void getMembershipPlans().then((p) => { if (alive) setPlans(p); }).catch(() => { if (alive) setPlans(null); });
    return () => { alive = false; };
  }, []);
  const washOffer = MEMBERSHIP_WASH_LIVE && !giftCode && wash && wash.ok && extraIds.length === 0 ? wash : null;
  const saving = !giftCode && wash && !wash.ok && wash.reason === "no_membership" ? memberSaving({ service, total: breakdown?.total, plans }) : null;
  const washOn = useWash && washOffer !== null;

  const sendCode = !giftCode && auth.status === "ready" ? referralCodeToSend(friendCode, auth.user.uid) : null;

  const payHow = service && breakdown ? bookingPayment(service, breakdown.total) : { online: false, studioChoice: false };

  const payNow = !giftCode && payHow.online && !payAtStudio && !washOn;
  const holdLeft = held ? Math.max(0, Math.ceil((held.expiresAt - now) / 1000)) : 0;

  // Opening time for the booking day from the live studio record - the same
  // hours the booking engine used to offer this slot. Falls back to the
  // engine's seeded default when the fetch fails. The day-of-week comes from
  // the calendar date itself, so no timezone conversion is involved.
  const [studioInfo, setStudioInfo] = useState<LiveStudioInfo | null>(null);
  useEffect(() => {
    let alive = true;
    void getStudioInfo(FIRST_STUDIO_ID).then((info) => { if (alive) setStudioInfo(info); }).catch(() => { if (alive) setStudioInfo(null); });
    return () => { alive = false; };
  }, []);
  const bookingDayOpen = useMemo(() => {
    if (!params.scheduledDate) return PICKUP_SLOT_OPEN;
    const dow = new Date(`${params.scheduledDate}T00:00:00Z`).getUTCDay();
    const hours = studioInfo?.operatingHours.find((h) => h.dayOfWeek === dow);
    return hours && !hours.closed ? hours.open : PICKUP_SLOT_OPEN;
  }, [params.scheduledDate, studioInfo]);
  const pickupSlots = params.scheduledTime ? pickupSlotsFor(params.scheduledTime, bookingDayOpen) : [];
  const pickupZoneInfo = pickupWhere ? pickupZone(pickupWhere) : null;

  function choosePickupKind(k: "pickup" | "drop" | "both") {
    if (pickupKind === k) {
      setPickupKind(null);
      setPickupAddress("");
      setPickupSlot("");
      setPickupWhere(null);
    } else {
      setPickupKind(k);
    }
  }

  async function locatePickup() {
    setLocating(true);
    const p = await getDeviceLocation();
    setPickupWhere(p);
    setLocating(false);
  }

  // Sends the pickup/drop request right after the booking is created, as
  // specified. The server accepts requests on any open booking (PENDING
  // included) and its existing expiry sweep closes the request if an unpaid
  // hold lapses, so no orphan request can linger. True when there is nothing
  // to send or the request went through; false only when the request itself
  // failed - the booking always stands either way. Drop-off timing is agreed
  // after the service, so a requested drop time is never sent.
  async function sendPickupRequest(bookingId: string): Promise<boolean> {
    if (!pickupKind) return true;
    const address = pickupAddress.trim();
    if (address.length < 8) return true;
    try {
      await requestPickupDrop({
        bookingId,
        kind: pickupKind,
        address,
        ...(pickupWhere ? { lat: pickupWhere.lat, lng: pickupWhere.lng } : {}),
        ...(pickupKind !== "drop" && pickupSlot ? { requestedPickupTime: pickupSlot } : {}),
      });
      return true;
    } catch {
      return false;
    }
  }

  /** Opens checkout for the held booking. Success goes to the booking; a failure or close stays here with the slot held. */
  async function payHeld(h: { bookingId: string; paymentJobId: string | null; expiresAt: number; pickupSent: boolean }) {
    if (payBusy.current || !service) return;
    payBusy.current = true;
    setBooking(true);
    setBookError(null);
    try {
      if (!h.paymentJobId || !checkoutSupported) throw new Error("no checkout");
      const pay = await initiatePayment(h.paymentJobId, "razorpay_payment_link");
      const out = pay.paymentId ? await payWithCheckout(pay.paymentId, { name: "AutoDeck Studio", description: service.name }) : "failed";
      if (out === "paid") {
        router.replace({ pathname: "/(tabs)/bookings/[id]", params: { id: h.bookingId, placed: "1", pay: "paid", ...(h.pickupSent ? {} : { pickup: "failed" }) } });
        return;
      }
      setBookError(out === "failed" ? "Payment failed, please retry." : "Payment not completed. Your slot is held for a few more minutes.");
    } catch {
      setBookError("We could not open the payment. Please retry.");
    } finally {
      payBusy.current = false;
      setBooking(false);
    }
  }

  async function handleConfirm() {
    if(booking || !service || !vehicle || !breakdown) return;
    if (held) { if (!heldOver) await payHeld(held); return; }
    if (!params.serviceId || !params.vehicleId || !params.vehicleCategory || !params.scheduledDate || !params.scheduledTime) return;
    setBooking(true);
    setBookError(null);
    let created = false;
    try {
      const result = await createBooking({
        serviceId: params.serviceId,
        ...(extraIds.length ? { extraServiceIds: extraIds } : {}),
        vehicleId: params.vehicleId,
        vehicleCategory: params.vehicleCategory,
        studioId: FIRST_STUDIO_ID,
        scheduledDate: params.scheduledDate,
        scheduledTime: params.scheduledTime,
        idempotencyKey,
        payMode: payNow ? "online" : "studio",
        ...(washOn && washOffer ? { membershipId: washOffer.membershipId } : {}),
        ...(sendCode ? { referralCode: sendCode } : {}),
        ...(giftCode ? { giftCode } : {}),
      });
      created = true;
      // Create the booking exactly as before, then request pickup/drop with
      // the new booking id (round 8). The request's failure never fails the
      // booking - the booking page shows a call-the-studio note instead.
      const pickupSent = await sendPickupRequest(result.id);
      if (result.status === "PENDING" && auth.status === "ready") {
        // Held for 15 minutes until paid. Pay now; if it fails the customer retries on this page.
        const jobId = await getJobIdForBooking(result.id, auth.claims.tenantId, auth.user.uid).catch(() => null);
        const h = { bookingId: result.id, paymentJobId: jobId, expiresAt: Date.parse(result.holdExpiresAt ?? "") || Date.now() + 15 * 60_000, pickupSent };
        setHeld(h);
        setBooking(false);
        await payHeld(h);
        return;
      }
      router.replace({ pathname: "/(tabs)/bookings/[id]", params: { id: result.id, placed: "1", ...(pickupSent ? {} : { pickup: "failed" }) } });
    } catch (err) {
      console.warn("create booking failed", err);
      setBookError(created ? "We could not open the payment. Please retry." : "We could not send your request. Check your bookings before trying again. If the request reached the studio, it will appear there.");
    } finally {
      if (!payBusy.current) setBooking(false);
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

  const durationLabel = service ? formatServiceTime(service.estimatedDurationMinutes + extraRows.reduce((m, r) => m + r.minutes, 0)) : "-";
  const visitTotal = breakdown ? breakdown.total + extraRows.reduce((t, r) => t + r.total, 0) : null;

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
        {giftCode ? <SheetTotal label="Covered by your gift" value="Included" /> : washOn ? <SheetTotal label="Wash from your plan" value="Included" /> : service?.priceOnRequest !== true && breakdown ? <SheetTotal label="Total" value={rupees(visitTotal ?? breakdown.total)} /> : <SheetTotal label="Price" value="Quote" />}
        <SheetDivider />
        <SheetLine label="Service" value={service?.name ?? "-"} />
        {extraRows.map((r) => <SheetLine key={r.id} label="Also" value={r.name} />)}
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
          {!giftCode ? <Field label="Have a friend's code? (optional)" value={friendCode} onChangeText={setFriendCode} autoCapitalize="characters" placeholder="AD2K7QX" maxLength={12} error={friendCode.trim() !== "" && !normaliseReferralCode(friendCode) ? "That does not look like a code" : undefined} /> : null}
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
          {extraRows.map((r) => <SheetLine key={r.id} small label={r.name} value={rupees(r.total)} />)}
          {breakdown.tax > 0 ? <SheetLine small label={breakdown.taxDescription} value={rupees(breakdown.tax)} /> : null}
        </Sheet>
      ) : null}

      {saving !== null ? (
        <Pane pad="gap">
          <Row title={`Members save ${rupees(saving)} on this wash`} detail={<T role="caption" tone="secondary">Club plans include washes at a lower rate each.</T>} trailing={<Button kind="quiet" label="Join Club" onPress={() => router.push("/(tabs)/membership")} />} last />
        </Pane>
      ) : null}

      <View style={{ gap: space.line }}>
        <Kicker>Pickup and drop (optional)</Kicker>
        <Pane pad="gap">
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.breath }}>
            {PICKUP_KINDS.map((k) => <Button key={k.value} label={k.label} kind={pickupKind === k.value ? "primary" : "quiet"} onPress={() => choosePickupKind(k.value)} style={{ flexGrow: 1 }} />)}
          </View>
          {pickupKind ? (
            <View style={{ gap: space.line, marginTop: space.line }}>
              <T role="caption" tone="secondary">{PICKUP_POLICY}</T>
              <Field
                label="Address"
                value={pickupAddress}
                onChangeText={setPickupAddress}
                placeholder="e.g. 12, Sunrise Apartments, CG Road"
                multiline
                error={pickupAddress.trim().length > 0 && pickupAddress.trim().length < 8 ? "Enter the full address" : undefined}
              />
              <Button label={pickupWhere ? "Location added" : "Use my location to check distance"} kind="quiet" busy={locating} onPress={() => void locatePickup()} />
              {pickupZoneInfo ? <T role="caption" tone="secondary">{`About ${pickupZoneInfo.km} km from the studio. ${pickupFeeText(pickupZoneInfo.km, pickupKind)} for ${pickupKind === "both" ? "pickup and drop-off" : pickupKind === "pickup" ? "pickup" : "drop-off"}.`}</T> : null}
              {pickupKind !== "drop" && pickupSlots.length > 0 ? (
                <SelectField
                  label={pickupKind === "both" ? "Preferred pickup time (optional)" : "Preferred time (optional)"}
                  value={pickupSlot}
                  onChange={setPickupSlot}
                  options={[{ value: "", label: "No preference" }, ...pickupSlots.map((s) => ({ value: s, label: s }))]}
                />
              ) : null}
              {pickupKind !== "drop" ? <T role="caption" tone="secondary">This is your preference, not a confirmed slot. The studio agrees the exact time with you by phone call.</T> : null}
            </View>
          ) : (
            <T role="caption" tone="secondary">Want us to collect or return your car? Choose one above and it goes with your booking.</T>
          )}
        </Pane>
      </View>

      {service?.priceOnRequest === true ? <Pane pad="gap"><Row title="Price" detail={<T role="caption" tone="secondary">Quote on request. The studio sets the price for your car and you approve it before work starts.</T>} last /></Pane> : null}

      <T role="caption" tone="tertiary" style={{ textAlign: "center" }}>
        {service?.priceOnRequest === true ? "The studio sets your price and you approve it before work starts." : giftCode ? "Your slot is confirmed. Your gift covers this wash." : washOn ? "Your slot is confirmed. Price may vary based on final work." : payNow ? "Pay now to confirm your slot. Price may vary based on final work." : "Your slot is confirmed. Pay at the studio. Price may vary based on final work."}
      </T>
      {washOn || giftCode ? null : <View style={{ gap: space.line }}>
        <Kicker>How will you pay</Kicker>
        <Pane pad="gap">
          {payHow.online ? (
            <Pressable accessibilityRole="button" accessibilityState={{ selected: !payAtStudio }} onPress={() => { if (!held) setPayAtStudio(false); }}>
              <Row title="Pay online" detail={<T role="caption" tone="secondary">Secure payment now. Your slot is held for 15 minutes.</T>} trailing={!payAtStudio ? <Icon name="check" color="#EC8638" size={20} /> : undefined} last={false} />
            </Pressable>
          ) : null}
          {true ? (
            <Pressable accessibilityRole="button" accessibilityState={{ selected: payAtStudio || !payHow.online }} onPress={() => { if (!held) setPayAtStudio(true); }}>
              <Row title="Pay at studio" detail={<T role="caption" tone="secondary">Your slot is confirmed now. Pay when you collect your car.</T>} trailing={payAtStudio || !payHow.online ? <Icon name="check" color="#EC8638" size={20} /> : undefined} last />
            </Pressable>
          ) : null}
        </Pane>
      </View>}

      {bookError ? <Notice title={held ? "Payment pending" : "Could not confirm the request"} body={bookError} /> : null}

      {held && !heldOver ? <T role="caption" tone="secondary" style={{ textAlign: "center" }}>{`Slot held for ${Math.floor(holdLeft / 60)}:${String(holdLeft % 60).padStart(2, "0")}`}</T> : null}
      {heldOver ? <Notice title="Time ran out" body="Payment was not completed in 15 minutes, so the slot was released. Pick a time again." action={<Button label="Pick a time" onPress={() => router.back()} />} /> : null}

      <View style={{ gap: space.breath }}>
        {heldOver ? null : <Button label={service?.priceOnRequest === true ? "Request quote" : payNow || held ? "Pay & confirm" : "Confirm booking"} busy={booking} disabled={booking} onPress={() => void handleConfirm()} />}
        {held && !heldOver ? <T role="caption" tone="tertiary" style={{ textAlign: "center" }}>Your booking is pending until the payment goes through.</T> : <Button label="Go back" kind="quiet" onPress={() => router.back()} />}
      </View>
    </Screen>
  );
}
