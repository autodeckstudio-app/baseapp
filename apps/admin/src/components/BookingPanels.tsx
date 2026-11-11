"use client";

// The booking half of a visit: slot, cancel with fee, quote for price-on-request items and the
// price breakdown. Shown on the Job page (one detail page per visit) and on the slim booking page
// before check-in. Reads come from the parent; writes are unchanged: setBookingQuote and the
// cancel/settle callables inside CancelBookingPanel.
import { useEffect, useRef, useState } from "react";
import type { Booking, ServiceJob, Service } from "@autodeck/core";
import { formatDuration, intentKey } from "@autodeck/core";
import { setBookingQuote, decideBookingRescheduleRequest } from "../lib/bookings-service";
import { CancelBookingPanel } from "./CancelBookingPanel";
import { NoShowPanel } from "./NoShowPanel";
import { NO_SHOW_REVIEW_ENABLED } from "../lib/backend-features";
import { formatPaise, formatDayLong, formatTime } from "../lib/format";

export function BookingPanels({ booking, job, service, bayName, onError, compact = false }: { booking: Booking; job: ServiceJob | null; service: Service | null; bayName: string; onError: (m: string | null) => void; compact?: boolean }) {
  const setError = onError;
  const pb = booking.priceBreakdown;
  const [quoteRupees, setQuoteRupees] = useState("");
  const [decisionBusy, setDecisionBusy] = useState(false);
  const [decisionNote, setDecisionNote] = useState("");
  // Exactly-once: the decision key is tied to the approve/decline intent and
  // survives retries and re-renders; switching intent mints a new key so one
  // key never carries two decisions (the server rejects that as a conflict).
  const decisionKeyRef = useRef<{ intent: string; key: string } | null>(null);
  const bookingRef=useRef(booking.id);bookingRef.current=booking.id;const decisionLock=useRef(false),decisionGeneration=useRef(0);
  useEffect(()=>{decisionGeneration.current++;decisionLock.current=false;setDecisionBusy(false);setDecisionNote("");decisionKeyRef.current=null;return()=>{decisionGeneration.current++}},[booking.id]);
  async function decide(approve: boolean) {
    if (!booking || decisionBusy||decisionLock.current||bookingRef.current!==booking.id||booking.rescheduleRequest?.status!=="pending") return;
    decisionLock.current=true;const generation=decisionGeneration.current,scope=booking.id;const current=()=>decisionGeneration.current===generation&&bookingRef.current===scope;
    setDecisionBusy(true);
    try {
      // The note is part of the decision payload, so it is part of the intent:
      // editing the note after a failed attempt mints a new key, and a retried
      // click with the same note reuses it.
      decisionKeyRef.current = intentKey(decisionKeyRef.current, `${booking.id}:${approve ? "approve" : "decline"}:${decisionNote.trim()}`, () => crypto.randomUUID());
      await decideBookingRescheduleRequest(booking.id, approve, decisionKeyRef.current.key, decisionNote.trim() || undefined);
      if(!current())return;setError(null);
      decisionKeyRef.current = null;
      window.location.reload();
    } catch (e) {
      if(current())setError(e instanceof Error ? e.message : "Could not record the decision.");
    } finally { if(current()){decisionLock.current=false;setDecisionBusy(false);} }
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
      <BookingReference compact={compact} title={compact?"Original booking slot":"Slot"}>
        <div className="kv"><span>Date</span><span>{formatDayLong(booking.scheduledDate)}</span></div>
        <div className="kv"><span>Time</span><span>{formatTime(booking.scheduledAt)} to {formatTime(booking.estimatedEndAt)}</span></div>
        <div className="kv"><span>Length</span><span>{formatDuration(booking.durationMinutes)}</span></div>
        <div className="kv"><span>Bay</span><span>{bayName || "Assigned bay"}</span></div>
        {booking.rescheduleCount > 0 && <div className="kv"><span>Rescheduled</span><span>{booking.rescheduleCount} {booking.rescheduleCount === 1 ? "time" : "times"}</span></div>}
      </BookingReference>

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

      <CancelBookingPanel booking={booking} job={job} compact={compact} />

      {NO_SHOW_REVIEW_ENABLED && booking.status === "CANCELLED" && (booking as { missedAt?: string }).missedAt ? <NoShowPanel booking={booking} onError={onError} /> : null}

      {booking.priceOnRequest === true && (
        <section className="ax-panel">
          <span className="ax-label">Quote</span>
          <div className="kv"><span>{service?.brand ? `${service.brand} · ` : ""}{service?.name ?? "Product"}</span><span>{booking.quoteStatus === "approved" ? "Customer approved" : booking.quoteStatus === "quoted" ? "Waiting for customer" : booking.quoteStatus === "declined" ? "Customer declined" : "Needs a price"}</span></div>
          {booking.quoteStatus !== "approved" && (
            <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center" }}>
              <input className="ax-input" inputMode="decimal" placeholder="Price in rupees, before tax" value={quoteRupees} onChange={(e) => setQuoteRupees(e.target.value)} />
              <button type="button" className="ax-button ax-button--primary" disabled={quoteBusy} onClick={() => void submitQuote()}>{booking.quoteStatus === "quoted" ? "Update quote" : "Send quote"}</button>
            </div>
          )}
          <p className="ax-note">Quotes are valid for 7 days. Work waits for customer approval. Changed scope or price needs fresh approval.</p>
          {booking.quoteStatus === "quoted" && <><p className="ax-note">{booking.quoteExpiresAt ? `Valid until ${new Date(booking.quoteExpiresAt).toLocaleString("en-IN")}` : "Reissue this quote to add its validity date."}</p><p><a className="ax-button" href={`https://app.autodeck.in/bookings/${encodeURIComponent(booking.id)}`} target="_blank" rel="noopener noreferrer">Open customer approval link</a></p><p className="ax-note">For the customer to open in their browser and sign in. No installation needed. This link does not approve or send anything.</p></>}

        </section>
      )}

      <BookingReference compact={compact} title={compact?"Original booking price":"Price"}>
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
        {pb.roundOffPaise ? <div className="kv"><span>Round off</span><span className="ax-data">{formatPaise(pb.roundOffPaise)}</span></div> : null}
        {pb.tax > 0 ? <div className="kv"><span>{pb.taxDescription}</span><span className="ax-data">{formatPaise(pb.tax)}</span></div> : null}
        <div className="kv"><span>Total</span><span className="ax-data" style={{ color: "var(--ad-text-primary)" }}>{formatPaise(pb.total)}</span></div>
        </>)}
        {booking.membershipDiscountApplied && (
          <p className="ax-note">{booking.membershipWashUsed ? "Paid with a membership wash credit." : "Membership discount applied."}</p>
        )}
      </BookingReference>

    </>
  );
}

function BookingReference({compact,title,children}:{compact:boolean;title:string;children:React.ReactNode}){return compact?<details className="ax-panel ax-job-disclosure"><summary>{title}</summary>{children}</details>:<section className="ax-panel"><span className="ax-label">{title}</span>{children}</section>;}
