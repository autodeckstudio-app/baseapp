"use client";
import type { Booking, Customer, Invoice, Payment, PaymentMethod, ServiceJob } from "@autodeck/core";
import { membershipCoveredLabel } from "@autodeck/core";
import { canOfferPayment, coveredSettlePanelVisible, coveredVisitSettlementNote, paymentPanelMode } from "../lib/payment-panel-state";
import { StatusBadge } from "./StatusBadge";
import { formatPaise } from "../lib/format";
import { statusLabel } from "../lib/status-label";

const METHOD_LABEL: Record<string, string> = { cash: "Cash", upi_manual: "UPI", bank_transfer: "Bank transfer", razorpay_payment_link: "Online (Razorpay)" };

export function JobPaymentPanel({
  job,
  booking,
  payment,
  invoice,
  customer,
  status,
  setStatus,
  method,
  setMethod,
  reference,
  setReference,
  linking,
  recording,
  confirming,
  onCreateLink,
  onRecordPayment,
  onConfirmCashPayment,
  onOpenInvoice,
  onRefreshPayment,
}: {
  job: ServiceJob;
  booking: Booking | null;
  payment: Payment | null | undefined;
  invoice: Invoice | null;
  customer: Customer | null;
  status: string | null;
  setStatus: (value: string | null) => void;
  method: PaymentMethod;
  setMethod: (value: PaymentMethod) => void;
  reference: string;
  setReference: (value: string) => void;
  linking: boolean;
  recording: boolean;
  confirming: boolean;
  onCreateLink: () => void;
  onRecordPayment: () => void;
  onConfirmCashPayment: () => void;
  onOpenInvoice: (invoiceId: string) => void;
  onRefreshPayment?:()=>void;
}) {
  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setStatus("Link copied.");
    } catch {
      setStatus("Could not copy. Select the link and copy it.");
    }
  }

  function whatsappHref(url: string): string {
    const digits = (customer?.phone ?? "").replace(/\D/g, "");
    const first = (customer?.name ?? "").split(" ")[0] || "there";
    const text = `Hi ${first}, here is your AutoDeck bill of ${formatPaise(job.totalAmount)}. Pay securely: ${url}`;
    return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
  }

  // Gate ON + covered + unsettled: the MembershipSettlement panel on this page is the
  // single tile for this state (status + one settle action); this panel stays out of the way.
  if (coveredSettlePanelVisible(job, booking)) return null;

  return (
          <section className="ax-panel">
            <span className="ax-label">Payment</span>
            {payment?.status==="completed"&&job.paymentStatus!=="paid"&&!(payment as Payment & {invoiceReviewNeeded?:boolean}).invoiceReviewNeeded?<p className="ax-note">Payment records are syncing. Do not collect another payment. Delivery stays on hold until the job is marked paid.</p>:null}
            {status && <p className="ax-status-msg" role="status">{status}</p>}
            {paymentPanelMode(payment) === "loading" ? (
              <p className="ax-note" style={{ marginTop: 0 }}>Loading payment…</p>
            ) : payment ? (
              <>
                <div className="kv"><span>{METHOD_LABEL[payment.method] ?? statusLabel(payment.method)}</span><span><StatusBadge label={(payment as Payment & {invoiceReviewNeeded?:boolean}).invoiceReviewNeeded ? "Received - needs review" : payment.status==="completed"&&job.paymentStatus!=="paid"?"Payment records syncing":payment.status} /></span></div>
                {(payment as Payment & {invoiceReviewNeeded?:boolean}).invoiceReviewNeeded ? <p className="ax-note">Money received, but this payment needs office review. The job is not marked paid. Do not collect another payment.</p> : null}
                <div className="kv"><span>Amount</span><span className="ax-data">{formatPaise(payment.amount)}</span></div>
                {(payment.status === "pending" || payment.status === "processing") &&
                  (payment.method === "razorpay_payment_link" ? (
                    <>
                      <p className="ax-note">Payment link pending. No payment is confirmed in AutoDeck yet.</p>
                      {onRefreshPayment?<button type="button" className="ax-button" onClick={onRefreshPayment}>Refresh recorded payment status</button>:null}
                      <p className="ax-note">Counter collection is on hold while this online link is pending. A safe switch is not available here yet. Do not record or collect a second payment.</p>
                      {payment.paymentUrl && (
                        <div className="ax-panel-actions">
                          <button type="button" className="ax-button" onClick={() => void copyLink(payment.paymentUrl as string)}>Copy link</button>
                          <a className="ax-button ax-button--primary" href={whatsappHref(payment.paymentUrl)} target="_blank" rel="noreferrer">Send on WhatsApp</a>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="ax-panel-actions">
                      <button type="button" className="ax-button ax-button--primary" onClick={() => void onConfirmCashPayment()} disabled={confirming}>
                        {confirming ? "Confirming…" : "Confirm money received"}
                      </button>
                    </div>
                  ))}
              </>
            ) : (
              <p className="ax-note" style={{ marginTop: 0 }}>{membershipCoveredLabel(job) ?? (booking ? membershipCoveredLabel(booking) : null) ?? "No payment started yet."}</p>
            )}
            {invoice && (
              <>
                <div className="kv"><span>Invoice {invoice.invoiceNumber}</span><span><StatusBadge label={invoice.status} /></span></div>
                <div className="ax-panel-actions">
                  <button type="button" className="ax-button" onClick={() => onOpenInvoice(invoice.id)}>Open invoice</button>
                </div>
              </>
            )}
            {coveredVisitSettlementNote(job, booking) ? (
              <p className="ax-note" style={{ marginTop: 8 }}>{coveredVisitSettlementNote(job, booking)}</p>
            ) : null}
            {!(booking?.cancelIntent?.state === "waiting" || booking?.cancelIntent?.state === "needs_review") && !membershipCoveredLabel(job) && !(booking && membershipCoveredLabel(booking)) && canOfferPayment(payment, job.paymentStatus).link && (
              <div className="ax-panel-actions" style={{ marginTop: 12 }}>
                <button type="button" className="ax-button ax-button--primary" style={{ width: "100%" }} onClick={() => void onCreateLink()} disabled={linking}>
                  {linking ? "Creating link…" : `Send ${formatPaise(job.totalAmount)} payment link`}
                </button>
              </div>
            )}
            {!(booking?.cancelIntent?.state === "waiting" || booking?.cancelIntent?.state === "needs_review") && !membershipCoveredLabel(job) && !(booking && membershipCoveredLabel(booking)) && canOfferPayment(payment, job.paymentStatus).counter && (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--ad-border-subtle)" }}>
                <p className="ax-label" style={{ margin: "0 0 12px" }}>Record a payment taken at the counter</p>
                <label className="ax-form-row">
                  <span className="ax-label">Method</span>
                  <select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
                    <option value="cash">Cash</option>
                    <option value="upi_manual">UPI</option>
                    <option value="bank_transfer">Bank transfer</option>
                  </select>
                </label>
                <label className="ax-form-row">
                  <span className="ax-label">Reference (optional)</span>
                  <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="UPI or transfer reference" />
                </label>
                <button type="button" className="ax-button ax-button--primary" style={{ width: "100%" }} onClick={() => void onRecordPayment()} disabled={recording}>
                  {recording ? "Recording…" : `Record ${formatPaise(job.totalAmount)} received`}
                </button>
              </div>
            )}
          </section>
  );
}
