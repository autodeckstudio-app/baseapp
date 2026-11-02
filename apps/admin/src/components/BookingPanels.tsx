"use client";

// The booking half of a visit: slot, cancel with fee, quote for price-on-request items and the
// price breakdown. Shown on the Job page (one detail page per visit) and on the slim booking page
// before check-in. Reads come from the parent; writes are unchanged: setBookingQuote and the
// cancel/settle callables inside CancelBookingPanel.
import { useRef, useState } from "react";
import type { Booking, ServiceJob, Service } from "@autodeck/core";
import { formatDuration, intentKey } from "@autodeck/core";
import { setBookingQuote, decideBookingRescheduleRequest } from "../lib/bookings-service";
import { CancelBookingPanel } from "./CancelBookingPanel";
import { NoShowPanel } from "./NoShowPanel";
import { NO_SHOW_REVIEW_ENABLED } from "../lib/backend-features";
import { formatPaise, formatDayLong, formatTime } from "../lib/format";

export function BookingPanels({ booking, job, service, bayName, onError }: { booking: Booking; job: ServiceJob | null; service: Service | null; bayName: string; onError: (m: string | null) => void }) {
  const setError = onError;
  const pb = booking.priceBreakdown;
  const [quoteRupees, setQuoteRupees] = useState("");
  const [decisionBusy, setDecisionBusy] = useState(false);
  const [decisionNote, setDecisionNote] = useState("");
  // Exactly-once: the decision key is tied to the approve/decline intent and
  // survives retries and re-renders; switching intent mints a new key so one
  // key never carries two decisions (the server rejects that as a conflict).
  const decisionKeyRef = useRef<{ intent: string; key: string } | null>(null);
  async function decide(approve: boolean) {
    if (!booking || decisionBusy) return;
    setDecisionBusy(true);
    try {
      // The note is part of the decision payload, so it is part of the intent:
      // editing the note after a failed attempt mints a new key, and a retried
      // click with the same note reuses it.
      decisionKeyRef.current = intentKey(decisionKeyRef.current, `${booking.id}:${approve ? "approve" : "decline"}:${decisionNote.trim()}`, () => crypto.randomUUID());
      await decideBookingRescheduleRequest(booking.id, approve, decisionKeyRef.current.key, decisionNote.trim() || undefined);
      setError(null);
      decisionKeyRef.current = null;
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not record the decision.");
    } finally { setDecisionBusy(false); }
  }

  const [quoteBusy, setQuoteBusy] = useState(false);
  async function submitQuote() {
    if (!booking) return;
    const n = Math.round(Number(quoteRupees) * 100);
    if (!Number.isFinite(n) || n < 100) { setError("Enter the quote in rupees, at least 1."); return; }
    setQuoteBusy(true);
    try {
      await setBookingQuote(booking.id, n);
      setError(null);
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the quote.");
    } finally { setQuoteBusy(false); }
  }

  return (
    <>
      <section className="ax-panel">
        <span className="ax-label">Slot</span>
        <div className="kv"><span>Date</span><span>{formatDayLong(booking.scheduledDate)}</span></div>
        <div className="kv"><span>Time</span><span>{formatTime(booking.scheduledAt)} to {formatTime(booking.estimatedEndAt)}</span></div>
        <div className="kv"><span>Length</span><span>{formatDuration(booking.durationMinutes)}</span></div>
        <div className="kv"><span>Bay</span><span>{bayName || "Assigned bay"}</span></div>
        {booking.rescheduleCount > 0 && <div className="kv"><span>Rescheduled</span><span>{booking.rescheduleCount} {booking.rescheduleCount === 1 ? "time" : "times"}</span></div>}
      </section>

      {booking.rescheduleRequest ? (
        <section className="ax-panel">
          <span className="ax-label">Reschedule request</span>
          <div className="kv"><span>Requested</span><span>{formatDayLong(booking.rescheduleRequest.requestedDate)} at {booking.rescheduleRequest.requestedTime}</span></div>
          <div className="kv"><span>Status</span><span>{booking.rescheduleRequest.status === "pending" ? "Waiting for a decision" : booking.rescheduleRequest.status}{booking.rescheduleRequest.decidedAt ? ` · ${formatDayLong(booking.rescheduleRequest.decidedAt.slice(0, 10))}` : ""}</span></div>
          {booking.rescheduleRequest.note ? <div className="kv"><span>Customer note</span><span>{booking.rescheduleRequest.note}</span></div> : null}
          {booking.rescheduleRequest.status === "pending" ? (
            <>
              <p className="ax-note">Approving moves the booking to the requested time if a bay is free; the price and advance do not change. One request per booking.</p>
              <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center", flexWrap: "wrap" }}>
                <input className="ax-input" placeholder="Note (optional)" value={decisionNote} onChange={(e) => setDecisionNote(e.target.value)} />
                <button type="button" className="ax-button ax-button--primary" disabled={decisionBusy} onClick={() => void decide(true)}>Approve move</button>
                <button type="button" className="ax-button" disabled={decisionBusy} onClick={() => void decide(false)}>Decline</button>
              </div>
            </>
          ) : null}
        </section>
      ) : null}

      <CancelBookingPanel booking={booking} job={job} />

      {NO_SHOW_REVIEW_ENABLED && booking.status === "CANCELLED" && (booking as { missedAt?: string }).missedAt ? <NoShowPanel booking={booking} onError={onError} /> : null}

      {booking.priceOnRequest === true && (
        <section className="ax-panel">
          <span className="ax-label">Quote</span>
          <div className="kv"><span>{service?.brand ? `${service.brand} · ` : ""}{service?.name ?? "Product"}</span><span>{booking.quoteStatus === "approved" ? "Customer approved" : booking.quoteStatus === "quoted" ? "Waiting for customer" : "Needs a price"}</span></div>
          {booking.quoteStatus !== "approved" && (
            <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center" }}>
              <input className="ax-input" inputMode="decimal" placeholder="Price in rupees, before tax" value={quoteRupees} onChange={(e) => setQuoteRupees(e.target.value)} />
              <button type="button" className="ax-button ax-button--primary" disabled={quoteBusy} onClick={() => void submitQuote()}>{booking.quoteStatus === "quoted" ? "Update quote" : "Send quote"}</button>
            </div>
          )}
          <p className="ax-note">Work cannot start until the customer approves the quote.</p>
        </section>
      )}

      <section className="ax-panel">
        <span className="ax-label">Price</span>
        {!pb ? (
          <>
            <div className="kv"><span>Price breakdown</span><span className="ax-data">Not available</span></div>
            <div className="kv"><span>Total</span><span className="ax-data">{typeof booking.totalAmount === "number" && Number.isFinite(booking.totalAmount) ? formatPaise(booking.totalAmount) : "Not available"}</span></div>
          </>
        ) : (<>
        <div className="kv"><span>{service?.name ?? "Service"}</span><span className="ax-data">{formatPaise(pb.basePrice)}</span></div>
        {pb.scopeAdjustment !== 0 && <div className="kv"><span>Size and scope</span><span className="ax-data">{formatPaise(pb.scopeAdjustment)}</span></div>}
        {typeof pb.membershipDiscount === "number" && Number.isFinite(pb.membershipDiscount) && (
          <div className="kv"><span>Membership</span><span className="ax-data" style={{ color: "var(--ad-premium)" }}>-{formatPaise(pb.membershipDiscount)}</span></div>
        )}
        <div className="kv"><span>Subtotal</span><span className="ax-data">{formatPaise(pb.subtotal)}</span></div>
        {pb.tax > 0 ? <div className="kv"><span>{pb.taxDescription}</span><span className="ax-data">{formatPaise(pb.tax)}</span></div> : null}
        <div className="kv"><span>Total</span><span className="ax-data" style={{ color: "var(--ad-text-primary)" }}>{formatPaise(pb.total)}</span></div>
        </>)}
        {booking.membershipDiscountApplied && (
          <p className="ax-note">{booking.membershipWashUsed ? "Paid with a membership wash credit." : "Membership discount applied."}</p>
        )}
      </section>

    </>
  );
}
