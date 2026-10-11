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

const V = [
  { ownerId: "1", registrationNumber: "GJ01KP4821" }, { ownerId: "1", registrationNumber: "GJ05AB1234" },
  { ownerId: "2", registrationNumber: "GJ01RT7788" }, { ownerId: "3", registrationNumber: "MH12XY9090" },
  { ownerId: "4", registrationNumber: "GJ18CD5566" }, { ownerId: "4", registrationNumber: "GJ01ZZ0001" }, { ownerId: "4", registrationNumber: "GJ01ZZ0002" },
];
const J = (customerId: string, days: number, status: string, paymentStatus: string, totalAmount: number) =>
  ({ customerId, createdAt: d(days), status, paymentStatus, totalAmount }) as never;
const JOBS = [J("1", 2, "DELIVERED", "unpaid", 249900), J("1", 30, "DELIVERED", "paid", 99900), J("1", 60, "DELIVERED", "paid", 59900),
  J("2", 8, "DELIVERED", "paid", 149900), J("3", 20, "DELIVERED", "partial", 399900), J("4", 5, "IN_PROGRESS", "unpaid", 79900), J("4", 40, "DELIVERED", "paid", 79900)];

export default function Preview() {
  return (
    <StaffShell pathname="/customers" office role="admin" who="studio@autodeck.example" home="/design/customers" onSignOut={() => {}}>
      <CustomersView customers={ROWS} loading={false} error={null} vehicles={V} jobs={JOBS} search="" onSearch={() => {}} onPlateLookup={() => {}} plateMessage={null} onOpen={() => {}} />
    </StaffShell>
  );
}
