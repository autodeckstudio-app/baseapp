"use client";

import { refundOwedText } from "../lib/refund-owed-copy";
import { useState } from "react";
import { collection, getDocs, limit, query, where } from "firebase/firestore";
import type { Booking, Payment, ServiceJob } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { adminCancelBooking, settleCancellationFee, settleManualRefund, type CancelSummary } from "../lib/bookings-service";
import { formatPaise } from "../lib/format";

const CANCELLABLE = ["PENDING_VEHICLE", "STANDBY", "VEHICLE_RECEIVED"];

/** Admin-only cancel with the fee and refund shown before anything happens, and the fee settle buttons after. */
export function CancelBookingPanel({ booking, job }: { booking: Booking; job: ServiceJob | null }) {
  const [reason, setReason] = useState("");
  const [feeAction, setFeeAction] = useState<"charge" | "waive">("charge");
  const [preview, setPreview] = useState<CancelSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [warn, setWarn] = useState<string | null>(null);
  const [settleNote, setSettleNote] = useState("");

  // The owed payment is the booking's completed manual payment (cash/UPI/bank):
  // the one the office must return by hand. Provider payments never settle here.
  async function findOwedPaymentId(): Promise<string> {
    // Lazy import, matching bookings-service: a top-level ./firebase import makes
    // every consumer of this panel (including unit tests that only render it)
    // evaluate the production-config guard at module scope.
    const { db } = await import("../lib/firebase");
    const snap = await getDocs(query(collection(db, COLLECTIONS.payments()), where("bookingId", "==", booking.id), where("status", "==", "completed"), limit(10)));
    const manual = snap.docs.map((d) => d.data() as Payment).find((x) => x.method !== "razorpay_payment_link");
    if (!manual) throw new Error("No completed cash/UPI/bank payment found for this booking.");
    return manual.id;
  }

  const settleBlock = (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
      <label><span>How was the money returned</span>
        <input value={settleNote} onChange={(e) => setSettleNote(e.target.value)} placeholder="e.g. handed back at the counter" maxLength={500} />
      </label>
      <div className="ax-row">
        <button className="ax-button ax-button--primary" disabled={busy || settleNote.trim().length < 3} onClick={() => run(async () => {
          const pid = await findOwedPaymentId();
          await settleManualRefund(pid, settleNote.trim());
        }, () => setMsg("Refund marked as returned. The owed amount is cleared."))}>Mark refund returned</button>
      </div>
    </div>
  );

  const cancelled = booking.status === "CANCELLED";
  const closed = cancelled || booking.status === "COMPLETED" || booking.status === "EXPIRED";
  const started = !!job && !CANCELLABLE.includes(job.status);

  async function run<T>(fn: () => Promise<T>, done: (r: T) => void) {
    setBusy(true); setWarn(null); setMsg(null);
    try { done(await fn()); } catch (e) { setWarn(e instanceof Error ? e.message : "That did not work."); } finally { setBusy(false); }
  }

  if (booking.cancelIntent?.state === "waiting" || booking.cancelIntent?.state === "needs_review") return <section className="ax-panel"><span className="ax-label">Cancellation requested</span><p className="ax-note">Your booked time is still held while the online payment resolves. The booking is not cancelled yet.{booking.cancelIntent.state === "needs_review" ? " A payment may still be in progress or arrive. The booking stays held and cancels by itself, with a refund reserved, if one does. Check the payment in the Razorpay dashboard." : ""}</p></section>;

  if (cancelled) {
    const owed = typeof booking.manualRefundDuePaise === "number" && booking.manualRefundDuePaise > 0 ? booking.manualRefundDuePaise : 0;
    if (!(booking.cancellationFeePaise && booking.cancellationFeePaise > 0)) {
      return owed > 0 ? (
        <section className="ax-panel" data-testid="refund-owed">
          <span className="ax-label">Refund owed</span>
          <p className="ax-note">{refundOwedText(owed)}</p>
          {settleBlock}
          {msg ? <p className="ax-status-msg">{msg}</p> : null}
          {warn ? <p className="ax-status-msg ax-status-msg--warn" role="alert">{warn}</p> : null}
        </section>
      ) : null;
    }
    const st = booking.cancellationFeeStatus;
    return (
      <section className="ax-panel">
        <span className="ax-label">Cancellation fee</span>
        <div className="kv"><span>Fee</span><span>{formatPaise(booking.cancellationFeePaise)}</span></div>
        <div className="kv"><span>Status</span><span>{st === "due" ? "Due" : st === "collected" ? "Collected" : st === "withheld" ? "Kept from the refund" : st === "waived" ? "Waived" : "Due"}</span></div>
        {owed > 0 ? <p className="ax-note" data-testid="refund-owed">{refundOwedText(owed)}</p> : null}
        {owed > 0 ? settleBlock : null}
        {typeof booking.refundedPaise === "number" && booking.refundedPaise > 0 ? <div className="kv"><span>Refunded</span><span>{formatPaise(booking.refundedPaise)}</span></div> : null}
        {(!st || st === "due") ? (
          <div className="ax-row">
            <button className="ax-button ax-button--primary" disabled={busy} onClick={() => run(() => settleCancellationFee(booking.id, "collected"), () => setMsg("Marked as collected."))}>Mark fee collected</button>
            <button className="ax-button" disabled={busy} onClick={() => run(() => settleCancellationFee(booking.id, "waived"), () => setMsg("Fee waived."))}>Waive fee</button>
          </div>
        ) : null}
        {msg ? <p className="ax-status-msg">{msg}</p> : null}
        {warn ? <p className="ax-status-msg ax-status-msg--warn" role="alert">{warn}</p> : null}
      </section>
    );
  }
  if (closed) return null;

  return (
    <section className="ax-panel">
      <span className="ax-label">Cancel booking</span>
      {started ? <p className="ax-status-msg">Work has started on this job, so it cannot be cancelled from here.</p> : (
        <>
          <label><span>Reason</span>
            <input value={reason} onChange={(e) => { setReason(e.target.value); setPreview(null); }} placeholder="Why is it being cancelled" maxLength={500} />
          </label>
          <label><span>Cancellation fee</span>
            <select value={feeAction} onChange={(e) => { setFeeAction(e.target.value as "charge" | "waive"); setPreview(null); }}>
              <option value="charge">Customer asked: apply the policy fee</option>
              <option value="waive">Studio cancelled: no fee</option>
            </select>
          </label>
          {!preview ? (
            <button className="ax-button" disabled={busy || reason.trim().length < 3}
              onClick={() => run(() => adminCancelBooking({ bookingId: booking.id, reason: reason.trim(), feeAction, preview: true }), setPreview)}>Review</button>
          ) : (
            <>
              <div className="kv"><span>Paid</span><span>{formatPaise(preview.paidPaise)}</span></div>
              <div className="kv"><span>Fee</span><span>{formatPaise(preview.feePaise)}{preview.feeStatus === "due" ? " (due, nothing paid yet)" : ""}</span></div>
              <div className="kv"><span>Refund to customer</span><span>{formatPaise(preview.refundPaise)}</span></div>
              {preview.refundPaise > 0 && preview.method !== "razorpay_payment_link" ? <p className="ax-status-msg">This was not paid online. Give the {formatPaise(preview.refundPaise)} back by hand.</p> : null}
              <div className="ax-row">
                <button className="ax-button ax-button--danger" disabled={busy}
                  onClick={() => run(() => adminCancelBooking({ bookingId: booking.id, reason: reason.trim(), feeAction }), () => setMsg("Booking cancelled."))}>Confirm cancel</button>
                <button className="ax-button" disabled={busy} onClick={() => setPreview(null)}>Back</button>
              </div>
            </>
          )}
        </>
      )}
      {msg ? <p className="ax-status-msg">{msg}</p> : null}
      {warn ? <p className="ax-status-msg ax-status-msg--warn" role="alert">{warn}</p> : null}
    </section>
  );
}
