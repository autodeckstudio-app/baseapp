import { doc, getDoc, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { COLLECTIONS } from "@autodeck/database";
import { db, functions } from "./firebase";

export type PickupRequest = {
  /** ISO time the studio recorded the leg as done. Absent on requests made before leg progress existed. */
  pickupCompletedAt?: string | null; dropCompletedAt?: string | null;
  /** Set by the studio when a member free pickup covered this request. */
  memberMembershipId?: string | null; kind: "pickup" | "drop" | "both"; address: string; preferredTime: string; requestedPickupTime: string; requestedDropTime: string; agreedPickupAt: string | null; agreedDropAt: string | null; status: "REQUESTED" | "CONFIRMED" | "DONE" | "DECLINED"; staffNote: string; feePaise?: number | null };

export async function getPickupRequest(bookingId: string): Promise<PickupRequest | null> {
  const snap = await getDoc(doc(db, COLLECTIONS.pickupRequests(), bookingId));
  return snap.exists() ? (snap.data() as PickupRequest) : null;
}

export type PickupQuoteLeg = {
  leg: "pickup" | "drop";
  /** This leg's road distance for display, floored to 0.1 km by the server (approximate). */
  km: number;
  /** This leg's exact fee in paise, from the exact server-measured metres. */
  feePaise: number;
};
export type PickupQuote = {
  quoteId: string; kind: "pickup" | "drop" | "both";
  /** One entry per selected leg, each measured in the direction actually driven. */
  legs: PickupQuoteLeg[];
  /** Exact total fee the customer is charged for the whole request, in paise (first 3 road km free per leg, then Rs 25/extra road km). */
  feePaise: number; freeMeters: number; expiresAt: string;
};

function rupeesFromPaise(paise: number): string {
  const r = paise / 100;
  return `Rs ${Number.isInteger(r) ? r : r.toFixed(2)}`;
}

/** Honest one-glance quote text: the distance is approximate, the fee is exact - so near the free 3 km boundary
 *  the free/extra/fee split is spelled out instead of a bare rounded distance next to a small fee. */
export function describePickupQuote(q: PickupQuote): string {
  const line = (l: PickupQuoteLeg): string => {
    const label = l.leg === "pickup" ? "Pickup" : "Drop-off";
    if (l.feePaise === 0) return `${label}: about ${l.km} km by road, within the free first 3 km - free.`;
    const extra = Math.round((l.km - 3) * 10) / 10;
    const extraText = extra > 0 ? `about ${extra} km` : "less than 0.1 km";
    return `${label}: about ${l.km} km by road - first 3 km free, ${extraText} extra at Rs 25/km - ${rupeesFromPaise(l.feePaise)}.`;
  };
  const lines = q.legs.map(line).join(" ");
  return q.legs.length > 1 ? `${lines} Total ${rupeesFromPaise(q.feePaise)}.` : lines;
}

/** Server-checked ROAD distance + stored quote. Throws when the distance cannot be checked - the caller must
 *  offer continuing without pickup, never invent a distance or fee. */
export async function getPickupQuote(input: { kind: PickupRequest["kind"]; lat: number; lng: number }): Promise<PickupQuote> {
  const res = await httpsCallable(functions, "getPickupQuote")(input);
  return res.data as PickupQuote;
}

export async function requestPickupDrop(input: { bookingId: string; kind: PickupRequest["kind"]; address: string; preferredTime?: string; requestedPickupTime?: string; requestedDropTime?: string; lat?: number; lng?: number; quoteId?: string }): Promise<void> {
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
