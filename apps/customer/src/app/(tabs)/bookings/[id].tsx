import {VisitFeedback} from '../../../ui/VisitFeedback';
import {VisitRecords} from '../../../ui/VisitRecords';
import { cancellationErrorMessage } from "../../../lib/cancellation-error";
import { JobWorkAndCoverage } from "../../../ui/JobWorkAndCoverage";
import{verifyMyCustomerDocId}from'../../../lib/auth-service';
import { bookingPayOutcomeMessage } from "../../../lib/native-pay-core";
import { listOwnerKey } from "../../../lib/owner-key";
import { useMinuteNow } from "@autodeck/ui/clock";
import { membershipCoveredLabel, visitTiming, customerTimingLine } from "@autodeck/core";
import { manualRefundNotice } from "../../../lib/manual-refund-notice";
import { formatServiceTime } from "../../../lib/duration";
import { invoiceHref } from "../../../lib/invoice-display";
import {canResumeBookingAdvance,canResumeJobPayment,customerPaymentLabel}from "../../../lib/existing-job-payment";
import { useState, useEffect, useRef } from "react";
import { CarThumb } from "../../../ui/CarThumb";
import { listenToMyVehicles } from "../../../lib/vehicle-service";
import { useAuth } from "../../../hooks/useAuth";
import type { Vehicle } from "@autodeck/core";
import { Linking, Platform, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { listenToBooking, cancelBooking, approveBookingQuote, declineBookingQuote } from "../../../lib/booking-service";
import { getJobIdForBooking } from "../../../lib/job-service";
import { initiatePayment, requestAdvancePayment } from "../../../lib/payment-service";
import { payOnline, payWithPaymentLink } from "../../../lib/razorpay-checkout";
import { translate, useLang } from "../../../lib/i18n";
import { listenToJobForBooking, listenToJobById, bookingFromJob } from "../../../lib/job-service";
import { listenToPaymentForJob } from "../../../lib/payment-service";
import { listenToApprovalsForJob, respondToApproval } from "../../../lib/approval-service";
import { getReview, submitReview } from "../../../lib/review-service";
import { Pressable } from "react-native";
import { PickupCard } from "../../../ui/PickupCard";
import { listenToInspection } from "../../../lib/inspection-service";
import type { Booking, ServiceJob, Payment, ApprovalRequest, Inspection } from "@autodeck/core";
import { MAX_CUSTOMER_RESCHEDULES, isBookingMissed, isBookingLateToday, bookingCode } from "@autodeck/core";
import type * as BookingDevSample from "../../../lib/booking-dev-sample";
// Dev-only sample data: required only under __DEV__ so production bundles never contain it (see metro.config.js and scripts/prod-bundle-guard.mjs).
const devSample = __DEV__ ? (require("../../../lib/booking-dev-sample") as typeof BookingDevSample) : null;
import { space } from "@autodeck/ui/theme";
import { Icon, useExperienceTheme } from "@autodeck/ui/native";
import { getRescheduleEligibility, rescheduleEntry, formatStudioLocal, cancelState, expectedReady, readyRowTitle } from "../../../lib/booking-rules";
import { googleCalendarUrl, icsFor } from "../../../lib/calendar-link";
import { enablePush, pushPermission } from "../../../lib/push";
import { shouldAskPush, PUSH_ASKED_KEY } from "../../../lib/push-ask";
import { LiveJobCard } from "../../../ui/LiveJobCard";
import { JobTimeline } from "../../../ui/JobTimeline";
import { jobStage, readyIsAhead } from "../../../ui/job-stage";
import { ServicePhoto } from "../../../ui/ServicePhoto";
import { getServiceCatalogue } from "../../../lib/catalogue-service";
import { metrics } from "../../../lib/metrics";
import { Button, Chip, Field, Kicker, Loading, Notice, Pane, Row, Screen, T, rupees } from "../../../ui/kit";

const JOB_STATUS_LABELS: Record<string, string> = {
  STANDBY: "Arrived - standby",
  PENDING_VEHICLE: "Awaiting vehicle drop-off",
  VEHICLE_RECEIVED: "Vehicle received",
  IN_PROGRESS: "Service in progress",
  QUALITY_CHECK: "Quality check",
  READY_FOR_DELIVERY: "Ready for pickup",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

const TRACK_STEPS = ["PENDING_VEHICLE", "VEHICLE_RECEIVED", "IN_PROGRESS", "QUALITY_CHECK", "READY_FOR_DELIVERY", "DELIVERED"] as const;

const EXISTING_PAYMENT_PENDING = "Payment is not confirmed yet. This page updates after server verification. Do not pay a second time.";
const EXISTING_PAYMENT_OPEN_FAILED = "Could not open the existing payment. Do not start a second payment; contact the studio.";

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: "Awaiting confirmation at studio",
  processing: "Processing",
  completed: "Paid",
  failed: "Payment failed - please try again",
  cancelled: "Payment cancelled",
  refunded: "Refunded",
  partial: "Partially refunded",
};

const BOOKING_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  ACTIVE: "Vehicle at studio",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
};

const BOOKING_CHIP_TONE: Record<string, "neutral" | "accent" | "premium" | "danger"> = {
  PENDING: "neutral",
  CONFIRMED: "accent",
  ACTIVE: "accent",
  COMPLETED: "premium",
  CANCELLED: "danger",
  EXPIRED: "danger",
};

// Multi-day PPF services run into thousands of minutes - express as hours
// once past a day (this is service-time, not calendar time; the
// authoritative calendar span is shown separately via "Expected ready").

export default function BookingDetailScreen() {
  const { id, placed, mock, pickup, returnTo } = useLocalSearchParams<{ id: string; placed?: string; mock?: string; pickup?: string; returnTo?: string }>();
  // Opened from Notifications: Back returns to that list, not an unrelated default.
  // Dev preview only (?mock=1/2, __DEV__): sample screens render without a session,
  // but a persisted Firebase session can exist in this browser - so every write and
  // every navigation into a write flow is blocked explicitly, never relying on the
  // fake ids being rejected by the backend.
  const [workOpen, setWorkOpen] = useState(false);
  useEffect(()=>setWorkOpen(false),[id]);
  const isMock = __DEV__ && !!devSample && (mock === "1" || mock === "2");
  const router = useRouter();
  useLang();
  const [, tick] = useState(0);
  useEffect(() => { const timer = setInterval(() => tick(n => n + 1), 30000); return () => clearInterval(timer); }, []);
  const [retryTick,setRetryTick] = useState(0);
  const [feedError,setFeedError] = useState<string|null>(null);
  const authB = useAuth();
  const[resolvedRoute,setResolvedRoute]=useState('');
  const [booking, setBooking] = useState<Booking | null>(null);
  const [walkIn, setWalkIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [payingNow, setPayingNow] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [awaitingLinkId,setAwaitingLinkId]=useState<string|null>(null);
  const routeScope=JSON.stringify([id,authB.status,authB.status==='ready'?listOwnerKey(authB)?.key??null:null,authB.status==='ready'?authB.claims.tenantId:null,retryTick]);const routeRef=useRef(routeScope);routeRef.current=routeScope;const actionEpoch=useRef(0),actionLock=useRef(false);
  useEffect(()=>{actionEpoch.current++;actionLock.current=false;setCancelling(false);setPayingNow(false);setConfirmingCancel(false);setActionError(null);setAwaitingLinkId(null);setStars(0);setNote('');setRated(false);setRateBusy(false);setRateError(null);setDecidingId(null);setDecideError(null);setQuoteBusy(false);return()=>{actionEpoch.current++}},[routeScope]);
  const mockWriteBlocked = (): boolean => {
    if (!isMock) return false;
    setActionError("Sample preview - changes are not saved.");
    return true;
  };
  const minuteNow = useMinuteNow();
  const [job, setJob] = useState<ServiceJob | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const[paymentRead,setPaymentRead]=useState<'loading'|'ready'|'error'>('loading');const[paymentScope,setPaymentScope]=useState('');const paymentGeneration=useRef(0);const resumeLock=useRef(false);

  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const liveApprovalsRef=useRef(approvals);liveApprovalsRef.current=approvals;
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const { colors } = useExperienceTheme();
  const reviewEdits=useRef(0);
  const [stars, setStars] = useState(0);
  const [note, setNote] = useState("");
  const [rated, setRated] = useState(false);

  const [rateBusy, setRateBusy] = useState(false);
  const [rateError, setRateError] = useState<string | null>(null);



  async function handleRate() {
    if (mockWriteBlocked()) return;
    if (!id || booking?.status!=="COMPLETED" || stars < 1||actionLock.current) return;
    const scope=routeScope,gen=actionEpoch.current;const current=()=>routeRef.current===scope&&actionEpoch.current===gen;actionLock.current=true;
    setRateBusy(true);
    setRateError(null);
    try {
      await submitReview(id, stars, note,job?.id);
      if(current())setRated(true);
    } catch {
      if(current())setRateError("Couldn't save your rating. Try again.");
    } finally {
      if(current()){actionLock.current=false;setRateBusy(false);}
    }
  }

  useEffect(() => {
    // Dev preview only (__DEV__ is false in production builds): show sample data, no network.
    if (__DEV__ && devSample && mock === "1") { setBooking(devSample.DEV_SAMPLE_BOOKING); setSvc(devSample.DEV_SAMPLE_SERVICE); setSvcLoaded(true); setLoading(false); setPayment(null); setPaymentRead('ready'); return; }
    if (__DEV__ && devSample && mock === "2") { setBooking(devSample.DEV_SAMPLE_PREMIUM_BOOKING); setSvc(devSample.DEV_SAMPLE_PREMIUM_SERVICE); setSvcLoaded(true); setLoading(false); setPayment(null); setPaymentRead('ready'); return; }
    if (!id) {setLoading(false);return;}
    let alive=true;setLoading(true);setFeedError(null);setJob(null);setPayment(null);setBooking(null);setActionError(null);
    setWalkIn(false);
    let stopJob: (() => void) | undefined;
    let stopQuoteBooking:(()=>void)|undefined;
    // No booking under this id (or it is not readable): a walk-in visit has only a job, and the link carries the job id.
    const fallbackToJob = (err: Error | null) => {
      if(!alive)return;
      stopJob?.();
      stopJob = listenToJobById(
        id,
        (j) => {
          if(!alive)return;setResolvedRoute(id);
          if (j) { setResolvedRoute(id); setWalkIn(true); setFeedError(null); setJob(j); setBooking(bookingFromJob(j));if(j.bookingId){stopQuoteBooking?.();stopQuoteBooking=listenToBooking(j.bookingId,b=>{if(alive&&b){setWalkIn(true);setBooking(b);}},e=>{if(alive)setFeedError(e.message);});} }
          else if (err) setFeedError(err.message);
          else setBooking(null);
          setLoading(false);
        },
        (e) => { if(!alive)return;setResolvedRoute(id);setFeedError((err ?? e).message); setLoading(false); },
      );
    };
    const stopBooking = listenToBooking(id, (value) => { if(!alive)return;setResolvedRoute(id);if (value) { setResolvedRoute(id); stopJob?.(); stopJob = undefined; setWalkIn(false); setFeedError(null); setBooking(value); setLoading(false); } else fallbackToJob(null); }, (err) => fallbackToJob(err));
    return () => { alive=false;stopBooking(); stopJob?.();stopQuoteBooking?.(); };
  }, [id,retryTick]);

  useEffect(() => {
    if (!id || !booking || walkIn) return;
    let alive=true;const stop=listenToJobForBooking(id, booking.tenantId, booking.customerId,j=>{if(alive)setJob(j)},()=>{if(alive){setJob(null);if(!isMock){setPayment(null);setPaymentRead('error')}}});return()=>{alive=false;stop()};
  }, [id, booking?.tenantId, booking?.customerId, walkIn]);

  useEffect(() => {
    if (!job) {
      setInspection(null);
      return undefined;
    }
    setInspection(null);let alive=true;const stop=listenToInspection(job.id, value=>{if(alive)setInspection(value)}, () => undefined);return()=>{alive=false;stop()};
  }, [job?.id]);

  const liveBookingRef=useRef(booking),livePaymentRef=useRef(payment);liveBookingRef.current=booking;livePaymentRef.current=payment;
  const [verifiedOwner,setVerifiedOwner]=useState('');
  const bookOwnerKey=authB.status==='ready'?listOwnerKey(authB):null;const ownerKey=authB.status==='ready'&&job&&booking&&job.customerId===booking.customerId&&bookOwnerKey!==null&&bookOwnerKey.key===job.customerId&&job.tenantId===booking.tenantId&&job.tenantId===authB.claims.tenantId&&resolvedRoute===id?[authB.user.uid,authB.claims.tenantId,job.customerId,job.id,id].join('|'):'';
  useEffect(()=>{let alive=true;setVerifiedOwner('');if(ownerKey&&job)void verifyMyCustomerDocId(job.customerId).then(ok=>{if(alive&&ok)setVerifiedOwner(ownerKey)}).catch(()=>{});return()=>{alive=false};},[ownerKey]);
  const ownerVerified=Boolean(ownerKey)&&verifiedOwner===ownerKey;
  useEffect(()=>{
    if(!id||!booking||authB.status!=='ready'||booking.tenantId!==authB.claims.tenantId||listOwnerKey(authB)?.key!==booking.customerId||booking?.status!=='COMPLETED'||isMock)return;
    const edit=reviewEdits.current;let alive=true;
    void getReview(id,job?.id).then(r=>{if(alive&&r&&reviewEdits.current===edit){setStars(r.rating);setNote(r.comment);setRated(true)}}).catch(()=>{});
    return()=>{alive=false};
  },[id,booking?.status,job?.id,ownerVerified,routeScope,isMock]);
  const advanceBinding = booking?.combinedPayment?.choice === "advance20" && booking.paymentStatus === "unpaid" && booking.advancePaymentId ? { paymentId: booking.advancePaymentId, bookingId: booking.id, amount: booking.combinedPayment.payNowPaise, studioId: booking.studioId } : undefined;
  useEffect(() => {
    if(isMock)return;const generation=++paymentGeneration.current;resumeLock.current=false;setPayingNow(false);setPayment(null);setPaymentRead('loading');setPaymentScope('');
    if(!job||authB.status!=="ready"||job.tenantId!==authB.claims.tenantId||!ownerVerified||resolvedRoute!==id)return;
    const scope=[job.id,job.tenantId,job.customerId,advanceBinding?.paymentId??'job'].join('|');
    const stop=listenToPaymentForJob(job.id,job.tenantId,job.customerId,p=>{if(paymentGeneration.current!==generation)return;if(p&&((!advanceBinding&&p.jobId!==job.id)||(advanceBinding&&(p.id!==advanceBinding.paymentId||p.bookingId!==booking?.id||p.jobId!==null))||p.tenantId!==job.tenantId||p.customerId!==job.customerId)){setPayment(null);setPaymentRead('error');setPaymentScope(scope);return}setPayment(p);setPaymentRead('ready');setPaymentScope(scope)},()=>{if(paymentGeneration.current!==generation)return;setPayment(null);setPaymentRead('error');setPaymentScope(scope)},advanceBinding);
    return()=>{paymentGeneration.current++;stop()};
  }, [job?.id,job?.tenantId,job?.customerId,authB.status,authB.status==='ready'?authB.user.uid:null,authB.status==='ready'?authB.claims.tenantId:null,resolvedRoute,id,ownerVerified,advanceBinding?.paymentId,advanceBinding?.amount,advanceBinding?.bookingId,advanceBinding?.studioId]);

  useEffect(() => {
    setApprovals([]);if (!job) return;let alive=true;
    const stop=listenToApprovalsForJob(job.id, job.tenantId, job.customerId, values=>{if(alive)setApprovals(values)}, () => undefined);return()=>{alive=false;stop()};
  }, [job?.id]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const store = (globalThis as any).localStorage as { getItem(k: string): string | null; setItem(k: string, v: string): void } | undefined;
  const calKey = `autodeck.cal.${id}`;
  const [calAdded, setCalAdded] = useState<boolean>(() => { try { return store?.getItem(calKey) === "1"; } catch { return false; } });
  const [pushAsked, setPushAsked] = useState<boolean>(() => { try { return store?.getItem(PUSH_ASKED_KEY) === "1"; } catch { return false; } });
  const [pushBusy, setPushBusy] = useState(false);
  const [pushResult, setPushResult] = useState<"on" | "denied" | null>(null);
  const currentPaymentScope=job?[job.id,job.tenantId,job.customerId,advanceBinding?.paymentId??'job'].join('|'):'';
  const paymentOwnerCurrent=ownerVerified&&authB.status==='ready'&&job?.tenantId===authB.claims.tenantId&&resolvedRoute===id;
  const paymentIsCurrent=paymentOwnerCurrent&&paymentScope===currentPaymentScope&&paymentRead==='ready';
  const awaitingLinkConfirmation=Boolean(paymentIsCurrent&&payment?.id===awaitingLinkId&&payment.status==='pending');
  const resumeReady=paymentIsCurrent&&!booking?.cancelIntent;
  const resumeAllowed=!awaitingLinkConfirmation&&(advanceBinding?canResumeBookingAdvance({booking,payment,ready:resumeReady}):canResumeJobPayment({auth:authB.status==='ready'?{uid:job?.customerId??'',tenantId:authB.claims.tenantId}:null,job,payment,ready:resumeReady&&booking?.status!=="CANCELLED"&&booking?.status!=="EXPIRED"}));
  async function resumePayment(){if(mockWriteBlocked()||resumeLock.current||payingNow||!resumeAllowed||!payment)return;resumeLock.current=true;const generation=paymentGeneration.current;setPayingNow(true);setActionError(null);try{const outcome=await payWithPaymentLink(payment.id,payment.paymentUrl??null,{webSameTab:true});if(generation===paymentGeneration.current){if(outcome==='pending')setAwaitingLinkId(payment.id);setActionError(outcome==='paid'?null:EXISTING_PAYMENT_PENDING);}}catch{if(generation===paymentGeneration.current)setActionError(EXISTING_PAYMENT_OPEN_FAILED);}finally{if(generation===paymentGeneration.current){resumeLock.current=false;setPayingNow(false)}}}
  const [car, setCar] = useState<Vehicle | null>(null);
  useEffect(() => {
    setCar(null);if (authB.status !== "ready" || !booking||!ownerVerified) return;let alive=true;
    const stop=listenToMyVehicles(booking.customerId, authB.claims.tenantId, (vs) => {if(alive)setCar(vs.find((v) => v.id === booking.vehicleId) ?? null)}, () => {});return()=>{alive=false;stop()};
  }, [authB, booking?.vehicleId,ownerVerified,booking?.customerId]);
  const [svc, setSvc] = useState<{ name: string; brand?: string | null; category: string; imageUrl?: string | null } | null>(null);
  const [svcLoaded, setSvcLoaded] = useState(false);
  useEffect(() => {
    if (!booking) return;
    let alive = true;
    if (__DEV__ && mock === "1") return;
    void getServiceCatalogue().then((all) => { if (alive) { setSvc(all.find((x) => x.id === booking.serviceId) ?? null); setSvcLoaded(true); } }).catch(() => { if (alive) setSvcLoaded(true); });
    return () => { alive = false; };
  }, [booking?.serviceId]);

  const quoteWorkOpen = !!job && ["PENDING_VEHICLE", "VEHICLE_RECEIVED", "STANDBY"].includes(job.status);
  const quoteExpired = !booking?.quoteExpiresAt || !Number.isFinite(Date.parse(booking.quoteExpiresAt)) || Date.now() >= Date.parse(booking.quoteExpiresAt);
  const [quoteBusy, setQuoteBusy] = useState(false);
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [decideError, setDecideError] = useState<string | null>(null);
  async function handleDecide(approvalId: string, decision: "approved" | "rejected") {
    if (mockWriteBlocked()) return;
    if(decision==="approved"&&booking&&(booking.priceOnRequest||(booking as Booking & {requiresPriceApproval?:boolean}).requiresPriceApproval)&&booking.quoteStatus!=="approved"){setDecideError("Approve the original quote on this booking first. Your additional-work request will remain here.");return;}
    if (decidingId||actionLock.current||routeRef.current!==routeScope||!liveApprovalsRef.current.some(a=>a.id===approvalId&&a.status==='pending')) return;
    const scope=routeScope,gen=actionEpoch.current;const current=()=>routeRef.current===scope&&actionEpoch.current===gen;actionLock.current=true;
    setDecidingId(approvalId); setDecideError(null);
    try { await respondToApproval(approvalId, decision); }
    catch (err) { if(current())setDecideError(err instanceof Error ? err.message : "Could not record your answer. Try again."); }
    finally { if(current()){actionLock.current=false;setDecidingId(null);} }
  }
  async function handleApproveQuote(decline = false) {
    if (mockWriteBlocked()) return;
    if (!id||!booking||!ownerVerified||!quoteWorkOpen||quoteExpired||quoteBusy||livePaymentRef.current?.status==='completed'||liveBookingRef.current?.status==='CANCELLED'||liveBookingRef.current?.status==='EXPIRED'||liveBookingRef.current?.status==='COMPLETED'||routeRef.current!==routeScope||actionLock.current) return;
    const scope=routeScope,gen=actionEpoch.current;const current=()=>routeRef.current===scope&&actionEpoch.current===gen;actionLock.current=true;
    setQuoteBusy(true);
    try {
      await (decline ? declineBookingQuote : approveBookingQuote)(booking.id,booking.totalAmount,booking.updatedAt);
      // The live booking listener, not a stale request closure, projects approval.
    } catch (err) {
      if(current())setActionError(err instanceof Error ? err.message : "Could not approve the quote.");
    } finally {
      if(current()){actionLock.current=false;setQuoteBusy(false);}
    }
  }

  async function handlePayNow() {
    if (mockWriteBlocked()) return;
    if (awaitingLinkId || payingNow || authB.status !== "ready" || !booking||!ownerVerified||actionLock.current) return;
    const scope=routeScope,gen=actionEpoch.current;const current=()=>routeRef.current===scope&&actionEpoch.current===gen;actionLock.current=true;
    setPayingNow(true);
    setActionError(null);
    try {
      if (booking.payMode === "studio" && booking.status === "PENDING" && Boolean(booking.holdExpiresAt)) {
        const adv = await requestAdvancePayment(booking.id, booking.combinedPayment?.payNowPaise);
        if(!current())return;
        if (!adv.paymentUrl || adv.status === "manual_review") { setActionError("Your advance payment is being checked. Please try again later."); return; }
        const out = await payWithPaymentLink(adv.paymentId, adv.paymentUrl, {webSameTab:true});
        if(current()){if(out === "pending")setAwaitingLinkId(adv.paymentId);setActionError(out === "pending" ? EXISTING_PAYMENT_PENDING : bookingPayOutcomeMessage(out));}
        return;
      }
      const jobId = await getJobIdForBooking(booking.id, authB.claims.tenantId, booking.customerId);
      if(!current())return;
      if (!jobId) throw new Error("no job");
      const pay = await initiatePayment(jobId, "razorpay_payment_link");
      if(!current())return;
      const out = pay.paymentId ? await payOnline({ paymentId: pay.paymentId, paymentUrl: pay.paymentUrl, name: "AutoDeck Studio", description: "Booking" }) : "failed";
      if(current())setActionError(bookingPayOutcomeMessage(out));
    } catch {
      if(current())setActionError("We could not open the payment. Please retry, or call the studio.");
    } finally {
      if(current()){actionLock.current=false;setPayingNow(false);}
    }
  }

  async function handleCancelConfirmed() {
    if (mockWriteBlocked()) return;
    if (!booking || !id||actionLock.current||job&&!['PENDING_VEHICLE','STANDBY','VEHICLE_RECEIVED'].includes(job.status)) return;
    const scope=routeScope,gen=actionEpoch.current;const current=()=>routeRef.current===scope&&actionEpoch.current===gen;actionLock.current=true;
    setCancelling(true);
    setActionError(null);
    try {
      const result = await cancelBooking(id, "Cancelled by customer");
      if(!current())return;
      if (!result.cancellationPending) setBooking((prev) => (prev ? { ...prev, status: "CANCELLED" } : prev));
      setConfirmingCancel(false);
    } catch (err) {
      if(current())setActionError(cancellationErrorMessage(err));
    } finally {
      if(current()){actionLock.current=false;setCancelling(false);}
    }
  }

  const originBack = returnTo === "home" ? () => router.navigate("/(tabs)") : returnTo === "notifications" ? () => router.replace("/(tabs)/notifications") : undefined;
  if (loading||(!isMock&&resolvedRoute!==id&&!feedError)) return <Loading label="Opening your booking" />;
  if(feedError) return <Screen onBack={originBack}><Notice title="Can't load your booking" body={feedError} action={<Button icon="refresh" label="Retry" onPress={()=>setRetryTick(n=>n+1)}/>} /></Screen>;
  if (!booking) return <Screen onBack={originBack}><Notice title="Booking not found" body="It may have been removed, or the link is stale." /></Screen>;

  const missed = isBookingMissed(booking);
  const bookingClosed=["CANCELLED","EXPIRED","COMPLETED"].includes(booking.status);
  const showLiveVisit=!bookingClosed;
  const unconfirmedPreArrival=booking.status==="PENDING"&&job?.status==="PENDING_VEHICLE";
  const combinedReturn=(booking as Booking&{combinedReturn?:{status:string;feePaise:number;refundPaise:number;entries:{method:string;returnPaise:number;returnedPaise:number}[]}}).combinedReturn;
  const owedNotice = combinedReturn?null:manualRefundNotice(booking);
  const autoCancelled = booking.status === "CANCELLED" && booking.cancellationReason?.startsWith("Auto-cancelled:");
  const cancel = cancelState(booking, Date.now(), svc?.category);
  const cancelLifecycleOpen=!job||['PENDING_VEHICLE','STANDBY','VEHICLE_RECEIVED'].includes(job.status);
  const canCancel=cancel.canCancel&&cancelLifecycleOpen;
  const paidAlready = !membershipCoveredLabel(booking) && (booking.paymentStatus === "paid" || booking.paymentStatus === "partial");
  const giftCovered = Boolean(booking.giftId) && booking.priceBreakdown.total === 0;
  const waitingCancel = booking.cancelIntent?.state === "waiting" || booking.cancelIntent?.state === "needs_review";
  const noPaymentDue=booking.totalAmount===0&&booking.priceBreakdown.total===0;
  const canPay = !noPaymentDue&&!membershipCoveredLabel(booking) && !waitingCancel && (booking.paymentStatus === "unpaid" || Boolean(job?.combinedSettlement&&job.combinedSettlement.balanceDuePaise>0&&!job.offlineSettlement&&booking.paymentStatus==="partial")) && booking.status !== "CANCELLED" && booking.status !== "EXPIRED";
  // Just booked (placed=1 landing view): offering to reschedule seconds after
  // booking is noise, so the section stays hidden. Opened later from the
  // bookings list (no placed param) every rule below applies exactly as before.
  const showRescheduleSection = placed !== "1" && (!job||job.status==="PENDING_VEHICLE") && !waitingCancel && !walkIn && booking.status !== "CANCELLED" && booking.status !== "COMPLETED" && booking.status !== "EXPIRED";
  const rescheduleEligibility = getRescheduleEligibility(booking, svc?.category);
  const hasPendingApproval = approvals.some((a) => a.status === "pending");

  const scheduledAt = new Date(booking.scheduledAt);
  // Plain, factual timing against the planned slot. No ETA beyond the planned end.
  const vt = job && booking.status !== "CANCELLED" && booking.status !== "EXPIRED" ? visitTiming(job, minuteNow) : null;
  const timingLine = vt ? customerTimingLine(vt) : "";
  const displayDate = scheduledAt.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const displayTime = scheduledAt.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", hour12: true });

  const ready = expectedReady(booking);
  const isMultiDay = ready ? ready.date !== booking.scheduledDate : false;
  const displayEndDate = new Date(`${ready?.date ?? booking.scheduledDate}T12:00:00Z`).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <Screen
      onBack={originBack}
      header={
        <View testID="booking-identity-header" style={{ minHeight:metrics.heroCompact+60,borderRadius: 24, overflow: "hidden", backgroundColor: "#0B0B0D", borderWidth: 1, borderColor: "rgba(255,255,255,0.10)",justifyContent:"flex-end" }}>
          <View style={{position:"absolute",inset:0}}><CarThumb car={car ?? (booking.vehicleSnapshot ? { ...booking.vehicleSnapshot, photoUrl: null, category: booking.vehicleCategory } : undefined)} height={metrics.heroCompact + 60} radius={0} /></View>
          <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, ...({ backgroundImage: "linear-gradient(180deg, rgba(8,8,10,0.25) 0%, rgba(8,8,10,0) 35%, rgba(8,8,10,0.92) 100%)" } as object) }} />
          <View testID="booking-identity-stack" style={{padding:metrics.cardPad,gap:metrics.identityGap}}>
            <View style={{ alignSelf: "flex-start", flexDirection: "row", flexWrap:"wrap",gap: 8 }}>{job && !bookingClosed && jobStage(job.status) && job.status !== "DELIVERED" && job.status !== "PENDING_VEHICLE" ? <Chip label="Live" tone="accent" onDark /> : null}<Chip label={missed ? "Missed" : booking.status === "PENDING" && (booking.payMode === "online" || Boolean(booking.holdExpiresAt)) ? "Pending payment" : BOOKING_STATUS_LABELS[booking.status] ?? booking.status} tone={missed ? "danger" : BOOKING_CHIP_TONE[booking.status] ?? "neutral"} onDark /></View>
            <T role="heading" style={{ color: "#FFFFFF" }}>{svc?.name ?? "Your visit"}</T>
            <T role="caption" style={{ color: "#E4E2DF" }}>{displayDate} · {displayTime}</T>
            <T role="caption" style={{ color: "#E4E2DF" }}>Booking ID {bookingCode(booking.id)}</T>
          </View>
        </View>
      }
    >
      {timingLine ? <Pane pad="gap"><T role="bodyStrong" tone="primary">{timingLine}</T></Pane> : null}
      {placed === "1" && booking.status === "PENDING" && booking.payMode !== "online" && !booking.holdExpiresAt ? (
        <Notice
          title="Request sent"
          body="The studio has your request and will confirm your slot. Status updates here. Nothing is charged now."
        />
      ) : null}

      {placed === "1" && shouldAskPush(pushPermission(), pushAsked) && pushResult === null ? (
        <Notice
          title="Get live updates"
          body="Get updates at each step: slot confirmed, work started, car ready. Turn off any time."
          action={
            <View style={{ gap: space.breath }}>
              <Button label="Turn on updates" busy={pushBusy} onPress={() => { setPushBusy(true); void enablePush().then((r) => setPushResult(r === "on" ? "on" : "denied")).catch(() => setPushResult("denied")).finally(() => { setPushBusy(false); try { store?.setItem(PUSH_ASKED_KEY, "1"); } catch { /* private mode */ } setPushAsked(true); }); }} />
              <Button label="Not now" kind="quiet" onPress={() => { try { store?.setItem(PUSH_ASKED_KEY, "1"); } catch { /* private mode */ } setPushAsked(true); }} />
            </View>
          }
        />
      ) : null}
      {pushResult === "on" ? <Notice title="Updates are on" body="You will get a message when the studio confirms and when your car is ready." /> : null}

      {!walkIn && booking.status === "CONFIRMED" ? (
        <Button
          kind="quiet"
          label={calAdded ? "Added to calendar" : "Add to calendar"}
          disabled={calAdded}
          onPress={() => {
            if (calAdded) return;
            try { store?.setItem(calKey, "1"); } catch { /* private mode */ }
            setCalAdded(true);
            const name = svc?.name ?? "AutoDeck visit";
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const doc = (globalThis as any).document;
            if (Platform.OS === "web" && doc && /iPhone|iPad|Macintosh/.test((globalThis as any).navigator?.userAgent ?? "")) {
              const url = (globalThis as any).URL.createObjectURL(new (globalThis as any).Blob([icsFor(booking, name)], { type: "text/calendar" }));
              const a = doc.createElement("a");
              a.href = url;
              a.download = "autodeck-booking.ics";
              doc.body.appendChild(a);
              a.click();
              a.remove();
              return;
            }
            void Linking.openURL(googleCalendarUrl(booking, name));
          }}
        />
      ) : null}

      {booking.status==='COMPLETED'?<VisitFeedback key={routeScope} stars={stars} note={note} rated={rated} busy={rateBusy} error={rateError} onStars={n=>{reviewEdits.current++;setStars(n);setRated(false)}} onNote={n=>{reviewEdits.current++;setNote(n)}} onSend={()=>void handleRate()}/>:null}

      {booking.status === "COMPLETED" || booking.status === "CANCELLED" ? (
        <Button label="Book again" onPress={() => { if (mockWriteBlocked()) return; router.push(`/(tabs)/book/${booking.serviceId}`); }} />
      ) : null}

      <Pane pad="gap">
        <Row detailTone="secondary" title="Time" detail={job?.status === "STANDBY" ? "Waiting - no slot reserved" : `${displayTime}`} />
        <Row detailTone="secondary" title="Duration" detail={formatServiceTime(booking.durationMinutes)} />
        {!bookingClosed&&!unconfirmedPreArrival&&(job?.status === "STANDBY" || ready) ? <Row detailTone="secondary" title={readyRowTitle(vt?.phase)} detail={job?.status === "STANDBY" ? "Set when a bay becomes available" : `${displayEndDate}, ${ready!.time}`} last={!(booking.notes !== null && booking.notes.trim() !== "")} /> : null}
        {booking.notes !== null && booking.notes.trim() !== "" ? <Row detailTone="secondary" title="Notes" detail={booking.notes} last /> : null}
      </Pane>

      {isMultiDay&&!bookingClosed&&!unconfirmedPreArrival ? (
        <Notice title="Multi-day service" body={`Your car stays at the studio from ${displayDate} through ${displayEndDate}.`} />
      ) : null}

      {unconfirmedPreArrival ? <Pane pad="inset"><View style={{gap:metrics.innerGap}}><Kicker tone="accent">Studio status</Kicker><T role="heading">Car not checked in</T><T role="body" tone="secondary">Booking confirmation is pending. Check its status before travelling to the studio.</T></View></Pane> : job && showLiveVisit && jobStage(job.status) ? (
        <LiveJobCard status={job.status} slotStarted={vt?.phase === "due" || vt?.phase === "not_arrived"} readyText={null} approvals={approvals.filter((a) => a.status === "pending")} busyId={decidingId} error={decideError} onDecide={(approvalId, d) => void handleDecide(approvalId, d)} />
      ) : job && showLiveVisit && ["STANDBY","CANCELLED"].includes(job.status) ? (
        <Pane pad="inset">
          <View style={{ gap: space.breath }}>
            <Kicker tone="accent">{translate("Studio status")}</Kicker>
            {job.status === "STANDBY" ? <><T role="heading">Arrived - standby</T><T role="body" tone="tertiary">Waiting for an available compatible bay. No start time promised. This updates when you are admitted.</T></> : <T role="heading">Cancelled</T>}
          </View>
        </Pane>
      ) : null}

      {job && !["CANCELLED","EXPIRED"].includes(booking.status) && jobStage(job.status) && job.status !== "PENDING_VEHICLE" ? <JobTimeline status={job.status} history={job.statusHistory ?? []} /> : null}


      {!isMock && ownerVerified && job && booking.status==='COMPLETED' ? <VisitRecords key={routeScope+job.id} jobId={job.id} vehicle={car?`${car.make} ${car.model}`:'This visit'} hasInspection={inspection?.status==='finalized'} onInspection={()=>router.push({pathname:'/(tabs)/bookings/inspection',params:{jobId:job.id}})}/> : <>
      {!isMock && ownerVerified && job ? <View style={{gap:12}}><Pane pad="gap"><Row title="Work record" expanded={workOpen} detail={workOpen?"Hide performed work":"View performed work and QC"} onPress={()=>setWorkOpen(v=>!v)} last/></Pane>{workOpen?<JobWorkAndCoverage key={job.id} jobId={job.id} vehicle={car?`${car.make} ${car.model}`:"This visit"}/>:null}</View>:null}

      {inspection?.status === "finalized" && job ? (
        <Pane pad="inset">
          <Row
            title="Inspection report"
            detail="Ready to view"
            onPress={() => router.push({ pathname: "/(tabs)/bookings/inspection", params: { jobId: job.id } })}
            last
          />
        </Pane>
      ) : null}

      </>}

      {approvals
        .filter((a) => a.status === "pending" && !(job && jobStage(job.status)))
        .map((a) => (
          <Notice
            key={a.id}
            title="Approval needed"
            body={`${a.serviceName} (+${rupees(a.priceImpact)})`}
            action={<Button label="Review" onPress={() => router.push(`/(tabs)/approvals/${a.id}`)} />}
          />
        ))}

      {job && job.additionalWorkDelta > 0 ? (
        <Pane pad="inset">
          <View style={{ gap: space.hair }}>
            <Kicker tone="premium">Approved additional work</Kicker>
            <T role="heading">+{rupees(job.additionalWorkDelta)}</T>
            <T role="caption" tone="secondary">Current total {rupees(job.totalAmount)}</T>
          </View>
        </Pane>
      ) : null}

      <View style={{ gap: space.line }}>
        <Kicker>Price</Kicker>
        {(booking.priceOnRequest === true||(booking as Booking & {requiresPriceApproval?:boolean}).requiresPriceApproval===true) && booking.quoteStatus === "requested" && !["CANCELLED","COMPLETED","EXPIRED"].includes(booking.status) ? (
          <Pane pad="gap"><Row title="Quote requested" detail={<T role="caption" tone="secondary">The studio will set the price for your car. You approve it before any work starts.</T>} last /></Pane>
        ) : null}
        {(booking.priceOnRequest === true||(booking as Booking & {requiresPriceApproval?:boolean}).requiresPriceApproval===true) && booking.quoteStatus === "quoted" && !["CANCELLED","COMPLETED","EXPIRED"].includes(booking.status) ? (
          <Pane pad="gap">
            <Row title="Studio quote" detail={<T role="caption" tone="secondary">Approve this exact total before payment.</T>} trailing={<T role="heading">{rupees(booking.totalAmount)}</T>} />
            <T role="caption" tone="secondary">{booking.quoteExpiresAt && Number.isFinite(Date.parse(booking.quoteExpiresAt)) ? `Valid until ${new Date(booking.quoteExpiresAt).toLocaleString("en-IN")}.` : "Ask the office to reissue this quote with a validity date."}</T>
            {!quoteWorkOpen ? <T role="body" tone="secondary">This job needs an office review before the quote can be answered.</T> : null}
            {quoteExpired ? <T role="body" tone="secondary">This quote expired or needs a validity date. Ask the office for a new quote. No work is approved.</T> : null}
            <View style={{ marginTop: space.line }}><Button label="Approve quote" disabled={!ownerVerified||!quoteWorkOpen||quoteExpired||quoteBusy||["CANCELLED","COMPLETED","EXPIRED"].includes(booking.status)||payment?.status==='completed'} busy={quoteBusy} onPress={() => void handleApproveQuote()} /><Button label="Decline quote" kind="quiet" disabled={!ownerVerified || !quoteWorkOpen || quoteBusy || quoteExpired} onPress={() => void handleApproveQuote(true)} /></View>
          </Pane>
        ) : null}
        {booking.quoteStatus === "declined" ? <Pane><T role="body">Quote declined. Work has not been approved. Contact the office for a new quote.</T></Pane> : null}
        {(booking.priceOnRequest === true||(booking as Booking & {requiresPriceApproval?:boolean}).requiresPriceApproval===true) && booking.quoteStatus === "requested" ? null : (
        <Pane pad="gap">
          <Row title="Base" trailing={<T role="data">{rupees(booking.priceBreakdown.basePrice)}</T>} />
          {booking.priceBreakdown.scopeAdjustment > 0 ? (
            <Row title="Vehicle size adjustment" trailing={<T role="data">+{rupees(booking.priceBreakdown.scopeAdjustment)}</T>} />
          ) : null}
          {booking.priceBreakdown.addOns.map((addOn) => (
            <Row key={addOn.id} title={addOn.name} trailing={<T role="data">{rupees(addOn.price)}</T>} />
          ))}
          {booking.priceBreakdown.membershipDiscount !== null && booking.priceBreakdown.membershipDiscount > 0 ? (
            <Row title={booking.membershipWashUsed ? "Wash from your plan" : "Membership discount"} trailing={<T role="data" tone="premium">-{rupees(booking.priceBreakdown.membershipDiscount)}</T>} />
          ) : null}
          {(booking.priceBreakdown.pickupFee??0)>0?<Row title="Pickup" trailing={<T role="data">{rupees(booking.priceBreakdown.pickupFee??0)}</T>}/>:null}
          {(booking.priceBreakdown.dropFee??0)>0?<Row title="Drop-off" trailing={<T role="data">{rupees(booking.priceBreakdown.dropFee??0)}</T>}/>:null}
          {booking.priceBreakdown.roundOffPaise ? <Row title="Round off" trailing={<T role="data">{rupees(booking.priceBreakdown.roundOffPaise)}</T>} /> : null}
          {booking.priceBreakdown.tax > 0 ? <Row title={booking.priceBreakdown.taxDescription} trailing={<T role="data">{rupees(booking.priceBreakdown.tax)}</T>} /> : null}
          <Row title={<T role="heading">Total</T>} trailing={<T role="heading">{rupees(booking.priceBreakdown.total)}</T>} />
          <Row detailTone="secondary" title="Payment" detail={membershipCoveredLabel(booking) ?? (noPaymentDue?giftCovered?"Included with your gift - no payment needed":"No payment needed":job?.offlineSettlement && job.paymentStatus==="partial" ? "Part payment recorded - balance due" : payment?.status==='completed'&&job?.paymentStatus!=='paid'&&!(payment as Payment & {invoiceReviewNeeded?:boolean}).invoiceReviewNeeded?'Payment records syncing - do not pay again':customerPaymentLabel(payment,paymentIsCurrent||isMock?'ready':paymentOwnerCurrent&&paymentScope===currentPaymentScope?paymentRead:'loading'))} last />
          {canPay&&booking.combinedPayment?.choice==="advance20"&&booking.paymentStatus==="partial"&&paymentIsCurrent&&(!payment||payment.status==="failed"||payment.status==="cancelled")?<View style={{marginTop:space.line}}><Button label={`Pay balance ${rupees(job?.combinedSettlement?.balanceDuePaise??0)}`} busy={payingNow} disabled={payingNow} onPress={()=>void handlePayNow()}/></View>:null}
          {resumeAllowed?<View style={{gap:space.line,marginTop:space.line}}><Button label="Continue online payment" busy={payingNow} disabled={payingNow} onPress={()=>void resumePayment()}/></View>:null}
          {job?.combinedSettlement?<View><Row title="Verified advance" detail={rupees(job.combinedSettlement.advanceCapturedPaise)}/><Row title={job.offlineSettlement?"Balance after advance":"Balance due"} detail={rupees(booking.status==="CANCELLED"?0:job.combinedSettlement.balanceDuePaise)}/></View>:null}
          {job?.offlineSettlement ? <View style={{marginTop:space.line}}><T role="caption" tone="secondary">Actual offline receipts</T><Row title="Applied to this visit" detail={rupees(job.offlineSettlement.appliedPaise)}/><Row title="Balance due" detail={rupees(booking.status==="CANCELLED"?0:Math.max(0,job.totalAmount-(job.combinedSettlement?.advanceCapturedPaise??0)-job.offlineSettlement.appliedPaise))}/>{job.offlineSettlement.officeReturnDuePaise>0?<Row title="Office return due" detail={rupees(job.offlineSettlement.officeReturnDuePaise)}/>:null}<Row title="Payment record" detail="Verified money only."/><Row title="Office return" detail="Not automatic credit or a completed refund."/></View>:null}
          {paymentIsCurrent && (payment?.invoiceId || job?.invoiceId || booking.invoiceId) && job ? (
            <View style={{ marginTop: space.line }}>
              <Button label="Invoice" kind="quiet" onPress={() => router.push(invoiceHref((payment?.invoiceId || job.invoiceId || booking.invoiceId) as string))} />
            </View>
          ) : null}
          {canPay && paymentIsCurrent && !payment ? booking.combinedPayment?<View>
            <Row title="Selected payment" detail={booking.combinedPayment.choice==="advance20"?"20% now, balance later":"Full amount online"}/>
            <Row title="Pay now" detail={rupees(booking.paymentStatus==="partial"?job?.combinedSettlement?.balanceDuePaise??0:booking.combinedPayment.payNowPaise)}/>
          </View>:<View><Row title="Next step" detail={job&&["VEHICLE_RECEIVED","IN_PROGRESS","QUALITY_CHECK","READY_FOR_DELIVERY"].includes(job.status)?"Your vehicle is at the studio.":`Bring your car at ${displayTime}.`}/><Row title="Payment" detail={giftCovered?"Your gift covers this wash.":"Pay at the studio."}/>{!giftCovered?<Row title="Confirmation" detail="The team records your payment."/>:null}</View> : null}
        </Pane>
        )}
      </View>

      {waitingCancel ? <Pane><Kicker>Cancellation requested</Kicker><Row title="Booking" detail="Not cancelled yet."/><Row title="Slot" detail="Held while payment is checked."/><Row title="Help" detail="Contact the studio." last/></Pane> : null}
      {owedNotice ? <Notice title={owedNotice.title} body={owedNotice.body} /> : null}

      {!noPaymentDue&&!waitingCancel && !awaitingLinkId && paymentIsCurrent && (!payment || payment.status === "failed" || payment.status === "cancelled") && booking.status === "PENDING" && (booking.payMode === "online" || Boolean(booking.holdExpiresAt)) && !walkIn ? (
        <Pane><Kicker>Confirm your booking</Kicker>
          {booking.holdExpiresAt?<Row title="Slot held until" detail={new Date(booking.holdExpiresAt).toLocaleTimeString("en-IN",{timeZone:"Asia/Kolkata",hour:"2-digit",minute:"2-digit",hour12:false})}/>:null}
          <Row title="Booking confirmation" detail="After verified payment." last/>
          <Button label="Pay now" busy={payingNow} disabled={payingNow} onPress={() => void handlePayNow()}/>
        </Pane>
      ) : null}
      {booking.status === "EXPIRED" ? <Pane><Kicker>Slot released</Kicker><Row title="Booking" detail="Expired. This slot is no longer held."/><Row title="Next step" detail={paymentRead!=="ready"||payment?.status==="pending"||awaitingLinkId?"Payment is not confirmed yet. Check payment status with the studio before booking or paying again.":"You can book again."} last/></Pane> : null}
      {combinedReturn?<Pane pad="gap"><Kicker>Original-method returns</Kicker><Row title="Return amount" detail={rupees(combinedReturn.refundPaise)}/>{combinedReturn.feePaise>0?<Row title="Fee retained" detail={rupees(combinedReturn.feePaise)}/>:null}<Row title="Status" detail={combinedReturn.status==="awaiting_admin"?"Awaiting Admin approval":combinedReturn.status==="returned"?"Returns recorded":"Returns still pending"}/>{combinedReturn.entries.some(e=>e.method==="cash"&&e.returnedPaise<e.returnPaise)?<Row title="Cash return" detail="Still owed. Not an automatic refund."/>:null}</Pane>:null}
      {!combinedReturn&&(booking.refundStatus === "reserved" || booking.refundStatus === "requested") ? <Notice title="Refund requested" body="Your refund request is recorded. This page shows its status as it changes." /> : null}
      {!combinedReturn&&booking.refundStatus === "initiated" ? <Notice title="Refund recorded" body="The studio has recorded your refund. Paid online? When it reaches you depends on your bank or payment provider." /> : null}
      {!combinedReturn&&booking.refundStatus === "processed" ? <Notice title="Refund processed by Razorpay" body="Razorpay reports your refund as processed. When it reaches you depends on your bank or payment provider." /> : null}
      {actionError === EXISTING_PAYMENT_PENDING && booking.status!=="EXPIRED" && (!paymentIsCurrent||!payment||payment.status==='pending'||payment.status==='processing') ? <Pane>
        <Kicker>Payment check</Kicker>
        <Row title="Status" detail="Payment is not confirmed yet." />
        <Row title="Do not pay again" detail="Check this booking first." />
      </Pane> : actionError === EXISTING_PAYMENT_OPEN_FAILED ? <Pane>
        <Kicker>Payment link</Kicker>
        <Row title="Could not open" detail="The existing payment link." />
        <Row title="Do not pay again" detail="Contact the studio for help." />
      </Pane> : actionError && actionError !== EXISTING_PAYMENT_PENDING ? <Notice title="We could not finish that" body={actionError} /> : null}
      {pickup === "failed" ? <Notice title="Pickup request not sent" body="Your booking stands. The pickup or drop-off request could not be sent - please call the studio to arrange it." /> : null}

      {showRescheduleSection ? (
        (() => {
          // Premium bookings use the request-and-approve flow (item 6, PREVIEW);
          // washes and others keep the direct reschedule below.
          const entry = rescheduleEntry(booking, svcLoaded ? svc?.category ?? null : undefined);
          if (entry.mode === "loading") {
            return null; // catalogue still loading - do not flash the wrong path
          }
          if (entry.mode === "request-pending") {
            const when = formatStudioLocal(entry.requestedDate, entry.requestedTime);
            return <T role="caption" tone="secondary">Reschedule request sent for {when}. Your booking stays at its current time until the studio confirms.</T>;
          }
          if (entry.mode === "request-used") {
            return <T role="caption" tone="secondary">You've already used the reschedule request for this booking. Contact the studio to change the time.</T>;
          }
          if (entry.mode === "request") {
            return (
              <Button
                label="Request reschedule"
                kind="quiet"
                onPress={() => { if (mockWriteBlocked()) return; router.push({ pathname: "/(tabs)/bookings/reschedule", params: { bookingId: booking.id } }); }}
              />
            );
          }
          if (entry.mode === "none") {
            return <T role="caption" tone="secondary">{entry.reason}</T>;
          }
          return rescheduleEligibility.eligible ? (
          <View style={{ gap: space.breath }}>
            {hasPendingApproval ? (
              <T role="caption" tone="secondary">You have a pending approval on this job - rescheduling won't affect it.</T>
            ) : null}
            {payment && payment.status !== "pending" && payment.status !== "completed" ? (
              <T role="caption" tone="secondary">Payment status is {PAYMENT_STATUS_LABELS[payment.status] ?? payment.status} - rescheduling won't change this.</T>
            ) : null}
            <Button
              label="Reschedule"
              kind="quiet"
              onPress={() => { if (mockWriteBlocked()) return; router.push({ pathname: "/(tabs)/bookings/reschedule", params: { bookingId: booking.id } }); }}
            />
          </View>
        ) : (
          <T role="caption" tone="secondary">{booking.status==="PENDING"&&(Boolean(booking.holdExpiresAt)||booking.payMode==="online")?"Rescheduling is available after booking confirmation.":rescheduleEligibility.reason}</T>
        );
        })()
      ) : null}

      {!isMock && !walkIn && booking.status !== "CANCELLED" && booking.status !== "EXPIRED" ? <PickupCard bookingId={booking.id} combinedPayment={Boolean(booking.combinedPayment)} /> : null}

      {isBookingLateToday(booking) ? <Notice title="Your booking is still valid today" body="Your slot has passed, but you can still come today during studio hours. If not checked in by close (7 pm Sunday, 9 pm other days), the booking auto-cancels." /> : null}
      {autoCancelled ? (
        <Notice title="Booking auto-cancelled" body="Not checked in by studio close (7 pm Sunday, 9 pm other days), so this booking is closed. Book again any time." />
      ) : null}

      {canCancel ? (
        confirmingCancel ? (
          <Notice
            title="Cancel this booking?"
            body="Review the fee and return terms."
            action={
              <View style={{ gap: space.breath }}>
                <Row title="Free cancellation" detail={`Until ${cancel.freeUntilHours} hours before.`}/>
                <Row title="Fee now" detail={cancel.feePaise>0?rupees(cancel.feePaise):"No fee."}/>
                {booking.combinedPayment&&cancel.bigger?<><Row title="Fee basis" detail="Discounted service including GST."/><Row title="Unused pickup/drop" detail="Excluded from the fee."/></>:null}
                <Row title={paidAlready?"Return review":"Payment check"} detail={paidAlready?"Original methods. Admin approval required.":"Any open payment must be checked first."}/>
                {paidAlready?<Row title="Return status" detail="Not complete until actually returned."/>:null}
                <Row title="Cancellation" detail="Cannot be undone."/>
                <Button label="Yes, cancel booking" kind="danger" busy={cancelling} onPress={() => void handleCancelConfirmed()} />
                {rescheduleEligibility.eligible && (!job||job.status==="PENDING_VEHICLE") ? <Button label="Reschedule instead" kind="primary" onPress={() => { if (mockWriteBlocked()) return; router.push({ pathname: "/(tabs)/bookings/reschedule", params: { bookingId: booking.id } }); }} /> : null}
                <Button label="Keep it" kind="quiet" onPress={() => setConfirmingCancel(false)} />
              </View>
            }
          />
        ) : (
          !isMock ? <Button label="Cancel booking" kind="danger" onPress={() => setConfirmingCancel(true)} /> : null
        )
      ) : null}
    </Screen>
  );
}
