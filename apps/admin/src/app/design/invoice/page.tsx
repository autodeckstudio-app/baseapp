"use client";

// Static preview (no data, no auth). Sample records only.
import type { Customer, Invoice, Payment, Vehicle } from "@autodeck/core";
import { StaffShell } from "../../../experience/StaffShell";
import { InvoiceView } from "../../../experience/InvoiceView";
import "../../../experience/shell.css";

const INV = {
  id: "i1", invoiceNumber: "AD/26-27/0142", status: "issued", issuedAt: new Date().toISOString(), jobId: "j1", bookingId: "b1",
  lineItems: [
    { description: "Ceramic coat (SUV)", quantity: 1, unitPrice: 1500000, total: 1500000 },
    { description: "Headlight restoration", quantity: 1, unitPrice: 122881, total: 122881 },
  ],
  subtotal: 1563559, tax: 281441, taxDescription: "GST 18%", total: 1845000, voidedAt: null, voidedReason: null,
} as unknown as Invoice;

export default function Preview() {
  return (
    <StaffShell pathname="/invoices" office role="admin" who="studio@autodeck.example" home="/design/invoice" onSignOut={() => {}}>
      <InvoiceView
        invoice={INV}
        customer={{ name: "Riya Patel", phone: "+91 98250 11234" } as unknown as Customer}
        vehicle={{ registrationNumber: "GJ 01 AB 1234", make: "Hyundai", model: "Creta SX" } as unknown as Vehicle}
        payment={{ status: "completed", method: "upi_manual", amount: 900000 } as unknown as Payment}
        studioName="AutoDeck Ahmedabad"
        message={null}
        voiding={false}
        onVoid={() => {}}
        onBack={() => {}}
        onOpen={() => {}}
      />
    </StaffShell>
  );
}
