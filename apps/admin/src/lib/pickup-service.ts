"use client";

import { collection, getDocs, query, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { COLLECTIONS } from "@autodeck/database";
import { db, functions } from "./firebase";

export interface PickupRequestRow {
  id: string;
  bookingId: string;
  kind: "pickup" | "drop" | "both";
  address: string;
  preferredTime: string;
  status: "REQUESTED" | "CONFIRMED" | "DONE" | "DECLINED";
  staffNote: string;
  createdAt: string;
}

export async function listPickupRequests(tenantId: string): Promise<PickupRequestRow[]> {
  const snap = await getDocs(query(collection(db, COLLECTIONS.pickupRequests()), where("tenantId", "==", tenantId)));
  return snap.docs.map((d) => d.data() as PickupRequestRow).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function setPickupStatus(requestId: string, status: PickupRequestRow["status"], staffNote: string): Promise<void> {
  await httpsCallable(functions, "updatePickupRequest")({ requestId, status, ...(staffNote.trim() ? { staffNote: staffNote.trim() } : {}) });
}
