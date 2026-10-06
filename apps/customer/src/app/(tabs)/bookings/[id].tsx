import { useState, useEffect } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { listenToBooking, cancelBooking, approveBookingQuote } from "../../../lib/booking-service";
import { translate, useLang } from "../../../lib/i18n";
import { listenToJobForBooking } from "../../../lib/job-service";
import { listenToPaymentForJob } from "../../../lib/payment-service";
import { listenToApprovalsForJob } from "../../../lib/approval-service";
import { getReview, submitReview } from "../../../lib/review-service";
import { Pressable } from "react-native";
import { PickupCard } from "../../../ui/PickupCard";
import { listenToInspection } from "../../../lib/inspection-service";
import type { Booking, ServiceJob, Payment, ApprovalRequest, Inspection } from "@autodeck/core";
import { MAX_CUSTOMER_RESCHEDULES, CANCELLATION_FREE_WINDOW_HOURS, isBookingMissed, isBookingLateToday } from "@autodeck/core";
import { space } from "@autodeck/ui/theme";
import { Icon, useExperienceTheme } from "@autodeck/ui/native";
import { ServicePhoto } from "../../../ui/ServicePhoto";
import { getServiceCatalogue } from "../../../lib/catalogue-service";
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
  PENDING: "Pending confirmation",
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

const NON_RESCHEDULABLE_STATUS_REASONS: Record<string, string> = {
  PENDING: "This booking is still awaiting studio confirmation.",
  ACTIVE: "Your vehicle is already at the studio - contact the studio to change the schedule.",
  COMPLETED: "This booking is already completed.",
  CANCELLED: "This booking has been cancelled.",
  EXPIRED: "This booking has expired.",
};

// Multi-day PPF services run into thousands of minutes - express as hours
// once past a day (this is service-time, not calendar time; the
// authoritative calendar span is shown separately via "Expected ready").
function formatDuration(minutes: number): string {
  if (minutes < 24 * 60) return `~${minutes} min`;
  return `~${Math.round(minutes / 60)} hrs of service time`;
}

function getRescheduleEligibility(booking: Booking): { eligible: boolean; reason: string | null } {
  if (booking.status === "CONFIRMED" && isBookingMissed(booking)) return { eligible: true, reason: null };
  if (booking.status !== "CONFIRMED") {
    return { eligible: false, reason: NON_RESCHEDULABLE_STATUS_REASONS[booking.status] ?? "This booking can't be rescheduled." };
  }
  if (booking.rescheduleCount >= MAX_CUSTOMER_RESCHEDULES) {
    return {
      eligible: false,
      reason: `You've used all ${MAX_CUSTOMER_RESCHEDULES} reschedules for this booking. Contact the studio to change the time.`,
    };
  }
  const hoursUntil = (new Date(booking.scheduledAt).getTime() - Date.now()) / 3600000;
  if (hoursUntil < CANCELLATION_FREE_WINDOW_HOURS) {
    return {
      eligible: false,
      reason: `Less than ${CANCELLATION_FREE_WINDOW_HOURS} hours before your appointment - contact the studio directly to reschedule.`,
    };
  }
  return { eligible: true, reason: null };
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
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
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
    return listenToBooking(id, (value) => { setFeedError(null);setBooking(value); setLoading(false); }, (err) => { setFeedError(err.message);setLoading(false); });
  }, [id,retryTick]);

  useEffect(() => {
    if (!id || !booking) return;
    return listenToJobForBooking(id, booking.tenantId, booking.customerId, setJob, () => undefined);
  }, [id, booking?.tenantId, booking?.customerId]);

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

  const [svc, setSvc] = useState<{ name: string; brand?: string | null; category: string; imageUrl?: string | null } | null>(null);
  useEffect(() => {
    if (!booking) return;
    let alive = true;
    void getServiceCatalogue().then((all) => { if (alive) setSvc(all.find((x) => x.id === booking.serviceId) ?? null); }).catch(() => undefined);
    return () => { alive = false; };
  }, [booking?.serviceId]);

  const [quoteBusy, setQuoteBusy] = useState(false);
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

  const hoursToStart = (new Date(booking.scheduledAt).getTime() - Date.now()) / 3600000;
  const missed = isBookingMissed(booking);
  const withinFreeWindow = missed || hoursToStart >= CANCELLATION_FREE_WINDOW_HOURS;
  const canCancel = (booking.status === "CONFIRMED" || booking.status === "PENDING") && withinFreeWindow;
  const lateToCancel = !missed && (booking.status === "CONFIRMED" || booking.status === "PENDING") && !withinFreeWindow;
  const paidAlready = booking.paymentStatus === "paid" || booking.paymentStatus === "partial";
  const canPay = booking.paymentStatus === "unpaid" && booking.status !== "CANCELLED" && booking.status !== "EXPIRED";
  const showRescheduleSection = booking.status !== "CANCELLED" && booking.status !== "COMPLETED" && booking.status !== "EXPIRED";
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
  const displayTime = scheduledAt.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true });

  const isMultiDay = booking.estimatedEndDate !== booking.scheduledDate;
  const displayEndDate = new Date(`${booking.estimatedEndDate}T12:00:00Z`).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <Screen
      header={
        <View style={{ borderRadius: 28, overflow: "hidden", backgroundColor: "#0B0B0D", borderWidth: 1, borderColor: "rgba(255,255,255,0.10)" }}>
          {svc ? <ServicePhoto service={svc} aspect={16 / 10} radius={0} /> : <View style={{ aspectRatio: 16 / 10 }} />}
          <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, ...({ backgroundImage: "linear-gradient(180deg, rgba(8,8,10,0.25) 0%, rgba(8,8,10,0) 35%, rgba(8,8,10,0.92) 100%)" } as object) }} />
          <View style={{ position: "absolute", left: space.inset, right: space.inset, bottom: space.inset, gap: 6 }}>
            <View style={{ alignSelf: "flex-start" }}><Chip label={missed ? "Missed" : BOOKING_STATUS_LABELS[booking.status] ?? booking.status} tone={missed ? "danger" : BOOKING_CHIP_TONE[booking.status] ?? "neutral"} /></View>
            {svc ? <T role="heading" numberOfLines={1} style={{ color: "#FFFFFF" }}>{svc.name}</T> : null}
            <T role="caption" style={{ color: "#E4E2DF" }}>{displayDate} · {displayTime}</T>
          </View>
        </View>
      }
    >
      {placed === "1" && booking.status === "PENDING" ? (
        <Notice
          title="Request sent"
          body="Pending means the studio has your request and will confirm your slot. You will see the status change here once they do. Nothing is charged now."
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
        <Row title="Time" detail={job?.status === "STANDBY" ? "Waiting - no slot reserved" : `${displayTime} IST`} />
        <Row title="Duration" detail={formatDuration(booking.durationMinutes)} />
        <Row title="Expected ready" detail={job?.status === "STANDBY" ? "Set when a bay becomes available" : `${displayEndDate}, ${booking.estimatedEndTime} IST`} last={!(booking.notes !== null && booking.notes.trim() !== "")} />
        {booking.notes !== null && booking.notes.trim() !== "" ? <Row title="Notes" detail={booking.notes} last /> : null}
      </Pane>

      {isMultiDay ? (
        <Notice title="Multi-day service" body={`Your car stays at the studio from ${displayDate} through ${displayEndDate}.`} />
      ) : null}

      {job ? (
        <Pane pad="inset">
          <View style={{ gap: space.breath }}>
            <Kicker tone="accent">{translate("Studio status")}</Kicker>
            {job.status === "STANDBY" ? <><T role="heading">Arrived - standby</T><T role="body" tone="tertiary">Your car is waiting for an available compatible bay. No service start time is promised. The studio will update this when you are admitted.</T></> : job.status === "CANCELLED" ? (
              <T role="heading">Cancelled</T>
            ) : (
              TRACK_STEPS.map((step, i) => {
                const cur = TRACK_STEPS.indexOf(job.status as (typeof TRACK_STEPS)[number]);
                const done = i < cur || job.status === "DELIVERED";
                const active = i === cur && job.status !== "DELIVERED";
                return (
                  <View key={step} style={{ flexDirection: "row", alignItems: "center", gap: space.line }}>
                    <View style={{ width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: done || active ? "#F59A45" : "rgba(255,255,255,0.3)", backgroundColor: done ? "#F59A45" : "#161618" }} />
                    <T role={active ? "bodyStrong" : "body"} tone={done || active ? "primary" : "tertiary"}>{translate(JOB_STATUS_LABELS[step] ?? step)}</T>
                  </View>
                );
              })
            )}
            <T role="caption" tone="tertiary">Updates here as the studio moves your car along.</T>
          </View>
        </Pane>
      ) : null}

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
        .filter((a) => a.status === "pending")
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
        <Kicker>Payment</Kicker>
        <Pane pad="gap">
          <Row title="Status" detail={payment ? PAYMENT_STATUS_LABELS[payment.status] ?? payment.status : "Not yet initiated"} last />
          {payment?.invoiceId && job ? (
            <View style={{ marginTop: space.line }}>
              <Button
                label="View invoice"
                kind="quiet"
                onPress={() => router.push({ pathname: "/(tabs)/bookings/invoice", params: { jobId: job.id, tenantId: job.tenantId, customerId: job.customerId } })}
              />
            </View>
          ) : null}
          {canPay && !payment ? <T role="caption" tone="secondary" style={{ marginTop: space.line }}>You will pay at the studio. The team marks it paid once you do.</T> : null}
        </Pane>
      </View>

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
            <Row title="Membership discount" trailing={<T role="data" tone="premium">-{rupees(booking.priceBreakdown.membershipDiscount)}</T>} />
          ) : null}
          <Row title={booking.priceBreakdown.taxDescription} trailing={<T role="data">{rupees(booking.priceBreakdown.tax)}</T>} />
          <Row title={<T role="heading">Total</T>} trailing={<T role="heading">{rupees(booking.priceBreakdown.total)}</T>} last />
        </Pane>
        )}
      </View>

      {actionError ? <Notice title="Something went wrong" body={actionError} /> : null}

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

      {booking.status !== "CANCELLED" && booking.status !== "EXPIRED" ? <PickupCard bookingId={booking.id} /> : null}

      {isBookingLateToday(booking) ? <Notice title="Your booking is still valid today" body="Your slot has passed, but you can still bring your car today during studio hours. If it is not checked in by studio close (7 pm Sunday, 9 pm other days), this booking will be marked missed. Then you can pick a new time or cancel." /> : null}
      {missed ? (
        <Notice title="Booking missed" body="Your car was not checked in by studio close (7 pm Sunday, 9 pm other days). Pick a new time or cancel this booking. Moving a missed booking does not count towards your three reschedules." />
      ) : null}

      {lateToCancel ? (
        <Notice title="Cancelling" body={`Bookings can be cancelled online up to ${CANCELLATION_FREE_WINDOW_HOURS} hours before the start. After that, please call the studio.`} />
      ) : null}

      {canCancel ? (
        confirmingCancel ? (
          <Notice
            title="Cancel this booking?"
            body={paidAlready ? "This booking has been paid. The studio will contact you about the refund. This can't be undone." : "The slot is released straight away. This can't be undone."}
            action={
              <View style={{ gap: space.breath }}>
                <Button label="Yes, cancel booking" kind="danger" busy={cancelling} onPress={() => void handleCancelConfirmed()} />
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
