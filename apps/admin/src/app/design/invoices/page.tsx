"use client";

// Static preview (no data, no auth). Sample records only.
import { StaffShell } from "../../../experience/StaffShell";
import "../../../experience/shell.css";
import type { Invoice } from "@autodeck/core";
import { InvoicesView } from "../../../experience/OfficeViews";

const I = (id: string, invoiceNumber: string, customerId: string, status: string, total: number, days: number) => ({ id, invoiceNumber, customerId, status, total, tax: Math.round(total * 18 / 118), issuedAt: status === "draft" ? null : new Date(Date.now() - days * 86400000).toISOString() }) as unknown as Invoice;
const ROWS = [
  I("1", "AD/26-27/0142", "a", "issued", 1845000, 0),
  I("2", "AD/26-27/0141", "c", "paid", 299900, 0),
  I("3", "AD/26-27/0140", "b", "paid", 129900, 1),
  I("4", "", "d", "draft", 650000, 0),
  I("5", "AD/26-27/0139", "e", "void", 129900, 2),
];
const NAMES = { a: "Riya Patel", b: "Karan Joshi", c: "Aarav Shah", d: "Nisha Desai", e: "Sahil Mehta" };

export default function Preview() {
  return (
    <StaffShell pathname="/invoices" office role="admin" who="studio@autodeck.example" home="/design/invoices" onSignOut={() => {}}>
      <InvoicesView invoices={ROWS} names={NAMES} loading={false} error={null} status="" onStatus={() => {}} search="" onSearch={() => {}} onOpen={() => {}} />
    </StaffShell>
  );
}
