import { doc, getDoc, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { COLLECTIONS } from "@autodeck/database";
import { db, functions } from "./firebase";

export type PickupRequest = { kind: "pickup" | "drop" | "both"; address: string; preferredTime: string; requestedPickupTime: string; requestedDropTime: string; agreedPickupAt: string | null; agreedDropAt: string | null; status: "REQUESTED" | "CONFIRMED" | "DONE" | "DECLINED"; staffNote: string; feePaise?: number | null };

export async function getPickupRequest(bookingId: string): Promise<PickupRequest | null> {
  const snap = await getDoc(doc(db, COLLECTIONS.pickupRequests(), bookingId));
  return snap.exists() ? (snap.data() as PickupRequest) : null;
}

export async function requestPickupDrop(input: { bookingId: string; kind: PickupRequest["kind"]; address: string; preferredTime?: string; requestedPickupTime?: string; requestedDropTime?: string; lat?: number; lng?: number }): Promise<void> {
  await httpsCallable(functions, "requestPickupDrop")(input);
}

/** One try at the device location. Resolves null if unavailable or refused. Web only. */
export function getDeviceLocation(): Promise<{ lat: number; lng: number } | null> {
  const nav = (globalThis as unknown as { navigator?: { geolocation?: { getCurrentPosition: (ok: (p: { coords: { latitude: number; longitude: number } }) => void, no: () => void, o?: object) => void } } }).navigator;
  if (!nav?.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => nav.geolocation!.getCurrentPosition((p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }), () => resolve(null), { enableHighAccuracy: false, timeout: 10000 }));
}

export async function requestAccountDeletion(): Promise<void> {
  await httpsCallable(functions, "requestAccountDeletion")({});
}

export async function cancelAccountDeletion(): Promise<void> {
  await httpsCallable(functions, "cancelAccountDeletion")({});
}

export function listenToPickupRequest(bookingId: string, onData: (request: PickupRequest | null) => void, onError: (error: Error) => void): Unsubscribe {
  return onSnapshot(doc(db, COLLECTIONS.pickupRequests(), bookingId), (snap) => onData(snap.exists() ? snap.data() as PickupRequest : null), onError);
}
