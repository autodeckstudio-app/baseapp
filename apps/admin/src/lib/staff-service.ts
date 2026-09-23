"use client";

import { collection, getDocs, query, where } from "firebase/firestore";
import type { Employee } from "@autodeck/core";
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
async function callStaffRoute<T>(method: "POST" | "PATCH" | "DELETE", body: unknown): Promise<T> {
  const res = await fetch("/api/staff", {
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
