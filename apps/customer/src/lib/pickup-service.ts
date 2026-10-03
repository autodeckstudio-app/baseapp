import { doc, getDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { COLLECTIONS } from "@autodeck/database";
import { db, functions } from "./firebase";

export type PickupRequest = { kind: "pickup" | "drop" | "both"; address: string; preferredTime: string; status: "REQUESTED" | "CONFIRMED" | "DONE" | "DECLINED"; staffNote: string };

export async function getPickupRequest(bookingId: string): Promise<PickupRequest | null> {
  const snap = await getDoc(doc(db, COLLECTIONS.pickupRequests(), bookingId));
  return snap.exists() ? (snap.data() as PickupRequest) : null;
}

export async function requestPickupDrop(input: { bookingId: string; kind: PickupRequest["kind"]; address: string; preferredTime?: string }): Promise<void> {
  await httpsCallable(functions, "requestPickupDrop")(input);
}

export async function requestAccountDeletion(): Promise<void> {
  await httpsCallable(functions, "requestAccountDeletion")({});
}
