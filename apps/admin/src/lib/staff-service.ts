"use client";

import { collection, getDocs, query, where } from "firebase/firestore";
import type { Employee, StaffAccessRequest } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { db } from "./firebase";

export async function listStaff(tenantId: string): Promise<Employee[]> {
  const q = query(collection(db, COLLECTIONS.employees()), where("tenantId", "==", tenantId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as Employee);
}

interface AddStaffMemberInput {
  name: string;
  // The Google account the person will sign in with.
  email: string;
  phone?: string;
  role: "studio" | "admin";
  studioId: string | null;
}

// Roster changes go through the admin app's own server route (Admin SDK,
// session-cookie gated) so they work before Cloud Functions are deployed.
// The matching callables stay in functions/ for the mobile apps.
async function callStaffRoute<T>(method: "POST" | "PATCH" | "DELETE", body: unknown, url = "/api/staff"): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "same-origin",
  });
  const data = (await res.json().catch(() => ({}))) as { message?: string } & T;
  if (!res.ok) throw new Error(data.message ?? "Request failed.");
  return data;
}

export async function addStaffMember(input: AddStaffMemberInput): Promise<{ employeeId: string }> {
  return callStaffRoute("POST", input);
}

export async function updateStaffRole(
  employeeId: string,
  role: "studio" | "admin",
  studioId: string | null,
): Promise<void> {
  await callStaffRoute("PATCH", { employeeId, role, studioId });
}

export async function deactivateStaffMember(employeeId: string): Promise<void> {
  await callStaffRoute("DELETE", { employeeId });
}

export async function listAccessRequests(tenantId: string): Promise<StaffAccessRequest[]> {
  const q = query(collection(db, COLLECTIONS.staffAccessRequests()), where("tenantId", "==", tenantId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as StaffAccessRequest).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function decideAccessRequest(uid: string, decision: "approve" | "reject", role: "studio" | "admin" = "studio", note?: string): Promise<void> {
  await callStaffRoute("POST", { uid, decision, role, note }, "/api/staff/requests");
}
