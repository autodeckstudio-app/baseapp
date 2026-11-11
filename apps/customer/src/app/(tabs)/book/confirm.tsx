import { CombinedPaymentSheet } from "../../../ui/CombinedPaymentSheet";
import{COMBINED_CHECKOUT_ENABLED,COMBINED_GIFT_CHECKOUT_ENABLED,COMBINED_WASH_CHECKOUT_ENABLED,COMBINED_PICKUP_BENEFIT_ENABLED,washCombinedServicePreview,giftCombinedServicePreview,combinedCheckoutReview}from'../../../lib/combined-checkout';
import{CombinedPaymentOptions}from'../../../ui/CombinedPaymentOptions';
import type{CombinedPaymentChoice}from'@autodeck/core';
import{reviewedPickupEntitlement}from"../../../lib/pickup-entitlement";
import type{Membership}from"@autodeck/core";
import{pickupDraftScope,currentPickupQuote}from'../../../lib/pickup-draft';
import{usePickupDraft}from'../../../lib/use-pickup-draft';
import {bookingConfirmCopy}from"../../../lib/booking-confirm-copy";
import { listOwnerKey } from "../../../lib/owner-key";
import { formatServiceTime } from "../../../lib/duration";
import { useState, useEffect, useRef } from "react";
import { Pressable, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { GIFT_LIVE, takePendingGiftCode } from "../../../lib/gift";
import { ADVANCE_SPLIT_ENABLED, advanceDisclosureLines, advancePreviewFromParts, needsBookingAdvance } from "../../../lib/advance-booking";
import { createBooking, generateIdempotencyKey, getStudioInfo } from "../../../lib/booking-service";
import { calculateServicePrice } from "../../../lib/catalogue-service";
import type { Service, Vehicle, VehicleCategory, PriceBreakdown as PriceBreakdownData } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { FIRST_STUDIO_ID, bookingPayment } from "@autodeck/core";
import { getJobIdForBooking } from "../../../lib/job-service";
import { initiatePayment, requestAdvancePayment } from "../../../lib/payment-service";
import { payOnline, payWithPaymentLink } from "../../../lib/razorpay-checkout";
import { bookingPayOutcomeMessage } from "../../../lib/native-pay-core";
import { space } from "@autodeck/ui/theme";
import { Icon } from "@autodeck/ui/native";
import { AdvancePaymentSheet } from "../../../ui/AdvancePaymentSheet";
import { MEMBERSHIP_WASH_LIVE, pickWash, todayInIndia, type WashDecision } from "../../../lib/membership-wash";
import { getMyMemberships, getMembershipPlans } from "../../../lib/membership-service";
import { memberSaving } from "../../../lib/member-save";
import { Sheet, SheetTotal, SheetLine, SheetDivider } from "../../../ui/Sheet";
import { Button, Field, Kicker, Loading, Notice, Pane, Row, Screen, T, rupees } from "../../../ui/kit";
import { REFERRAL_LIVE, normaliseReferralCode, referralCodeToSend } from "../../../lib/referral";
import { describePickupQuote, getDeviceLocation, getPickupQuote, requestPickupDrop } from "../../../lib/pickup-service";
import { pickupDayHoursFor, pickupSlotOptions, validPickupSlot, type PickupDayHours } from "../../../lib/pickup-slots";
import { PickupOptions } from "../../../ui/PickupOptions";
import { SelectField } from "../../../ui/inputs";
import { useAuth } from "../../../hooks/useAuth";

// Multi-day PPF services run into thousands of minutes - "~4320 min" is
// meaningless to a customer. This is service-time (not calendar time - the
// authoritative calendar span, which depends on operating hours/holidays, is
// already shown via "Expected ready" below), so express it in hours once it
// crosses a day rather than implying a calendar-day count.

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
  const [payAtStudio, setPayAtStudio] = useState(false);
  const [combinedChoice,setCombinedChoice]=useState<CombinedPaymentChoice|null>(null);
  // Optional pickup/drop chosen here and sent with "Confirm booking" (round 8):
  // nothing is selected by default, and tapping the chosen chip again clears
  // the whole selection so nothing pickup-related is sent.
  const [showTerms, setShowTerms] = useState(false);
  const transportScope=pickupDraftScope(auth.status==='ready'?{uid:auth.user.uid,customerId:auth.customerDocId??null,tenantId:auth.claims?.tenantId??null}:null,params.serviceId);
  const {draft:transportDraft,update:transportUpdate}=usePickupDraft(transportScope);
  const {kind:pickupKind,address:pickupAddress,where:pickupWhere,quote:pickupQuote}=transportDraft;
  const setPickupKind=(kind:typeof pickupKind)=>transportUpdate({kind});
  const setPickupAddress=(address:string)=>{actionGeneration.current++;setLocating(false);transportUpdate({address,quote:null,where:null})};
  const setPickupWhere=(where:typeof pickupWhere)=>transportUpdate({where});
  const setPickupQuote=(quote:typeof pickupQuote)=>transportUpdate({quote});
  const [pickupSlot,setPickupSlot]=useState("");
  const [pickupQuoteError, setPickupQuoteError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  // Pay online holds the slot for 15 minutes. The booking exists (pending) while the customer pays or retries.
  const [held, setHeld] = useState<{ bookingId: string; paymentJobId: string | null; expiresAt: number; pickupSent: boolean; advance?: boolean; expectedAdvancePaise?: number } | null>(null);
  const [advanceSheet, setAdvanceSheet] = useState(false);
  const [combinedSheetKey,setCombinedSheetKey]=useState<string|null>(null);
  const [now, setNow] = useState(() => Date.now());
  const heldOver = held !== null && now >= held.expiresAt;
  const payBusy = useRef(false);
  useEffect(() => {
    if (!held) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [held]);
  // One booking is one service: no extra-service selection (combos stay their own catalogue choices).
  const scopeKey=JSON.stringify([auth.status,auth.status==='ready'?auth.user.uid:null,auth.status==='ready'?auth.customerDocId:null,params.serviceId,params.vehicleId,params.vehicleCategory,params.scheduledDate,params.scheduledTime]);
  const scopeRef=useRef(scopeKey);scopeRef.current=scopeKey;const actionGeneration=useRef(0),confirmBusy=useRef(false);
  const idempotencyKey=useRef(generateIdempotencyKey());
  const [pickupPlans,setPickupPlans]=useState<{scope:string;status:'ready'|'error';list:Membership[]}|null>(null);
  useEffect(()=>{if(!COMBINED_CHECKOUT_ENABLED||!COMBINED_PICKUP_BENEFIT_ENABLED)return;let alive=true;setPickupPlans(null);void getMyMemberships().then(list=>{if(alive)setPickupPlans({scope:scopeKey,status:'ready',list})}).catch(()=>{if(alive)setPickupPlans({scope:scopeKey,status:'error',list:[]})});return()=>{alive=false}},[scopeKey]);
  useEffect(()=>{actionGeneration.current++;confirmBusy.current=false;payBusy.current=false;idempotencyKey.current=generateIdempotencyKey();setBooking(false);setHeld(null);setFriendCode('');setUseWash(false);setWash(null);setPayAtStudio(false);setCombinedChoice(null);setPickupSlot('');setPickupQuoteError(null);setLocating(false);setShowTerms(false);setAdvanceSheet(false);return()=>{actionGeneration.current++}},[scopeKey]);

  useEffect(() => {
    let alive=true;setService(null);setVehicle(null);setBreakdown(null);setBookError(null);setHeld(null);if (!params.serviceId || !params.vehicleId || !params.vehicleCategory) {setLoading(false);setLoadError(true);return;}
    setLoading(true);setLoadError(false);
    void (async () => {
      try {
        const [serviceSnap, vehicleSnap, priceResult] = await Promise.all([
          getDoc(doc(db, COLLECTIONS.services(), params.serviceId)),
          getDoc(doc(db, COLLECTIONS.vehicles(), params.vehicleId)),
          calculateServicePrice(params.serviceId, params.vehicleCategory),
        ]);
        if(!alive)return;if (!serviceSnap.exists() || !vehicleSnap.exists()) throw new Error("Booking details unavailable");
        setService(serviceSnap.data() as Service);
        setVehicle(vehicleSnap.data() as Vehicle);
        setBreakdown(priceResult.breakdown);
      } catch {
        if(alive)setLoadError(true);
      } finally {
        if(alive)setLoading(false);
      }
    })();return()=>{alive=false};
  }, [params.serviceId, params.vehicleId, params.vehicleCategory, retryTick]);

  // One included wash per booking, offered only when every rule passes (see lib/membership-wash.ts). Dark until the server can record it.
  useEffect(() => {
    if (!MEMBERSHIP_WASH_LIVE || !service) return;
    let alive = true;
    void getMyMemberships().then((list) => { if (alive) setWash(pickWash(list, service, COMBINED_CHECKOUT_ENABLED?params.scheduledDate??todayInIndia():todayInIndia())); }).catch(() => { if (alive) setWash(null); });
    return () => { alive = false; };
  }, [service,params.scheduledDate]);
  // "Members save" line: only for people with no plan yet, from real plan data, hidden when it is not above zero.
  const [plans, setPlans] = useState<Awaited<ReturnType<typeof getMembershipPlans>> | null>(null);
  useEffect(() => {
    let alive = true;
    void getMembershipPlans().then((p) => { if (alive) setPlans(p); }).catch(() => { if (alive) setPlans(null); });
    return () => { alive = false; };
  }, []);
  const washOffer = MEMBERSHIP_WASH_LIVE && !giftCode && wash && wash.ok ? wash : null;
  const saving = !giftCode && wash && !wash.ok && wash.reason === "no_membership" ? memberSaving({ service, total: breakdown?.total, plans }) : null;
  const washOn = useWash && washOffer !== null;

  const sendCode = !giftCode && auth.status === "ready" ? referralCodeToSend(friendCode, auth.user.uid) : null;

  const payHow = service && breakdown ? bookingPayment(service, breakdown.total) : { online: false, studioChoice: false };

  const payNow = !giftCode && payHow.online && !payAtStudio && !washOn;
  const advancePreview = ADVANCE_SPLIT_ENABLED && breakdown ? advancePreviewFromParts(breakdown, []) : null;
  const studioAdvanceAvailable = needsBookingAdvance({ enabled: ADVANCE_SPLIT_ENABLED, studioSelected: true,
    onlineAvailable: payHow.online, giftCovered: Boolean(giftCode), membershipCovered: washOn,
    priceOnRequest: service?.priceOnRequest === true, advancePaise: advancePreview?.advancePaise ?? null });
  const advanceDue = studioAdvanceAvailable && (payAtStudio || !payHow.online);
  const holdLeft = held ? Math.max(0, Math.ceil((held.expiresAt - now) / 1000)) : 0;

  // Pickup-time options come only from grounded hours: the booking day's
  // opening time is read from the live studio record - the same hours the
  // booking engine used to offer this slot. While that record loads, after a
  // failed fetch, or on a closed day there is no list and no invented
  // default; the booking and the pickup request stand either way.
  const [studioHours, setStudioHours] = useState<PickupDayHours>({ status: "loading" });
  useEffect(() => {
    let alive = true;
    setStudioHours({ status: "loading" });
    void getStudioInfo(FIRST_STUDIO_ID)
      .then((info) => { if (alive) setStudioHours(pickupDayHoursFor(info, params.scheduledDate)); })
      .catch(() => { if (alive) setStudioHours({ status: "unavailable" }); });
    return () => { alive = false; };
  }, [params.scheduledDate]);
  const pickupSlots = pickupSlotOptions(params.scheduledTime, studioHours);
  // A stale choice can never survive: the shown and sent preference is always
  // one of the current options, or nothing.
  const chosenSlot = validPickupSlot(pickupSlot, pickupSlots);
  const pickupQuoteInfo = currentPickupQuote(transportDraft,now);

  const combinedMode=COMBINED_CHECKOUT_ENABLED&&(!giftCode||COMBINED_GIFT_CHECKOUT_ENABLED)&&(!washOn||COMBINED_WASH_CHECKOUT_ENABLED)&&service?.priceOnRequest!==true;
  let freePickupMembership:string|null=null,pickupBenefitError:string|null=null;
  if(combinedMode&&COMBINED_PICKUP_BENEFIT_ENABLED&&pickupKind&&pickupQuoteInfo&&pickupQuoteInfo.feePaise>0){
    if(!pickupPlans||pickupPlans.scope!==scopeKey||pickupPlans.status!=="ready")pickupBenefitError="Check your transport benefits before confirming. Reload this review if needed.";
    else if(auth.status!=="ready"||!auth.customerDocId||!auth.claims?.tenantId)pickupBenefitError="Your customer profile needs review.";
    else try{freePickupMembership=reviewedPickupEntitlement(pickupPlans.list,{tenantId:auth.claims.tenantId,customerId:auth.customerDocId,visitDate:params.scheduledDate,today:new Date().toISOString().slice(0,10)})}catch(e){pickupBenefitError=e instanceof Error?e.message:"Review transport benefits."}
  }
  function reviewedCombined(choice:CombinedPaymentChoice){
    if(pickupBenefitError)throw Error(pickupBenefitError);
    if(!breakdown)throw Error("Price unavailable. Reload this review.");
    if(pickupKind&&(!pickupQuoteInfo||!pickupWhere))throw Error("Recheck the selected pickup/drop distance before continuing.");
    return combinedCheckoutReview(giftCode?giftCombinedServicePreview(breakdown):washOn?washCombinedServicePreview(breakdown):breakdown,choice,pickupKind&&pickupQuoteInfo&&pickupWhere?{quoteId:pickupQuoteInfo.quoteId,kind:pickupKind,lat:pickupWhere.lat,lng:pickupWhere.lng,address:pickupAddress,legs:pickupQuoteInfo.legs,...(pickupKind!=="drop"&&chosenSlot?{requestedPickupTime:chosenSlot}:{})}:undefined,freePickupMembership!==null);
  }
  let combinedReview:ReturnType<typeof reviewedCombined>|null=null,combinedReviewError:string|null=null;
  if(combinedMode&&breakdown){try{combinedReview=reviewedCombined(combinedChoice??"advance20")}catch(e){combinedReviewError=e instanceof Error?e.message:"Review the price again."}}
  let combinedAdvance:ReturnType<typeof reviewedCombined>|null=null;
  if(combinedMode&&breakdown){try{combinedAdvance=reviewedCombined("advance20")}catch{ /* selection/action remains unavailable until the quote is complete */ }}

  const combinedNoPayment=combinedMode&&combinedReview?.payment.totalPaise===0;
  const combinedReviewKey=combinedMode&&combinedChoice&&combinedReview?JSON.stringify([scopeKey,giftCode,washOn?washOffer?.membershipId:null,freePickupMembership,combinedReview.review,combinedReview.payment]):null;
  useEffect(()=>{setCombinedSheetKey(null)},[combinedReviewKey]);
  const combinedKeyRef=useRef(combinedReviewKey);combinedKeyRef.current=combinedReviewKey;
  const combinedSheetRef=useRef(combinedSheetKey);combinedSheetRef.current=combinedSheetKey;
  const combinedSheetVisible=combinedSheetKey!==null&&combinedSheetKey===combinedReviewKey;
  function openCombinedReview(){if(held||combinedNoPayment){void handleConfirm();return;}if(combinedReviewKey)setCombinedSheetKey(combinedReviewKey);}
  function payCombinedReview(){
    if(!combinedSheetVisible||booking||confirmBusy.current||!combinedReviewKey||combinedKeyRef.current!==combinedReviewKey||combinedSheetRef.current!==combinedReviewKey)return;
    if(pickupKind&&!currentPickupQuote(transportDraft,Date.now())){setCombinedSheetKey(null);setBookError("Recheck pickup/drop before paying. The quote expired.");return;}
    void handleConfirm();
  }


  function choosePickupKind(k: "pickup" | "drop" | "both") {
    actionGeneration.current++;
    setLocating(false);
    setPickupQuote(null);
    setPickupQuoteError(null);
    setPickupWhere(null);
    if (pickupKind === k) {
      setPickupKind(null);
      setPickupAddress("");
      setPickupSlot("");
    } else {
      setPickupKind(k);
    }
  }

  async function locatePickup() {
    if (!pickupKind) return;
    const scope=scopeKey,gen=actionGeneration.current,kind=pickupKind;
    setLocating(true);
    setPickupQuote(null);
    setPickupQuoteError(null);
    const p = await getDeviceLocation();
    if(scopeRef.current!==scope||actionGeneration.current!==gen)return;
    if (!p) {
      setPickupWhere(null);
      setLocating(false);
      return;
    }
    try {
      const q = await getPickupQuote({ kind: pickupKind, lat: p.lat, lng: p.lng });
      if(scopeRef.current!==scope||actionGeneration.current!==gen)return;
      setPickupWhere(p);
      setPickupQuote(q);
    } catch {
      if(scopeRef.current!==scope||actionGeneration.current!==gen)return;
      // Approved failure behaviour: no estimate is ever shown or charged. The customer can retry or continue
      // without pickup; no other fallback is offered from this failure.
      setPickupWhere(null);
      setPickupQuoteError("We could not check the road distance right now. You can try again, or continue without pickup.");
    }
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
        ...(pickupWhere && pickupQuoteInfo ? { lat: pickupWhere.lat, lng: pickupWhere.lng, quoteId: pickupQuoteInfo.quoteId } : {}),
        ...(pickupKind !== "drop" && chosenSlot ? { requestedPickupTime: chosenSlot } : {}),
      });
      return true;
    } catch {
      return false;
    }
  }

  /** Opens checkout for the held booking. Success goes to the booking; a failure or close stays here with the slot held. */
  async function payHeld(h: { bookingId: string; paymentJobId: string | null; expiresAt: number; pickupSent: boolean; advance?: boolean; expectedAdvancePaise?: number }) {
    if (payBusy.current || !service) return;
    const scope=scopeKey,gen=actionGeneration.current;const current=()=>scopeRef.current===scope&&actionGeneration.current===gen;
    payBusy.current = true;
    setBooking(true);
    setBookError(null);
    try {
      if (h.advance) {
        const adv = await requestAdvancePayment(h.bookingId, h.expectedAdvancePaise);
        if(!current())return;
        if (adv.status === "manual_review" || !adv.paymentUrl) {
          setBookError("We're confirming your advance payment link. Please try again in a few minutes.");
          return;
        }
        const out = await payWithPaymentLink(adv.paymentId, adv.paymentUrl);
        if(!current())return;
        const message = bookingPayOutcomeMessage(out);
        if (message) { setBookError(message); return; }
        transportUpdate({kind:null,address:'',where:null,quote:null});
      router.replace({ pathname: "/(tabs)/bookings/[id]", params: { id: h.bookingId, placed: "1", ...(h.pickupSent ? {} : { pickup: "failed" }) } });
        return;
      }
      if (!h.paymentJobId) throw new Error("no checkout");
      const pay = await initiatePayment(h.paymentJobId, "razorpay_payment_link");
      if(!current())return;
      const out = pay.paymentId ? await payOnline({ paymentId: pay.paymentId, paymentUrl: pay.paymentUrl, name: "AutoDeck Studio", description: service.name }) : "failed";
      if(!current())return;
      if (out === "paid") {
        transportUpdate({kind:null,address:'',where:null,quote:null});
      router.replace({ pathname: "/(tabs)/bookings/[id]", params: { id: h.bookingId, placed: "1", pay: "paid", ...(h.pickupSent ? {} : { pickup: "failed" }) } });
        return;
      }
      setBookError(bookingPayOutcomeMessage(out));
    } catch (err) {
      if(current())setBookError((err as { details?: { reason?: string } })?.details?.reason === "advance_amount_changed" ? "The advance amount changed. Check this booking in your bookings before paying. No payment was opened." : "We could not open the payment. Please retry.");
    } finally {
      if(current()){payBusy.current = false;setBooking(false);}
    }
  }

  async function handleConfirm() {
    if(booking || !service || !vehicle || !breakdown) return;
    if(confirmBusy.current)return;
    if (combinedMode&&(!combinedReview||!combinedNoPayment&&!combinedChoice)) {setBookError(combinedReviewError??"Choose 20% advance or full payment before continuing.");return;}
    if (!combinedMode&&ADVANCE_SPLIT_ENABLED && !payNow && !giftCode && !washOn && !service.priceOnRequest && !advancePreview) { setBookError("We could not verify the advance amount. Reload this booking review before continuing."); return; }
    if (held) { if (!heldOver) await payHeld(held); return; }
    if (!params.serviceId || !params.vehicleId || !params.vehicleCategory || !params.scheduledDate || !params.scheduledTime) return;
    const scope=scopeKey,gen=actionGeneration.current;const current=()=>scopeRef.current===scope&&actionGeneration.current===gen;confirmBusy.current=true;
    setBooking(true);
    setBookError(null);
    let created = false;
    try {
      const result = await createBooking({
        serviceId: params.serviceId,
        vehicleId: params.vehicleId,
        vehicleCategory: params.vehicleCategory,
        studioId: FIRST_STUDIO_ID,
        scheduledDate: params.scheduledDate,
        scheduledTime: params.scheduledTime,
        idempotencyKey:idempotencyKey.current,
        payMode: combinedMode?combinedNoPayment?"online":combinedChoice==="full"?"online":"studio":payNow ? "online" : "studio",
        ...(combinedMode&&combinedReview?{combinedReview:(combinedNoPayment?reviewedCombined("full"):combinedReview).review}:ADVANCE_SPLIT_ENABLED ? { advanceFlowVersion: 1 as const } : {}),
        ...(washOn && washOffer ? { membershipId: washOffer.membershipId } : {}),
        ...(sendCode ? { referralCode: sendCode } : {}),
        ...(giftCode ? { giftCode } : {}),
      });
      if(!current())return;
      created = true;
      // Create the booking exactly as before, then request pickup/drop with
      // the new booking id (round 8). The request's failure never fails the
      // booking - the booking page shows a call-the-studio note instead.
      const pickupSent = combinedMode?true:await sendPickupRequest(result.id);
      if(!current())return;
      // Retain the created booking before requesting its link: every retry uses
      // this same booking/payment, never creates a second held booking.
      if(combinedNoPayment){
        if(result.status!=="CONFIRMED"||result.totalAmount!==0||result.combinedPayment?.totalPaise!==0||result.combinedPayment?.payNowPaise!==0||result.holdExpiresAt)throw Error("Zero-payment confirmation needs review.");
        transportUpdate({kind:null,address:'',where:null,quote:null});
        router.replace({pathname:"/(tabs)/bookings/[id]",params:{id:result.id,placed:"1"}});
        return;
      }
      if ((combinedMode&&combinedChoice==="advance20"||!combinedMode&&advanceDue) && (result.status === "CONFIRMED" || result.status === "PENDING")) {
        const h = { bookingId: result.id, paymentJobId: null,
          expiresAt: Date.parse(result.holdExpiresAt ?? "") || Date.now() + 15 * 60_000,
          pickupSent, advance: true, ...(combinedMode&&combinedReview?{expectedAdvancePaise:combinedReview.payment.payNowPaise}:advancePreview ? { expectedAdvancePaise: advancePreview.advancePaise } : {}) };
        setHeld(h);
        await payHeld(h);
        return;
      }
      if (result.status === "PENDING" && auth.status === "ready") {
        // Held for 15 minutes until paid. Pay now; if it fails the customer retries on this page.
        const jobOwnerKey = listOwnerKey(auth); const jobId = jobOwnerKey ? await getJobIdForBooking(result.id, auth.claims.tenantId, jobOwnerKey.key).catch(() => null) : null;
        if(!current())return;
        const h = { bookingId: result.id, paymentJobId: jobId, expiresAt: Date.parse(result.holdExpiresAt ?? "") || Date.now() + 15 * 60_000, pickupSent };
        setHeld(h);
        setBooking(false);
        await payHeld(h);
        return;
      }
      transportUpdate({kind:null,address:'',where:null,quote:null});
      router.replace({ pathname: "/(tabs)/bookings/[id]", params: { id: result.id, placed: "1", ...(pickupSent ? {} : { pickup: "failed" }) } });
    } catch (err) {
      console.warn("create booking failed", err);
      if(current())setBookError(created ? combinedNoPayment?"We could not verify this booking. Check your bookings before trying again.":"We could not open the payment. Please retry." : "We could not send your request. Check your bookings first - if it reached the studio, it appears there.");
    } finally {
      if(current()){confirmBusy.current=false;if (!payBusy.current) setBooking(false);}
    }
  }

  if (loading) return <Loading label="Getting your price" />;
  if (loadError) return <Screen><Notice title="Can't load details" body="Check your connection and try again." action={<Button icon="refresh" label="Retry" onPress={()=>setRetryTick(n=>n+1)}/>} /></Screen>;

  const displayDate =
    params.scheduledDate &&
    new Date(`${params.scheduledDate}T12:00:00Z`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });

  const isMultiDay = !!params.estimatedEndDate && params.estimatedEndDate !== params.scheduledDate;
  const displayEndDate =
    params.estimatedEndDate &&
    new Date(`${params.estimatedEndDate}T12:00:00Z`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });

  const durationLabel = service ? formatServiceTime(service.estimatedDurationMinutes) : "-";
  // Pickup/drop fee rides inside the shown total once the server quote exists; the fee
  // itself is still paid at the studio (PICKUP_POLICY), never added to the online charge.
  const pickupFeePaise = pickupQuoteInfo ? pickupQuoteInfo.feePaise : null;
  const visitTotal = combinedMode?combinedReview?.breakdown.total??null:breakdown ? breakdown.total + (pickupFeePaise ?? 0) : null;
  const shownBreakdown=combinedMode&&combinedReview?combinedReview.breakdown:breakdown;

  return (
    <Screen header={<View style={{ gap: space.hair }}><Kicker tone="accent">Confirm</Kicker><T role="title">Review booking</T>{service?.priceOnRequest === true ? <T role="caption" tone="accent">Quote on request</T> : null}</View>}>
      <Sheet>
        <SheetLine small label="Service" value={service?.name ?? "-"} />
        <SheetLine small label="Car" value={vehicle ? `${vehicle.make} ${vehicle.model} · ${vehicle.registrationNumber}` : "-"} />
        <SheetLine small label="Date" value={displayDate ?? "-"} />
        <SheetLine small label="Time" value={params.scheduledTime ? `${params.scheduledTime}` : "-"} />
        <SheetLine small label="Duration" value={durationLabel} />
        <SheetLine small label="Expected ready" value={displayEndDate ? `${displayEndDate}${params.endTime ? `, ${params.endTime}` : ""}` : "-"} last />
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
            trailing={<Button kind={washOn ? "primary" : "quiet"} label={washOn ? "Using it" : "Use"} disabled={booking||held!==null} onPress={() => {if(!booking&&!held)setUseWash(!useWash)}} />}
            last
          />
        </Pane>
      ) : null}

            <View style={{ gap: space.line }}>
        <Kicker>Pickup and drop (optional)</Kicker>
        <Pane pad="gap" style={{ gap: space.gap }}>
          <PickupOptions value={pickupKind} onChange={choosePickupKind} />
          {pickupKind ? (
            <View style={{ gap: space.line }}>
              <Field
                label="Address"
                value={pickupAddress}
                onChangeText={setPickupAddress}
                placeholder="e.g. 12, Sunrise Apartments, CG Road"
                multiline
                error={pickupAddress.trim().length > 0 && pickupAddress.trim().length < 8 ? "Enter the full address" : undefined}
              />
              <Button label={pickupWhere ? "Location added" : "Use my location to check distance"} kind="quiet" busy={locating} onPress={() => void locatePickup()} />
              {pickupQuoteInfo ? <T role="caption" tone="secondary">{describePickupQuote(pickupQuoteInfo)}</T> : null}
              {pickupQuoteError ? <T role="caption" tone="secondary">{pickupQuoteError}</T> : null}
              {pickupKind !== "drop" && studioHours.status === "loading" ? (
                <T role="caption" tone="secondary">Checking the studio's hours for pickup times...</T>
              ) : null}
              {pickupKind !== "drop" && pickupSlots.length > 0 ? (
                <>
                  <SelectField
                    label={pickupKind === "both" ? "Preferred pickup time (optional)" : "Preferred time (optional)"}
                    value={chosenSlot}
                    onChange={setPickupSlot}
                    options={[{ value: "", label: "No preference" }, ...pickupSlots.map((s) => ({ value: s, label: s }))]}
                  />
                  <T role="caption" tone="secondary">This is your preference, not a confirmed slot. The studio agrees the exact time with you by phone call.</T>
                </>
              ) : null}
            </View>
          ) : null}
        </Pane>
      </View>
      {(giftCode || washOn)&&!combinedMode ? (
        <Sheet>
          {giftCode ? <SheetTotal label="Covered by your gift" value="Included" /> : <SheetTotal label="Wash from your plan" value="Included" />}
        </Sheet>
      ) : service?.priceOnRequest !== true && breakdown ? (
        <Sheet>
          <SheetTotal label="Total" value={rupees(visitTotal ?? breakdown.total)} />
          {combinedMode&&combinedReview?.breakdown.roundOffPaise?<SheetLine small label="Round off" value={rupees(combinedReview.breakdown.roundOffPaise)}/>:null}
          {combinedMode&&giftCode?<SheetLine small label="Gifted service" value="Included"/>:combinedMode&&washOn?<SheetLine small label="Membership wash" value="Included"/>:null}
          <SheetDivider />
          {combinedMode&&(giftCode||washOn)?null:<SheetLine small label="Base" value={rupees(breakdown.basePrice)} />}
          {!(combinedMode&&(giftCode||washOn))&&breakdown.scopeAdjustment > 0 ? <SheetLine small label="Vehicle size adjustment" value={`+${rupees(breakdown.scopeAdjustment)}`} /> : null}
          {breakdown.membershipDiscount !== null && breakdown.membershipDiscount > 0 ? <SheetLine small label="Membership discount" value={`-${rupees(breakdown.membershipDiscount)}`} /> : null}
          {(shownBreakdown?.tax??0) > 0 ? <SheetLine small label={shownBreakdown?.taxDescription??breakdown.taxDescription} value={rupees(shownBreakdown?.tax??0)} /> : null}
          {pickupKind ? <SheetLine small label="Pickup/drop" value={freePickupMembership?"Included with your plan":pickupFeePaise === null ? "After location check" : pickupFeePaise === 0 ? "Free" : combinedMode?rupees(pickupFeePaise):`${rupees(pickupFeePaise)} · paid at the studio`} /> : null}
          {!combinedMode&&payNow && pickupFeePaise ? <SheetLine small label="Pay online now" value={rupees(breakdown.total)} /> : null}
          {!combinedMode&&advanceDue && advancePreview ? (
            <>
              <SheetLine small label="Pay now (20% advance)" value={rupees(advancePreview.advancePaise)} />
              <SheetLine small label={pickupKind ? "Pay at the studio (before pickup/drop fees)" : "Pay at the studio"} value={rupees(advancePreview.dueAtStudioPaise)} />
            </>
          ) : null}
        </Sheet>
      ) : null}

      {freePickupMembership?<Pane pad="gap"><Row title="Plan transport benefit" detail="One free pickup/drop request will be reserved with this booking." last/></Pane>:null}
      {combinedMode?combinedReviewError?<Notice title="Review pickup/drop" body={combinedReviewError}/>:combinedAdvance?<Pane pad="gap"><CombinedPaymentOptions transportIncluded={freePickupMembership!==null} coveredService={giftCode?"gift":washOn?"membership":undefined} choice={combinedChoice} total={combinedAdvance.payment} disabled={booking||held!==null} onChange={setCombinedChoice}/>{combinedReview&&combinedChoice?<View><SheetLine small label="Pay now" value={rupees(combinedReview.payment.payNowPaise)}/><SheetLine small label="Booking balance at studio" value={rupees(combinedReview.payment.balancePaise)} last/></View>:null}</Pane>:null:null}

      {saving !== null ? (
        <Pane pad="gap">
          <Row title={`Members save ${rupees(saving)} on this wash`} detail={<T role="caption" tone="secondary">Club plans include washes at a lower rate each.</T>} trailing={<Button kind="quiet" label="Join Club" onPress={() => router.navigate("/(tabs)/membership")} />} last />
        </Pane>
      ) : null}

      {service?.priceOnRequest === true ? <Pane pad="gap"><Row title="Price" detail={<T role="caption" tone="secondary">Quote on request. The studio sets the price for your car and you approve it before work starts.</T>} last /></Pane> : null}

      <T role="caption" tone="tertiary" style={{ textAlign: "center" }}>
        {combinedNoPayment?"No payment is needed. Confirm your booking below.":combinedMode?"Review the combined total and your payment choice before confirming.":bookingConfirmCopy({quote:service?.priceOnRequest===true,gift:Boolean(giftCode),membership:washOn,online:payNow,advance:advanceDue})}
      </T>
      {combinedMode||service?.priceOnRequest === true || washOn || giftCode ? null : <View style={{ gap: space.line }}>
        <Kicker>How will you pay</Kicker>
        <Pane pad="gap">
          {payHow.online ? (
            <Pressable accessibilityRole="button" accessibilityState={{ selected: !payAtStudio }} onPress={() => { if (!held) setPayAtStudio(false); }}>
              <Row title="Pay online" detail={<T role="caption" tone="secondary">Confirm below to open secure payment. The slot is held for 15 minutes after your request.</T>} trailing={!payAtStudio ? <Icon name="check" color="#EC8638" size={20} /> : undefined} last={false} />
            </Pressable>
          ) : null}
          <Pressable accessibilityRole="button" accessibilityState={{ selected: payAtStudio || !payHow.online }} onPress={() => { if (!held) { setPayAtStudio(true); if (studioAdvanceAvailable) setAdvanceSheet(true); } }}>
            <Row title="Pay at studio" detail={<T role="caption" tone="secondary">{studioAdvanceAvailable ? "Pay 20% advance online to confirm. Slot held for 15 minutes; the rest at the studio." : "Confirm your slot below. Pay when you collect your car."}</T>} trailing={payAtStudio || !payHow.online ? <Icon name="check" color="#EC8638" size={20} /> : undefined} last={!advanceDue && !payNow} />
          </Pressable>
          {/* Disclose the policy for the effective payment route only. */}
          {ADVANCE_SPLIT_ENABLED && (advanceDue || payNow) ? (
            <View style={{ paddingHorizontal: space.line, paddingTop: space.line, paddingBottom: space.line }}>
              {advanceDue ? (
                <>
                  <T role="caption" tone="secondary">{advanceDisclosureLines().split}</T>
                  <T role="caption" tone="secondary">{advanceDisclosureLines().noShow}</T>
                </>
              ) : (
                <T role="caption" tone="secondary">{advanceDisclosureLines().noShowFullOnline}</T>
              )}
            </View>
          ) : null}
        </Pane>
      </View>}

      <Pane pad="gap">
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: showTerms }} onPress={() => setShowTerms(!showTerms)}>
          <Row title="Changes, cancellation and visit terms" detail={showTerms ? undefined : <T role="caption" tone="secondary">Change and cancellation options, pickup terms and help.</T>} trailing={<T role="bodyStrong" tone="accent">{showTerms ? "Hide" : "View"}</T>} last />
        </Pressable>
        {showTerms ? (
          <View style={{ gap: space.line }}>
            <Row title="Changes" detail="Request from your booking. Approval is separate."/>
            <Row title="Cancellation" detail="Review the fee before confirming."/>
            <Row title="Transport" detail={combinedMode?"Selected pickup/drop is included in this total.":"Pickup/drop is a separate request."}/>
            <Row title="Timing" detail="The studio confirms transport timing with you."/>
            {combinedMode?<><Row title="Bigger-service late cancel" detail="20% of service including GST."/><Row title="Late cancel window" detail="Free until 24 hours before."/><Row title="Unused pickup/drop" detail="Excluded from that percentage fee."/><Row title="No-show retention" detail="20% of discounted service, including GST."/><Row title="Unused transport" detail="Excluded from no-show retention."/><Row title="Refund remainder" detail="Sent for approval. Not refunded until processed."/></>:null}
            <Pressable accessibilityRole="button" onPress={() => router.navigate("/(tabs)/help")}><T role="caption" tone="secondary">Questions before booking? <T role="caption" tone="accent">Open Help & contact.</T></T></Pressable>
          </View>
        ) : null}
      </Pane>

      {bookError ? <Notice title={held ? "Payment pending" : "Could not confirm the request"} body={bookError} /> : null}

      {held && !heldOver ? <T role="caption" tone="secondary" style={{ textAlign: "center" }}>{`Slot held for ${Math.floor(holdLeft / 60)}:${String(holdLeft % 60).padStart(2, "0")}`}</T> : null}
      {heldOver ? <Notice title="Time ran out" body="Payment was not completed in 15 minutes, so the slot was released. Pick a time again." action={<Button label="Pick a time" onPress={() => router.back()} />} /> : null}

      <View style={{ gap: space.breath }}>
        {heldOver ? null : <Button label={combinedNoPayment?"Confirm booking":combinedMode?combinedChoice==="advance20"?"Pay 20% & confirm":"Pay in full & confirm":service?.priceOnRequest === true ? "Request quote" : payNow || held ? "Pay & confirm" : advanceDue ? "Pay 20% advance" : "Confirm booking"} busy={booking} disabled={booking||combinedMode&&(!combinedReview||!combinedNoPayment&&!combinedChoice)} onPress={() => { if(combinedMode){openCombinedReview();return;} if (!combinedMode&&advanceDue && !held) { setAdvanceSheet(true); return; } void handleConfirm(); }} />}
        {held && !heldOver ? <T role="caption" tone="tertiary" style={{ textAlign: "center" }}>Your booking is pending until the payment goes through.</T> : <Button label="Go back" kind="quiet" onPress={() => router.back()} />}
      </View>
      {combinedMode&&combinedChoice&&combinedReview&&!combinedNoPayment?<CombinedPaymentSheet visible={combinedSheetVisible} serviceName={service?.name??"Service"} summary={giftCode||washOn?"Your service is included. Any selected payable pickup/drop is in this total.":freePickupMembership?"Your pickup/drop benefit is included. This total is for your service.":"Includes your service and selected pickup/drop."} choice={combinedChoice} totalPaise={combinedReview.payment.totalPaise} payNowPaise={combinedReview.payment.payNowPaise} balancePaise={combinedReview.payment.balancePaise} busy={booking} onPay={payCombinedReview} onGoBack={()=>setCombinedSheetKey(null)}/>:null}
      {!combinedMode&&ADVANCE_SPLIT_ENABLED && advancePreview ? (
        <AdvancePaymentSheet
          visible={advanceSheet}
          serviceName={service?.name ?? "Service"}
          visitLabel={[displayDate, params.scheduledTime].filter(Boolean).join(" · ")}
          serviceTotalPaise={advancePreview.serviceTotalPaise}
          advancePaise={advancePreview.advancePaise}
          balancePaise={advancePreview.serviceTotalPaise - advancePreview.advancePaise}
          pickupFees={Boolean(pickupKind)}
          busy={booking}
          onPayAdvance={() => { setAdvanceSheet(false); void handleConfirm(); }}
          onGoBack={() => setAdvanceSheet(false)}
        />
      ) : null}
    </Screen>
  );
}
