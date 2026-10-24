import type { Firestore } from "firebase-admin/firestore";
import type { Booking } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";

export const REFUNDS_OWED_CAP = 2000;
export interface RefundsOwed { owedPaise: number; count: number; truncated: boolean }

/**
 * Money the studio OWES customers from manual (counter/cash) cancels and has NOT returned (booking.manualRefundDuePaise).
 * A running total of open obligations, not a day or month flow, so it is shown beside revenue and never netted into it.
 * Equality-only query (no composite index). If the cancelled-booking set exceeds the cap the result says truncated: the total is then a floor, not complete.
 */
export async function refundsOwed(db: Firestore, tenantId: string, studioId: string): Promise<RefundsOwed> {
  const snap = await db.collection(COLLECTIONS.bookings()).where("tenantId", "==", tenantId).where("studioId", "==", studioId)
    .where("status", "==", "CANCELLED").limit(REFUNDS_OWED_CAP + 1).get();
  let owedPaise = 0, count = 0;
  for (const d of snap.docs.slice(0, REFUNDS_OWED_CAP)) {
    const due = (d.data() as Booking).manualRefundDuePaise;
    if (typeof due === "number" && due > 0) { owedPaise += due; count += 1; }
  }
  return { owedPaise, count, truncated: snap.size > REFUNDS_OWED_CAP };
}
