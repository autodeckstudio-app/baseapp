"use client";

import {CombinedReturnPanel} from "./CombinedReturnPanel";
import { refundOwedText } from "../lib/refund-owed-copy";
import { useEffect,useRef,useState } from "react";
import { collection, getDocs, limit, query, where } from "firebase/firestore";
import type { Booking, Payment, ServiceJob } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { adminCancelBooking, settleCancellationFee, settleManualRefund, type CancelSummary } from "../lib/bookings-service";
import { formatPaise } from "../lib/format";

const CANCELLABLE = ["PENDING_VEHICLE", "STANDBY", "VEHICLE_RECEIVED"];

/** Admin-only cancel with the fee and refund shown before anything happens, and the fee settle buttons after. */
export function CancelBookingPanel({ booking, job, compact = false }: { booking: Booking; job: ServiceJob | null; compact?: boolean }) {
  const [reason, setReason] = useState("");
  const [feeAction, setFeeAction] = useState<"charge" | "waive">("charge");
  const [preview, setPreview] = useState<CancelSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [warn, setWarn] = useState<string | null>(null);
  const [settleNote, setSettleNote] = useState("");
  const [reviewWaiting,setReviewWaiting]=useState(false),[paymentChecked,setPaymentChecked]=useState(false),[paymentCheckNote,setPaymentCheckNote]=useState('');
  const isWaiting=!!booking.combinedPayment&&['waiting','needs_review'].includes(booking.cancelIntent?.state??'');
  const paymentCheck=isWaiting&&paymentChecked&&paymentCheckNote.trim().length>=3?{confirmed:true as const,note:paymentCheckNote.trim()}:undefined;
  const scope=`${booking.id}:${booking.updatedAt??''}`,scopeRef=useRef(scope),runLock=useRef(false);scopeRef.current=scope;
  useEffect(()=>{setReason('');setFeeAction('charge');setPreview(null);setMsg(null);setWarn(null);setSettleNote('');setReviewWaiting(false);setPaymentChecked(false);setPaymentCheckNote('');setBusy(false);runLock.current=false;},[scope]);

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
      <div className="ax-row" style={{display:"flex",flexWrap:"wrap",gap:8}}>
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
    if(runLock.current)return;const currentScope=scope;runLock.current=true;setBusy(true);setWarn(null);setMsg(null);
    try{const result=await fn();if(scopeRef.current===currentScope)done(result);}catch(e){if(scopeRef.current===currentScope)setWarn(e instanceof Error?e.message:"That did not work.");}finally{if(scopeRef.current===currentScope){runLock.current=false;setBusy(false);}}
  }

  if ((booking.cancelIntent?.state === "waiting" || booking.cancelIntent?.state === "needs_review")&&(!booking.combinedPayment||!reviewWaiting)) return <section className="ax-panel"><span className="ax-label">Cancellation requested</span>{booking.combinedPayment?<><dl className="ax-scope-facts"><div><dt>Booking</dt><dd>Booked time stays held.</dd></div><div><dt>Next step</dt><dd>Check payment, then review cancellation.</dd></div><div><dt>Refund</dt><dd>No automatic refund.</dd></div></dl></>:<><h3 style={{margin:"12px 0"}}>Not cancelled yet</h3><dl className="ax-scope-facts"><div><dt>Booked time</dt><dd>Held while the online payment resolves.</dd></div>{booking.cancelIntent?.state === "needs_review" ? <><div><dt>Online payment</dt><dd>May still be in progress or arrive.</dd></div><div><dt>If payment arrives</dt><dd>Booking cancels automatically with a refund reserved.</dd></div><div><dt>Next step</dt><dd>Check payment in the Razorpay dashboard.</dd></div></>:null}</dl></>}{booking.combinedPayment?<button type="button" className="ax-button" onClick={()=>setReviewWaiting(true)}>Review after payment check</button>:null}{msg?<p className="ax-status-msg">{msg}</p>:null}{warn?<p role="alert" className="ax-status-msg ax-status-msg--warn">{warn}</p>:null}</section>;

  if(cancelled&&booking.combinedPayment)return <CombinedReturnPanel bookingId={booking.id} revision={booking.updatedAt}/>;
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
          <div className="ax-row" style={{display:"flex",flexWrap:"wrap",gap:8}}>
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
  if (compact && started) return <details className="ax-panel ax-job-disclosure"><summary>Cancellation unavailable</summary><p className="ax-status-msg">Work has started on this job, so it cannot be cancelled from here.</p></details>;

  return (
    <section className="ax-panel">
      <span className="ax-label">Cancel booking</span>
      {started ? <p className="ax-status-msg">Work has started on this job, so it cannot be cancelled from here.</p> : (
        <>
          <label><span>Reason</span>
            <input style={{color:"#1B1A19"}} value={reason} onChange={(e) => { setReason(e.target.value); setPreview(null); }} placeholder="Why is it being cancelled" maxLength={500} />
          </label>
          <label><span>Cancellation fee</span>
            <select style={{color:"#1B1A19"}} value={feeAction} onChange={(e) => { setFeeAction(e.target.value as "charge" | "waive"); setPreview(null); }}>
              <option value="charge">Apply customer fee</option>
              <option value="waive">No fee: studio cancelled</option>
            </select>
          </label>
          {isWaiting?<div style={{display:'grid',gap:8}}><label style={{display:'flex',gap:8}}><input type="checkbox" checked={paymentChecked} onChange={e=>{setPaymentChecked(e.target.checked);setPreview(null);}}/><span>I checked the original payment in Razorpay.</span></label><label><span>Payment check evidence</span><input style={{color:"#1B1A19"}} aria-label="Payment check evidence" value={paymentCheckNote} maxLength={500} onChange={e=>{setPaymentCheckNote(e.target.value);setPreview(null);}}/></label></div>:null}
          {!preview ? (
            <button className="ax-button" disabled={busy || reason.trim().length < 3 || isWaiting&&!paymentCheck}
              onClick={() => run(() => adminCancelBooking({ bookingId: booking.id, reason: reason.trim(), feeAction,paymentCheck, preview: true }), setPreview)}>Review</button>
          ) : preview.cancellationPending ? <div style={{display:'grid',gap:8}}><span className="ax-note">Online payment unresolved. Booked time stays held.</span><button className="ax-button" disabled={busy} onClick={()=>run(()=>adminCancelBooking({bookingId:booking.id,reason:reason.trim(),feeAction}),()=>{setMsg("Payment check requested. Booking not cancelled.");setPreview(null);setReviewWaiting(false);})}>Request payment check</button><button className="ax-button" disabled={busy} onClick={()=>setPreview(null)}>Back</button></div> : (
            <>
              <div className="kv"><span>Paid</span><span>{formatPaise(preview.paidPaise)}</span></div>
              <div className="kv"><span>Fee</span><span>{formatPaise(preview.feePaise)}{preview.feeStatus === "due" ? " (due, nothing paid yet)" : ""}</span></div>
              <div className="kv"><span>Refund to customer</span><span>{formatPaise(preview.refundPaise)}</span></div>
              {preview.refundPaise > 0 && preview.method !== "razorpay_payment_link" && preview.method !== "combined_original_methods" ? <p className="ax-status-msg">This was not paid online. Give the {formatPaise(preview.refundPaise)} back by hand.</p> : null}
              {preview.method==="combined_original_methods"?<><div className="kv"><span>Fee allocation</span><span>Advance first.</span></div><div className="kv"><span>Percentage fee basis</span><span>Service incl. GST.</span></div><div className="kv"><span>Unused transport</span><span>Excluded from percentage fee.</span></div><div className="kv"><span>Returns</span><span>Original methods. Separate approval follows.</span></div></>:null}
              <div className="ax-row" style={{display:"flex",flexWrap:"wrap",gap:8}}>
                <button className="ax-button ax-button--danger" disabled={busy}
                  onClick={() => run(() => adminCancelBooking({ bookingId: booking.id, reason: reason.trim(), feeAction,paymentCheck }), (result) => {if(result.cancellationPending){setMsg("Payment check still pending. Booking not cancelled.");setPreview(null);setReviewWaiting(false);}else setMsg("Booking cancelled.");})}>Confirm cancel</button>
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
