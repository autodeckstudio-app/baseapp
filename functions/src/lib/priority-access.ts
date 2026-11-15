// Firestore side of the priority slot hold (rule itself is in priority-hold.ts).
import { HttpsError } from "firebase-functions/v2/https";
import type { Firestore } from "firebase-admin/firestore";
import type { Membership, StudioConfig } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { utcToLocalDate } from "./schedule.js";
import { hasPriorityMembership, heldStartTimes, isPriorityHeld } from "./priority-hold.js";

export async function customerHasPriority(db: Firestore, customerId: string, now: Date, timezone: string): Promise<boolean> {
  const snap = await db.collection(COLLECTIONS.memberships()).where("customerId", "==", customerId).where("status", "==", "active").get();
  return hasPriorityMembership(snap.docs.map((d) => d.data() as Membership), utcToLocalDate(now, timezone));
}

/** Customers without a priority slot cannot take a held start time before the hold ends. Staff are never blocked. */
export async function assertNotPriorityHeld(db: Firestore, p: { isCustomer: boolean; customerId: string; date: string; time: string; serviceDurationMinutes: number; config: StudioConfig; now: Date }): Promise<void> {
  if (!p.isCustomer) return;
  const held = heldStartTimes({ date: p.date, serviceDurationMinutes: p.serviceDurationMinutes, operatingHours: p.config.operatingHours, holidays: p.config.holidays, timezone: p.config.timezone });
  if (!isPriorityHeld({ date: p.date, startTime: p.time, held, now: p.now, timezone: p.config.timezone })) return;
  if (await customerHasPriority(db, p.customerId, p.now, p.config.timezone)) return;
  throw new HttpsError("failed-precondition", "That time is held for Platinum members until 6 PM the evening before. Please pick another time, or book after the hold ends.");
}
