"use client";

import { collection, getDocs, query, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import type { Employee } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { db, functions } from "./firebase";

export async function listStaff(tenantId: string): Promise<Employee[]> {
  const q = query(collection(db, COLLECTIONS.employees()), where("tenantId", "==", tenantId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as Employee);
}

interface AddStaffMemberInput {
  name: string;
  email: string;
  password: string;
  phone?: string;
  role: "studio" | "admin";
  studioId: string | null;
}

export async function addStaffMember(input: AddStaffMemberInput): Promise<{ employeeId: string }> {
  const fn = httpsCallable<AddStaffMemberInput, { employeeId: string }>(functions, "addStaffMember");
  const result = await fn(input);
  return result.data;
}

export async function updateStaffRole(
  employeeId: string,
  role: "studio" | "admin",
  studioId: string | null,
): Promise<void> {
  const fn = httpsCallable(functions, "updateStaffRole");
  await fn({ employeeId, role, studioId });
}

export async function deactivateStaffMember(employeeId: string): Promise<void> {
  const fn = httpsCallable(functions, "deactivateStaffMember");
  await fn({ employeeId });
}
