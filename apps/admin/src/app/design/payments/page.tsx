"use client";

// Static preview (no data, no auth). Sample records only.
import { StaffShell } from "../../../experience/StaffShell";
import "../../../experience/shell.css";
import type { Payment } from "@autodeck/core";
import { PaymentsView } from "../../../experience/OfficeViews";
import { studioToday } from "../../../lib/format";

const now = Date.now();
const P = (id: string, customerId: string, status: string, method: string, amount: number, hoursAgo: number, invoiceId: string | null) => ({ id, customerId, status, method, amount, createdAt: new Date(now - hoursAgo * 3600000).toISOString(), invoiceId }) as unknown as Payment;
const ROWS = [
  P("1", "a", "completed", "upi_manual", 900000, 1, "i1"),
  P("2", "b", "pending", "razorpay_payment_link", 129900, 2, null),
  P("3", "c", "completed", "cash", 299900, 3, "i3"),
  P("4", "d", "failed", "razorpay_payment_link", 650000, 5, null),
  P("5", "e", "refunded", "upi_manual", 129900, 30, "i5"),
  P("6", "a", "completed", "bank_transfer", 945000, 50, "i6"),
];
const NAMES = { a: "Riya Patel", b: "Karan Joshi", c: "Aarav Shah", d: "Nisha Desai", e: "Sahil Mehta" };

export default function Preview() {
  return (
    <StaffShell pathname="/payments" office role="admin" who="studio@autodeck.example" home="/design/payments" onSignOut={() => {}}>
      <PaymentsView payments={ROWS} names={NAMES} loading={false} error={null} status="" onStatus={() => {}} search="" onSearch={() => {}} message={null} refundingId={null} onRefund={() => {}} onOpenInvoice={() => {}} today={studioToday()} />
    </StaffShell>
  );
}
