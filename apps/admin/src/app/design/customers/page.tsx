"use client";

// Static preview (no data, no auth). Sample records only.
import { StaffShell } from "../../../experience/StaffShell";
import "../../../experience/shell.css";
import type { Customer } from "@autodeck/core";
import { CustomersView } from "../../../experience/OfficeViews";

const d = (days: number) => new Date(Date.now() - days * 86400000).toISOString();
const C = (id: string, name: string, phone: string, days: number) => ({ id, name, phone, createdAt: d(days) }) as unknown as Customer;
const ROWS = [
  C("1", "Riya Patel", "+91 98250 11234", 3),
  C("2", "Karan Joshi", "+91 99099 00042", 12),
  C("3", "Nisha Desai", "+91 97129 77810", 40),
  C("4", "Aarav Shah", "+91 98980 43210", 95),
  C("5", "Sahil Mehta", "+91 90990 98765", 180),
  C("6", "Meera Iyer", "+91 98200 55501", 1),
];

export default function Preview() {
  return (
    <StaffShell pathname="/customers" office role="admin" who="studio@autodeck.example" home="/design/customers" onSignOut={() => {}}>
      <CustomersView customers={ROWS} loading={false} error={null} search="" onSearch={() => {}} onPlateLookup={() => {}} plateMessage={null} onOpen={() => {}} />
    </StaffShell>
  );
}
