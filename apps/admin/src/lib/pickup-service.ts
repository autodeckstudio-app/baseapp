"use client";

import { collection, onSnapshot, query, where, type Unsubscribe } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { COLLECTIONS } from "@autodeck/database";
import { db, functions } from "./firebase";

export interface PickupRequestRow {
  id: string;
  bookingId: string;
  kind: "pickup" | "drop" | "both";
  address: string;
  preferredTime: string;
  requestedPickupTime?: string;
  requestedDropTime?: string;
  agreedPickupAt?: string | null;
  agreedDropAt?: string | null;
  status: "REQUESTED" | "CONFIRMED" | "DONE" | "DECLINED";
  staffNote: string;
  /** Set by the server from the shared location: 0 = free, otherwise the whole request in paise (per leg, both = two legs). null/absent = confirm distance and fee by phone. */
  feePaise?: number | null;
  /** True once the fee is on the visit's bill. False after approval means the visit was already invoiced or paid. */
  feeBilled?: boolean;
  distanceKm?: number | null;
  /** ISO time the studio recorded each leg as done. Absent on older requests. Read-only here. */
  pickupCompletedAt?: string | null;
  dropCompletedAt?: string | null;
  createdAt: string;
}

/** Live feed, newest first, so a customer's new request or a status change made elsewhere shows up without a reload. */
export function listenToPickupRequests(
  tenantId: string,
  onData: (rows: PickupRequestRow[]) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(collection(db, COLLECTIONS.pickupRequests()), where("tenantId", "==", tenantId)),
    (snap) => onData(snap.docs.map((d) => ({ ...(d.data() as PickupRequestRow), id: d.id })).sort((x, y) => y.createdAt.localeCompare(x.createdAt))),
    onError,
  );
}

export async function setPickupStatus(
  requestId: string,
  status: PickupRequestRow["status"],
  staffNote: string,
  agreed: { agreedPickupAt?: string; agreedDropAt?: string } = {},
  feePaise?: number,
): Promise<void> {
  await httpsCallable(functions, "updatePickupRequest")({
    requestId,
    status,
    ...(staffNote.trim() ? { staffNote: staffNote.trim() } : {}),
    ...(agreed.agreedPickupAt?.trim() ? { agreedPickupAt: agreed.agreedPickupAt.trim() } : {}),
    ...(agreed.agreedDropAt?.trim() ? { agreedDropAt: agreed.agreedDropAt.trim() } : {}),
    ...(feePaise !== undefined ? { feePaise } : {}),
  });
}
