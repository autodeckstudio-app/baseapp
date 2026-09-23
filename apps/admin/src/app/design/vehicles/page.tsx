"use client";

// Static preview (no data, no auth). Sample records only.
import type { Protection, Vehicle } from "@autodeck/core";
import { StaffShell } from "../../../experience/StaffShell";
import { VehiclesView } from "../../../experience/VehiclesView";
import { studioToday, shiftDay } from "../../../lib/format";
import "../../../experience/shell.css";

const today = studioToday();
const V = { id: "v1", registrationNumber: "GJ 01 AB 1234", make: "Hyundai", model: "Creta SX", year: 2023 } as unknown as Vehicle;
const P = (id: string, kind: string, provider: string | null, policyNumber: string | null, expiry: string | null, status: string) => ({ id, kind, provider, policyNumber, expiryDate: expiry, status }) as unknown as Protection;
const ROWS = [
  P("1", "insurance", "ICICI Lombard", "3001/2291/88", shiftDay(today, 18), "verified"),
  P("2", "puc", null, "PUC-GJ01-55821", shiftDay(today, -4), "expired"),
  P("3", "fasttag", "Paytm", null, shiftDay(today, 290), "unverified"),
  P("4", "extended_warranty", "Hyundai Shield", "HSW-44102", shiftDay(today, 610), "verified"),
];

export default function Preview() {
  return (
    <StaffShell pathname="/vehicles" office role="admin" who="studio@autodeck.example" home="/design/vehicles" onSignOut={() => {}}>
      <VehiclesView today={today} searching={false} vehicle={V} protections={ROWS} error={null} message={null} onSearch={() => {}} onAdd={() => {}} onStatus={() => {}} />
    </StaffShell>
  );
}
