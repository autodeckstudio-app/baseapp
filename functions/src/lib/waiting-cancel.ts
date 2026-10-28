// LOCAL waiting-cancel workflow. No provider call. Private operational facts never live on readable booking docs.
import type { Firestore, Transaction } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import type { Booking, Payment, ServiceJob } from "@autodeck/core";
import type { AuthorizedUser } from "@autodeck/auth";
import { planReserveInTx, applyReserveInTx } from "./refund-outbox.js";
import { readCancelReads, writeCancelRestores } from "./cancel-booking.js";
import type { ProviderWebhookEvent } from "./payment-provider.js";

export const WAITING_CANCEL_COLLECTION = "bookingCancelIntents";
export type CancelIntent = { bookingId: string; tenantId: string; studioId: string; customerId: string; jobId: string; paymentId: string; state: "waiting" | "needs_review" | "resolved"; requestedAt: string; requestedBy: string; reason: string; reviewAt: string; resolution?: string; refundRequestId?: string };
export const unresolvedCancel = (b: { cancelIntent?: { state: string } }) => b.cancelIntent?.state === "waiting" || b.cancelIntent?.state === "needs_review";
const publicIntent = (i: CancelIntent) => ({ state: i.state, requestedAt: i.requestedAt });
const alert = (i: CancelIntent, kind: string, now: string) => ({ id: `waiting_cancel_${i.bookingId}`, tenantId: i.tenantId, studioId: i.studioId, kind, paymentId: i.paymentId, createdAt: now });
const actor = (tenantId: string) => ({ uid: "system", displayName: "AutoDeck", email: null, claims: { role: "system", tenantId, studioId: null } }) as unknown as AuthorizedUser;

export async function requestWaitingCancel(db: Firestore, b: Booking, p: Payment, user: AuthorizedUser, reason: string) {
  return db.runTransaction(async (tx) => {
    const bRef = db.collection("bookings").doc(b.id), pRef = db.collection("payments").doc(p.id), iRef = db.collection(WAITING_CANCEL_COLLECTION).doc(b.id);
    const [bs, ps, old] = await Promise.all([tx.get(bRef), tx.get(pRef), tx.get(iRef)]);
    const fresh = bs.data() as Booking | undefined, pay = ps.data() as Payment | undefined;
    const js = pay?.jobId ? await tx.get(db.collection("jobs").doc(pay.jobId)) : null;
    const j = js?.data() as ServiceJob | undefined;
    if (!fresh || !pay || !j || fresh.tenantId !== user.claims.tenantId || fresh.customerId !== b.customerId || pay.tenantId !== fresh.tenantId || pay.customerId !== fresh.customerId || pay.bookingId !== fresh.id || j.bookingId !== fresh.id || j.tenantId !== fresh.tenantId || j.customerId !== fresh.customerId || pay.studioId !== fresh.studioId || j.studioId !== fresh.studioId) throw new HttpsError("permission-denied", "Cancellation identity mismatch.");
    if (!["PENDING", "CONFIRMED"].includes(fresh.status) || !["PENDING_VEHICLE", "STANDBY", "VEHICLE_RECEIVED"].includes(j.status)) throw new HttpsError("failed-precondition", "Booking can no longer wait for cancellation.");
    if (old.exists) {
      const prior = old.data() as CancelIntent;
      if (prior.paymentId !== pay.id || prior.tenantId !== fresh.tenantId || prior.state === "resolved") throw new HttpsError("failed-precondition", "A different cancellation request exists.");
      return { success: true, cancellationPending: true };
    }
    if (pay.method !== "razorpay_payment_link" || !pay.razorpayPaymentLinkId || !["pending", "processing"].includes(pay.status)) throw new HttpsError("failed-precondition", "Payment changed. Reload and try again.");
    const requestedAt = new Date().toISOString();
    const reviewAt = fresh.holdExpiresAt && Number.isFinite(Date.parse(fresh.holdExpiresAt)) ? fresh.holdExpiresAt : new Date(Date.parse(requestedAt) + 15 * 60000).toISOString();
    const intent: CancelIntent = { bookingId: fresh.id, tenantId: fresh.tenantId, studioId: fresh.studioId, customerId: fresh.customerId, jobId: j.id, paymentId: pay.id, state: "waiting", requestedAt, requestedBy: user.uid, reason, reviewAt };
    tx.create(iRef, intent);
    tx.update(bRef, { cancelIntent: publicIntent(intent), updatedAt: requestedAt });
    tx.set(db.collection("auditLog").doc(), { tenantId: fresh.tenantId, studioId: fresh.studioId, action: "booking.cancel_requested", entityType: "Booking", entityId: fresh.id, performedBy: user.uid, performedByRole: user.claims.role, createdAt: requestedAt, after: { state: "waiting" } });
    return { success: true, cancellationPending: true };
  });
}

/** Called before ordinary webhook branches, inside their existing transaction, before any write. */
export async function resolveWaitingCancel(tx: Transaction, db: Firestore, p: Payment, ev: ProviderWebhookEvent, now: string): Promise<"completed" | "link_expired" | "link_cancelled" | "amount_mismatch" | null> {
  if (!p.bookingId || !["payment.captured", "payment.link.paid", "payment_link.paid", "payment_link.expired", "payment_link.cancelled"].includes(ev.eventType)) return null;
  const iRef = db.collection(WAITING_CANCEL_COLLECTION).doc(p.bookingId), snap = await tx.get(iRef);
  if (!snap.exists) return null;
  const i = snap.data() as CancelIntent;
  if (i.state === "resolved") return null;
  const bRef = db.collection("bookings").doc(i.bookingId), jRef = db.collection("jobs").doc(i.jobId);
  const [bs, js] = await Promise.all([tx.get(bRef), tx.get(jRef)]);
  const b = bs.data() as Booking | undefined, j = js.data() as ServiceJob | undefined;
  if (!b || !j || i.paymentId !== p.id || i.tenantId !== p.tenantId || i.customerId !== p.customerId || i.jobId !== p.jobId || b.tenantId !== i.tenantId || b.customerId !== i.customerId || j.tenantId !== i.tenantId || j.customerId !== i.customerId || j.bookingId !== b.id || p.studioId !== i.studioId || b.studioId !== i.studioId || j.studioId !== i.studioId || !unresolvedCancel(b)) return "amount_mismatch";
  const paid = ["payment.captured", "payment.link.paid", "payment_link.paid"].includes(ev.eventType);
  if (!p.razorpayPaymentLinkId || p.method !== "razorpay_payment_link" || (ev.referenceId && ev.referenceId !== p.id)) return "amount_mismatch";
  if (!paid && ev.providerPaymentLinkId !== p.razorpayPaymentLinkId) return "amount_mismatch";
  // Captured events need a stored-payment match; link events need the exact link as well.
  if (paid && (!Number.isSafeInteger(ev.amount) || ev.amount <= 0 || ev.amount !== p.amount || !p.currency || ev.currency !== p.currency || !ev.providerPaymentId || (p.razorpayPaymentId && p.razorpayPaymentId !== ev.providerPaymentId) || (ev.eventType !== "payment.captured" && ev.providerPaymentLinkId !== p.razorpayPaymentLinkId) || (ev.eventType === "payment.captured" && p.razorpayPaymentId !== ev.providerPaymentId && ev.providerPaymentLinkId !== p.razorpayPaymentLinkId))) return "amount_mismatch";
  // A link expiring/cancelling does not prove an IN-PROGRESS payment can no longer capture: keep waiting
  // (the review sweep escalates to staff) until a capture/failed result or manual review settles it.
  if (!paid) {
    // Razorpay: an attempt can authorise late and auto-capture within days; link terminal only blocks NEW attempts,
    // and a link's payments[] lists only CAPTURED payments - so a terminal link (pending or processing) never proves
    // nothing is in flight. Retain booking/slot/payment, flag staff, and let a later capture resolve it.
    const next = { ...i, state: "needs_review" as const };
    tx.update(iRef, { state: next.state, linkTerminalWhileProcessing: ev.eventType });
    tx.update(bRef, { cancelIntent: publicIntent(next), updatedAt: now });
    tx.set(db.collection("staffAlerts").doc(`waiting_cancel_${b.id}`), alert(i, "waiting_cancel_link_terminal_processing", now));
    return null;
  }
  if (paid && !["pending", "processing", "completed"].includes(p.status)) return "amount_mismatch";
  if (!["PENDING", "CONFIRMED"].includes(b.status) || !["PENDING_VEHICLE", "STANDBY", "VEHICLE_RECEIVED"].includes(j.status)) return "amount_mismatch";
  const reads = await readCancelReads(tx, db, b, b.id);
  const plan = paid ? await planReserveInTx(tx, db, { payment: { ...p, status: "completed" }, amountPaise: p.amount, reason: "waiting_cancel_capture", createdBy: "system", completingInThisTx: true }) : null;
  const prior = plan && !plan.ok && plan.code === "same_reservation" ? await tx.get(db.collection("refundRequests").where("paymentId", "==", p.id)) : null;
  const same = prior?.docs.map(d => d.data()).find(r => r.amountPaise === p.amount && r.reason === "waiting_cancel_capture" && ["reserved", "submitted", "accepted"].includes(r.status));
  const pRef = db.collection("payments").doc(p.id);
  if (paid) tx.update(pRef, { status: "completed", razorpayPaymentId: ev.providerPaymentId, providerEventId: ev.providerEventId, completedAt: p.completedAt ?? now, updatedAt: now });
  if (plan && !plan.ok && !same) {
    const next = { ...i, state: "needs_review" as const };
    tx.update(iRef, { state: next.state, reservationFailure: plan.code, owedAmountPaise: p.amount });
    tx.update(bRef, { cancelIntent: publicIntent(next), updatedAt: now });
    tx.set(db.collection("staffAlerts").doc(`waiting_cancel_${b.id}`), alert(i, "waiting_cancel_refund_not_reserved", now));
    return "completed"; // real capture recorded, slot retained, cancellation NOT reported as completed
  }
  const requestId = plan?.ok ? applyReserveInTx(tx, plan).requestId : same?.id;
  const next = { ...i, state: "resolved" as const };
  const resolution = paid ? "captured_refund_reserved" : "link_terminal_no_refund";
  tx.update(iRef, { state: next.state, resolution, ...(requestId ? { refundRequestId: requestId } : {}) });
  tx.update(bRef, { cancelIntent: publicIntent(next), status: "CANCELLED", cancelledAt: now, cancellationReason: "Cancellation request resolved", ...(paid ? { paymentStatus: "paid", refundStatus: "reserved" } : {}), updatedAt: now });
  tx.update(jRef, { status: "CANCELLED", ...(paid ? { paymentStatus: "paid" } : {}), statusHistory: [...(j.statusHistory ?? []), { status: "CANCELLED", changedAt: now, changedBy: "system", notes: "Waiting cancellation resolved" }], updatedAt: now });
  if (!paid) tx.update(pRef, { status: "cancelled", linkTerminal: ev.eventType === "payment_link.expired" ? "link_expired" : "link_cancelled", cancelledAt: now, updatedAt: now });
  writeCancelRestores(tx, reads, b, b.id, actor(i.tenantId), now, "Waiting cancellation resolved");
  tx.set(db.collection("auditLog").doc(), { tenantId: i.tenantId, studioId: i.studioId, action: "booking.cancel_resolved", entityType: "Booking", entityId: b.id, performedBy: "system", createdAt: now, after: { resolution } });
  return paid ? "completed" : ev.eventType === "payment_link.expired" ? "link_expired" : "link_cancelled";
}

/** Reuses the existing hold-sweep cadence. Review does not expire or release anything. */
export async function reviewWaitingCancels(db: Firestore, nowMs: number) {
  const all = await db.collection(WAITING_CANCEL_COLLECTION).where("state", "==", "waiting").limit(300).get();
  for (const d of all.docs) await db.runTransaction(async tx => {
    const s = await tx.get(d.ref), i = s.data() as CancelIntent | undefined;
    if (!i || i.state !== "waiting" || typeof i.bookingId !== "string" || !i.bookingId || !Number.isFinite(Date.parse(i.reviewAt)) || Date.parse(i.reviewAt) > nowMs) return;
    const bRef = db.collection("bookings").doc(i.bookingId), b = await tx.get(bRef);
    if (!b.exists || !unresolvedCancel(b.data() as Booking)) return;
    const now = new Date(nowMs).toISOString(), next = { ...i, state: "needs_review" as const };
    tx.update(d.ref, { state: next.state }); tx.update(bRef, { cancelIntent: publicIntent(next), updatedAt: now });
    tx.set(db.collection("staffAlerts").doc(`waiting_cancel_${i.bookingId}`), alert(i, "waiting_cancel_review", now));
  });
}
