import { invoiceHref } from "../../../lib/invoice-display";
import { useState, useEffect } from "react";
import { CarThumb } from "../../../ui/CarThumb";
import { listenToMyVehicles } from "../../../lib/vehicle-service";
import { useAuth } from "../../../hooks/useAuth";
import type { Vehicle } from "@autodeck/core";
import { Linking, Platform, View } from "react-native";
import { STUDIO_INFO } from "../../../lib/studio-info";
import { useLocalSearchParams, useRouter } from "expo-router";
import { listenToBooking, cancelBooking, approveBookingQuote } from "../../../lib/booking-service";
import { getJobIdForBooking } from "../../../lib/job-service";
import { initiatePayment } from "../../../lib/payment-service";
import { checkoutSupported, payWithCheckout } from "../../../lib/razorpay-checkout";
import { translate, useLang } from "../../../lib/i18n";
import { listenToJobForBooking, listenToJobById, bookingFromJob } from "../../../lib/job-service";
import { listenToPaymentForJob } from "../../../lib/payment-service";
import { listenToApprovalsForJob, respondToApproval } from "../../../lib/approval-service";
import { getReview, submitReview } from "../../../lib/review-service";
import { Pressable } from "react-native";
import { PickupCard } from "../../../ui/PickupCard";
import { listenToInspection } from "../../../lib/inspection-service";
import type { Booking, ServiceJob, Payment, ApprovalRequest, Inspection } from "@autodeck/core";
import { MAX_CUSTOMER_RESCHEDULES, isBookingMissed, isBookingLateToday } from "@autodeck/core";
import { space } from "@autodeck/ui/theme";
import { Icon, useExperienceTheme } from "@autodeck/ui/native";
import { getRescheduleEligibility, cancelState, cancelConfirmBody, SAME_DAY_CANCEL_LINE } from "../../../lib/booking-rules";
import { googleCalendarUrl, icsFor } from "../../../lib/calendar-link";
import { enablePush, pushPermission } from "../../../lib/push";
import { shouldAskPush, PUSH_ASKED_KEY } from "../../../lib/push-ask";
import { LiveJobCard } from "../../../ui/LiveJobCard";
import { JobChat } from "../../../ui/JobChat";
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

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: "Awaiting confirmation at studio",
  processing: "Processing",
  completed: "Paid",
  failed: "Payment failed - please try again",
  cancelled: "Payment cancelled",
  refunded: "Refunded",
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
function formatDuration(minutes: number): string {
  if (minutes < 24 * 60) return `~${minutes} min`;
  return `~${Math.round(minutes / 60)} hrs of service time`;
}

export default function BookingDetailScreen() {
  const { id, placed } = useLocalSearchParams<{ id: string; placed?: string }>();
  const router = useRouter();
  useLang();
  const [, tick] = useState(0);
  useEffect(() => { const timer = setInterval(() => tick(n => n + 1), 30000); return () => clearInterval(timer); }, []);
  const [retryTick,setRetryTick] = useState(0);
  const [feedError,setFeedError] = useState<string|null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [walkIn, setWalkIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [payingNow, setPayingNow] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [job, setJob] = useState<ServiceJob | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const { colors } = useExperienceTheme();
  const [stars, setStars] = useState(0);
  const [note, setNote] = useState("");
  const [rated, setRated] = useState(false);
  const [rateBusy, setRateBusy] = useState(false);
  const [rateError, setRateError] = useState<string | null>(null);

  useEffect(() => {
    if (!id || booking?.status !== "COMPLETED") return;
    void getReview(id).then((r) => { if (r) { setStars(r.rating); setNote(r.comment); setRated(true); } }).catch(() => undefined);
  }, [id, booking?.status]);

  async function handleRate() {
    if (!id || stars < 1) return;
    setRateBusy(true);
    setRateError(null);
    try {
      await submitReview(id, stars, note);
      setRated(true);
    } catch {
      setRateError("Couldn't save your rating. Try again.");
    } finally {
      setRateBusy(false);
    }
  }

  useEffect(() => {
    if (!id) {setLoading(false);return;}
    setLoading(true);setFeedError(null);
    setWalkIn(false);
    let stopJob: (() => void) | undefined;
    // No booking under this id (or it is not readable): a walk-in visit has only a job, and the link carries the job id.
    const fallbackToJob = (err: Error | null) => {
      stopJob?.();
      stopJob = listenToJobById(
        id,
        (j) => {
          if (j) { setWalkIn(true); setFeedError(null); setJob(j); setBooking(bookingFromJob(j)); }
          else if (err) setFeedError(err.message);
          else setBooking(null);
          setLoading(false);
        },
        (e) => { setFeedError((err ?? e).message); setLoading(false); },
      );
    };
    const stopBooking = listenToBooking(id, (value) => { if (value) { stopJob?.(); stopJob = undefined; setWalkIn(false); setFeedError(null); setBooking(value); setLoading(false); } else fallbackToJob(null); }, (err) => fallbackToJob(err));
    return () => { stopBooking(); stopJob?.(); };
  }, [id,retryTick]);

  useEffect(() => {
    if (!id || !booking || walkIn) return;
    return listenToJobForBooking(id, booking.tenantId, booking.customerId, setJob, () => undefined);
  }, [id, booking?.tenantId, booking?.customerId, walkIn]);

  useEffect(() => {
    if (!job) {
      setInspection(null);
      return undefined;
    }
    return listenToInspection(job.id, setInspection, () => undefined);
  }, [job?.id]);

  useEffect(() => {
    if (!job) return;
    return listenToPaymentForJob(job.id, job.tenantId, job.customerId, setPayment, () => undefined);
  }, [job?.id]);

  useEffect(() => {
    if (!job) return;
    return listenToApprovalsForJob(job.id, job.tenantId, job.customerId, setApprovals, () => undefined);
  }, [job?.id]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const store = (globalThis as any).localStorage as { getItem(k: string): string | null; setItem(k: string, v: string): void } | undefined;
  const calKey = `autodeck.cal.${id}`;
  const [calAdded, setCalAdded] = useState<boolean>(() => { try { return store?.getItem(calKey) === "1"; } catch { return false; } });
  const [pushAsked, setPushAsked] = useState<boolean>(() => { try { return store?.getItem(PUSH_ASKED_KEY) === "1"; } catch { return false; } });
  const [pushBusy, setPushBusy] = useState(false);
  const [pushResult, setPushResult] = useState<"on" | "denied" | null>(null);
  const authB = useAuth();
  const [car, setCar] = useState<Vehicle | null>(null);
  useEffect(() => {
    if (authB.status !== "ready" || !booking) return;
    return listenToMyVehicles(authB.user.uid, authB.claims.tenantId, (vs) => setCar(vs.find((v) => v.id === booking.vehicleId) ?? null), () => {});
  }, [authB, booking?.vehicleId]);
  const [svc, setSvc] = useState<{ name: string; brand?: string | null; category: string; imageUrl?: string | null } | null>(null);
  useEffect(() => {
    if (!booking) return;
    let alive = true;
    void getServiceCatalogue().then((all) => { if (alive) setSvc(all.find((x) => x.id === booking.serviceId) ?? null); }).catch(() => undefined);
    return () => { alive = false; };
  }, [booking?.serviceId]);

  const [quoteBusy, setQuoteBusy] = useState(false);
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [decideError, setDecideError] = useState<string | null>(null);
  async function handleDecide(approvalId: string, decision: "approved" | "rejected") {
    if (decidingId) return;
    setDecidingId(approvalId); setDecideError(null);
    try { await respondToApproval(approvalId, decision); }
    catch (err) { setDecideError(err instanceof Error ? err.message : "Could not record your answer. Try again."); }
    finally { setDecidingId(null); }
  }
  async function handleApproveQuote() {
    if (!id) return;
    setQuoteBusy(true);
    try {
      await approveBookingQuote(id);
      setBooking((prev) => (prev ? { ...prev, quoteStatus: "approved" } : prev));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not approve the quote.");
    } finally {
      setQuoteBusy(false);
    }
  }

  async function handlePayNow() {
    if (payingNow || authB.status !== "ready" || !booking) return;
    setPayingNow(true);
    setActionError(null);
    try {
      if (!checkoutSupported) throw new Error("no checkout");
      const jobId = await getJobIdForBooking(booking.id, authB.claims.tenantId, authB.user.uid);
      if (!jobId) throw new Error("no job");
      const pay = await initiatePayment(jobId, "razorpay_payment_link");
      const out = pay.paymentId ? await payWithCheckout(pay.paymentId, { name: "AutoDeck Studio", description: "Booking" }) : "failed";
      if (out === "failed") setActionError("Payment failed, please retry.");
    } catch {
      setActionError("We could not open the payment. Please retry, or call the studio.");
    } finally {
      setPayingNow(false);
    }
  }

  async function handleCancelConfirmed() {
    if (!booking || !id) return;
    setCancelling(true);
    setActionError(null);
    try {
      await cancelBooking(id, "Cancelled by customer");
      setBooking((prev) => (prev ? { ...prev, status: "CANCELLED" } : prev));
      setConfirmingCancel(false);
    } catch (err) {
      setActionError(err instanceof Error && err.message && !/^(internal|functions)/i.test(err.message) ? err.message : "We could not cancel this booking. Check your connection and try again, or call the studio.");
    } finally {
      setCancelling(false);
    }
  }

  if (loading) return <Loading label="Opening your booking" />;
  if(feedError) return <Screen><Notice title="Can't load your booking" body={feedError} action={<Button label="Retry" onPress={()=>setRetryTick(n=>n+1)}/>} /></Screen>;
  if (!booking) return <Screen><Notice title="Booking not found" body="It may have been removed, or the link is stale." /></Screen>;

  const missed = isBookingMissed(booking);
  const autoCancelled = booking.status === "CANCELLED" && booking.cancellationReason?.startsWith("Auto-cancelled:");
  const cancel = cancelState(booking, Date.now(), svc?.category);
  const { canCancel, lateToCancel } = cancel;
  const paidAlready = booking.paymentStatus === "paid" || booking.paymentStatus === "partial";
  const canPay = booking.paymentStatus === "unpaid" && booking.status !== "CANCELLED" && booking.status !== "EXPIRED";
  const showRescheduleSection = !walkIn && booking.status !== "CANCELLED" && booking.status !== "COMPLETED" && booking.status !== "EXPIRED";
  const rescheduleEligibility = getRescheduleEligibility(booking);
  const hasPendingApproval = approvals.some((a) => a.status === "pending");

  const scheduledAt = new Date(booking.scheduledAt);
  const displayDate = scheduledAt.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const displayTime = scheduledAt.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", hour12: true });

  const isMultiDay = booking.estimatedEndDate !== booking.scheduledDate;
  const displayEndDate = new Date(`${booking.estimatedEndDate}T12:00:00Z`).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <Screen
      header={
        <View style={{ borderRadius: 24, overflow: "hidden", backgroundColor: "#0B0B0D", borderWidth: 1, borderColor: "rgba(255,255,255,0.10)" }}>
          <CarThumb car={car ?? (booking.vehicleSnapshot ? { ...booking.vehicleSnapshot, photoUrl: null, category: booking.vehicleCategory } : undefined)} height={metrics.heroCompact + 60} radius={0} />
          <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, ...({ backgroundImage: "linear-gradient(180deg, rgba(8,8,10,0.25) 0%, rgba(8,8,10,0) 35%, rgba(8,8,10,0.92) 100%)" } as object) }} />
          <View style={{ position: "absolute", left: metrics.cardPad, right: metrics.cardPad, bottom: metrics.cardPad, gap: 6 }}>
            <View style={{ alignSelf: "flex-start", flexDirection: "row", gap: 6 }}>{job && jobStage(job.status) && job.status !== "DELIVERED" && !(booking.status === "PENDING" && booking.payMode === "online") ? <Chip label="Live" tone="accent" /> : null}<Chip label={missed ? "Missed" : booking.status === "PENDING" && booking.payMode === "online" ? "Pending payment" : BOOKING_STATUS_LABELS[booking.status] ?? booking.status} tone={missed ? "danger" : BOOKING_CHIP_TONE[booking.status] ?? "neutral"} /></View>
            <T role="heading" numberOfLines={1} style={{ color: "#FFFFFF" }}>{svc?.name ?? "Your visit"}</T>
            <T role="caption" style={{ color: "#E4E2DF" }}>{displayDate} · {displayTime}</T>
          </View>
        </View>
      }
    >
      {placed === "1" && booking.status === "PENDING" && booking.payMode !== "online" ? (
        <Notice
          title="Request sent"
          body="Pending means the studio has your request and will confirm your slot. You will see the status change here once they do. Nothing is charged now."
        />
      ) : null}

      {placed === "1" && shouldAskPush(pushPermission(), pushAsked) && pushResult === null ? (
        <Notice
          title="Get live updates"
          body="We can tell you when the studio confirms your slot, when work starts, and when your car is ready. One tap, and you can turn it off any time."
          action={
            <View style={{ gap: space.breath }}>
              <Button label="Turn on updates" busy={pushBusy} onPress={() => { setPushBusy(true); void enablePush().then((r) => setPushResult(r === "on" ? "on" : "denied")).catch(() => setPushResult("denied")).finally(() => { setPushBusy(false); try { store?.setItem(PUSH_ASKED_KEY, "1"); } catch { /* private mode */ } setPushAsked(true); }); }} />
              <Button label="Not now" kind="quiet" onPress={() => { try { store?.setItem(PUSH_ASKED_KEY, "1"); } catch { /* private mode */ } setPushAsked(true); }} />
            </View>
          }
        />
      ) : null}
      {pushResult === "on" ? <Notice title="Updates are on" body="You will get a message when the studio confirms and when your car is ready." /> : null}

      {!walkIn && (booking.status === "PENDING" || booking.status === "CONFIRMED") ? (
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

      {booking.status === "COMPLETED" ? (
        <Pane pad="inset">
          <View style={{ gap: space.line }}>
            <T role="heading">{rated ? "Thanks for rating" : "How was your visit?"}</T>
            <View style={{ flexDirection: "row", gap: space.breath }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable key={n} accessibilityRole="button" accessibilityLabel={`${n} star${n > 1 ? "s" : ""}`} onPress={() => { setStars(n); setRated(false); }}>
                  <Icon name="star" color={n <= stars ? colors.accent : colors.textTertiary} size={32} filled={n <= stars} />
                </Pressable>
              ))}
            </View>
            {stars > 0 && !rated ? (
              <View style={{ gap: space.breath }}>
                <Field label="Anything to add? (optional)" value={note} onChangeText={setNote} placeholder="What went well, or what could be better" />
                {rateError ? <T role="caption" tone="accent">{rateError}</T> : null}
                <Button label="Send rating" busy={rateBusy} onPress={() => void handleRate()} />
              </View>
            ) : null}
          </View>
        </Pane>
      ) : null}

      {booking.status === "COMPLETED" || booking.status === "CANCELLED" ? (
        <Button label="Book again" onPress={() => router.push(`/(tabs)/book/${booking.serviceId}`)} />
      ) : null}

      <Pane pad="gap">
        <Row title="Time" detail={job?.status === "STANDBY" ? "Waiting - no slot reserved" : `${displayTime}`} />
        <Row title="Duration" detail={formatDuration(booking.durationMinutes)} />
        <Row title="Expected ready" detail={job?.status === "STANDBY" ? "Set when a bay becomes available" : `${displayEndDate}, ${booking.estimatedEndTime}`} last={!(booking.notes !== null && booking.notes.trim() !== "")} />
        {booking.notes !== null && booking.notes.trim() !== "" ? <Row title="Notes" detail={booking.notes} last /> : null}
      </Pane>

      {isMultiDay ? (
        <Notice title="Multi-day service" body={`Your car stays at the studio from ${displayDate} through ${displayEndDate}.`} />
      ) : null}

      {job && jobStage(job.status) ? (
        <LiveJobCard status={job.status} readyText={job.status === "DELIVERED" || !readyIsAhead(booking.estimatedEndDate, booking.estimatedEndTime) ? null : `${displayEndDate}, ${booking.estimatedEndTime}`} approvals={approvals.filter((a) => a.status === "pending")} busyId={decidingId} error={decideError} onDecide={(approvalId, d) => void handleDecide(approvalId, d)} />
      ) : job ? (
        <Pane pad="inset">
          <View style={{ gap: space.breath }}>
            <Kicker tone="accent">{translate("Studio status")}</Kicker>
            {job.status === "STANDBY" ? <><T role="heading">Arrived - standby</T><T role="body" tone="tertiary">Your car is waiting for an available compatible bay. No service start time is promised. The studio will update this when you are admitted.</T></> : <T role="heading">Cancelled</T>}
          </View>
        </Pane>
      ) : null}

      {job && jobStage(job.status) && job.status !== "PENDING_VEHICLE" ? <JobTimeline status={job.status} history={job.statusHistory ?? []} /> : null}

      {job && booking ? <JobChat job={job} tenantId={booking.tenantId} customerId={booking.customerId} /> : null}

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
        {booking.priceOnRequest === true && booking.quoteStatus === "requested" ? (
          <Pane pad="gap"><Row title="Quote requested" detail={<T role="caption" tone="secondary">The studio will set the price for your car. You approve it before any work starts.</T>} last /></Pane>
        ) : null}
        {booking.priceOnRequest === true && booking.quoteStatus === "quoted" ? (
          <Pane pad="gap">
            <Row title="Studio quote" detail={<T role="caption" tone="secondary">Approve to let the studio start work.</T>} trailing={<T role="heading">{rupees(booking.priceBreakdown.total)}</T>} />
            <View style={{ marginTop: space.line }}><Button label="Approve quote" busy={quoteBusy} onPress={() => void handleApproveQuote()} /></View>
          </Pane>
        ) : null}
        {booking.priceOnRequest === true && booking.quoteStatus === "requested" ? null : (
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
          {booking.priceBreakdown.tax > 0 ? <Row title={booking.priceBreakdown.taxDescription} trailing={<T role="data">{rupees(booking.priceBreakdown.tax)}</T>} /> : null}
          <Row title={<T role="heading">Total</T>} trailing={<T role="heading">{rupees(booking.priceBreakdown.total)}</T>} />
          <Row title="Payment" detail={payment ? (payment.status === "pending" && booking.payMode === "online" ? "Awaiting payment" : PAYMENT_STATUS_LABELS[payment.status] ?? payment.status) : "Not yet initiated"} last />
          {payment?.invoiceId && job ? (
            <View style={{ marginTop: space.line }}>
              <Button label="Invoice" kind="quiet" onPress={() => router.push(invoiceHref(payment.invoiceId as string))} />
            </View>
          ) : null}
          {canPay && !payment ? <T role="caption" tone="secondary" style={{ marginTop: space.line }}>Next: bring your car at {displayTime}. You pay at the studio, and the team marks it paid once you do.</T> : null}
        </Pane>
        )}
      </View>

      {booking.status === "PENDING" && booking.payMode === "online" && !walkIn ? (
        <Notice
          title="Payment pending"
          body={`${booking.holdExpiresAt ? `Held until ${new Date(booking.holdExpiresAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false })}. ` : ""}Your slot is held until the payment goes through.`}
          action={<Button label="Pay now" busy={payingNow} disabled={payingNow} onPress={() => void handlePayNow()} />}
        />
      ) : null}
      {booking.status === "EXPIRED" ? <Notice title="Slot released" body="The payment was not completed in time, so this booking expired. You can book again any time." /> : null}
      {booking.refundStatus === "initiated" ? <Notice title="Refund initiated" body="Your refund has been sent to Razorpay. It reaches your original payment method in 5-7 working days." /> : null}
      {actionError ? <Notice title="We could not finish that" body={actionError} /> : null}

      {showRescheduleSection ? (
        rescheduleEligibility.eligible ? (
          <View style={{ gap: space.breath }}>
            {hasPendingApproval ? (
              <T role="caption" tone="tertiary">You have a pending approval on this job - rescheduling won't affect it.</T>
            ) : null}
            {payment && payment.status !== "pending" && payment.status !== "completed" ? (
              <T role="caption" tone="tertiary">Payment status is {PAYMENT_STATUS_LABELS[payment.status] ?? payment.status} - rescheduling won't change this.</T>
            ) : null}
            <Button
              label="Reschedule"
              kind="quiet"
              onPress={() => router.push({ pathname: "/(tabs)/bookings/reschedule", params: { bookingId: booking.id } })}
            />
          </View>
        ) : (
          <T role="caption" tone="tertiary">{rescheduleEligibility.reason}</T>
        )
      ) : null}

      {!walkIn && booking.status !== "CANCELLED" && booking.status !== "EXPIRED" ? <PickupCard bookingId={booking.id} /> : null}

      {isBookingLateToday(booking) ? <Notice title="Your booking is still valid today" body="Your slot has passed, but you can still bring your car today during studio hours. If it is not checked in by studio close (7 pm Sunday, 9 pm other days), this booking will be auto-cancelled. You can make a new booking when you are ready." /> : null}
      {autoCancelled ? (
        <Notice title="Booking auto-cancelled" body="Your car was not checked in by studio close (7 pm Sunday, 9 pm other days). This booking is closed. Make a new booking when you are ready." />
      ) : null}

      {cancel.sameDay ? <T role="caption" tone="tertiary" style={{ textAlign: "center" }}>{SAME_DAY_CANCEL_LINE}</T> : null}
      {lateToCancel ? (
        <>
          <Notice title="Cancelling" body="Work on your car has started, so it cannot be cancelled online. Please call the studio." />
          <Button label="Call the studio" kind="quiet" onPress={() => void Linking.openURL(`tel:${STUDIO_INFO.phone}`)} />
        </>
      ) : null}

      {canCancel ? (
        confirmingCancel ? (
          <Notice
            title="Cancel this booking?"
            body={cancelConfirmBody(cancel, paidAlready)}
            action={
              <View style={{ gap: space.breath }}>
                <Button label="Yes, cancel booking" kind="danger" busy={cancelling} onPress={() => void handleCancelConfirmed()} />
                {rescheduleEligibility.eligible ? <Button label="Reschedule instead" kind="primary" onPress={() => router.push({ pathname: "/(tabs)/bookings/reschedule", params: { bookingId: booking.id } })} /> : null}
                <Button label="Keep it" kind="quiet" onPress={() => setConfirmingCancel(false)} />
              </View>
            }
          />
        ) : (
          <Button label="Cancel booking" kind="danger" onPress={() => setConfirmingCancel(true)} />
        )
      ) : null}
    </Screen>
  );
}
