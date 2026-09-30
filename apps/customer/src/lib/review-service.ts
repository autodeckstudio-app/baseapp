import { doc, getDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { COLLECTIONS } from "@autodeck/database";
import { db, functions } from "./firebase";

export type Review = { rating: number; comment: string };

export async function getReview(bookingId: string): Promise<Review | null> {
  const snap = await getDoc(doc(db, COLLECTIONS.reviews(), bookingId));
  return snap.exists() ? (snap.data() as Review) : null;
}

export async function submitReview(bookingId: string, rating: number, comment: string): Promise<void> {
  await httpsCallable(functions, "submitReview")({ bookingId, rating, comment });
}
