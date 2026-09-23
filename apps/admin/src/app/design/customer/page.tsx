"use client";

// Static preview (no data, no auth). Sample records only.
import { StaffShell } from "../../../experience/StaffShell";
import { CustomerView, type CustomerData } from "../../../experience/CustomerView";
import { studioToday, shiftDay } from "../../../lib/format";
import "../../../experience/shell.css";

const t = studioToday();
const iso = (days: number, h = 10) => `${shiftDay(t, days)}T0${h - 5}:30:00.000Z`;
const D = {
  customer: { id: "c1", name: "Riya Patel", phone: "+91 98250 11234", createdAt: iso(-210) },
  vehicles: [{ id: "v1", registrationNumber: "GJ 01 AB 1234", make: "Hyundai", model: "Creta SX", year: 2023, category: "suv" }, { id: "v2", registrationNumber: "GJ 01 KX 0021", make: "Maruti", model: "Swift", year: 2019, category: "hatchback" }],
  bookings: [{ id: "b1", scheduledAt: iso(0, 9), status: "ACTIVE", totalAmount: 1845000 }, { id: "b2", scheduledAt: iso(-40), status: "COMPLETED", totalAmount: 129900 }],
  jobs: [{ id: "j1", scheduledAt: iso(0, 9), status: "IN_PROGRESS", totalAmount: 1845000 }, { id: "j2", scheduledAt: iso(-40), status: "DELIVERED", totalAmount: 129900 }],
  memberships: [{ id: "m1", tier: "gold", status: "active", washesUsed: 3, washesTotal: 4, endDate: shiftDay(t, 21) }],
  payments: [{ id: "p1", createdAt: iso(0), status: "completed", method: "upi_manual", amount: 900000 }, { id: "p2", createdAt: iso(-40), status: "completed", method: "cash", amount: 129900 }],
  invoices: [{ id: "i1", invoiceNumber: "AD/26-27/0142", status: "issued", total: 1845000 }, { id: "i2", invoiceNumber: "AD/26-27/0088", status: "paid", total: 129900 }],
  notifications: [{ id: "n1", createdAt: iso(0), type: "job_status", body: "Your Creta is being polished. We'll message you when it's ready.", readAt: iso(0) }],
  audit: [{ id: "a1", createdAt: iso(-210), action: "CUSTOMER_CREATED", performedByRole: "system" }],
  warranties: [{ id: "w1", warrantyLabel: "Coating warranty", endDate: shiftDay(t, 1095) }],
  protections: [{ id: "pr1", vehicleId: "v1", kind: "insurance", expiryDate: shiftDay(t, 18) }, { id: "pr2", vehicleId: "v1", kind: "puc", expiryDate: shiftDay(t, -4) }, { id: "pr3", vehicleId: "v2", kind: "fasttag", expiryDate: shiftDay(t, 200) }],
} as unknown as CustomerData;

export default function Preview() {
  return (
    <StaffShell pathname="/customers" office role="admin" who="studio@autodeck.example" home="/design/customer" onSignOut={() => {}}>
      <CustomerView d={D} onBack={() => {}} onOpen={() => {}} />
    </StaffShell>
  );
}
