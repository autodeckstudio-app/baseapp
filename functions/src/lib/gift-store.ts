// Gift storage rules shared by the callables and booking. Every state change is inside a transaction.
import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { createHash } from "node:crypto";
import type { Firestore, Transaction } from "firebase-admin/firestore";
import { giftLockedUntil, giftState, GIFT_LOCK_MINUTES, GIFT_MAX_FAILED_ATTEMPTS, type Gift } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";

interface AttemptDoc { failedAt: string[] }

/** The keys a redemption attempt is counted against: the account and the network address. */
export function attemptKeys(uid: string, request: CallableRequest): string[] {
  const ip = request.rawRequest?.ip ?? "";
  const keys = [`uid-${uid}`];
  if (ip) keys.push(`ip-${createHash("sha256").update(ip).digest("hex").slice(0, 24)}`);
  return keys;
}

export async function assertNotLocked(db: Firestore, keys: string[], now: number): Promise<void> {
  for (const k of keys) {
    const snap = await db.collection(COLLECTIONS.giftAttempts()).doc(k).get();
    const until = giftLockedUntil(snap.exists ? (snap.data() as AttemptDoc).failedAt : [], now);
    if (until !== null) {
      const mins = Math.max(1, Math.ceil((until - now) / 60_000));
      throw new HttpsError("resource-exhausted", `Too many wrong codes. Try again in ${mins} minute${mins === 1 ? "" : "s"}.`);
    }
  }
}

/** Records a wrong code against every key. Keeps only the entries inside the lock window. */
export async function recordFailure(db: Firestore, keys: string[], now: number): Promise<void> {
  const windowMs = GIFT_LOCK_MINUTES * 60_000;
  for (const k of keys) {
    const ref = db.collection(COLLECTIONS.giftAttempts()).doc(k);
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const old = snap.exists ? (snap.data() as AttemptDoc).failedAt : [];
      const kept = old.filter((t) => now - Date.parse(t) < windowMs).slice(-(GIFT_MAX_FAILED_ATTEMPTS - 1));
      tx.set(ref, { failedAt: [...kept, new Date(now).toISOString()], updatedAt: new Date(now).toISOString() });
    });
  }
}

/** Why a gift cannot be used, as a plain message. Null when it can be. Never says which part of a code was wrong. */
export function giftBlockReason(g: Gift, uid: string, now: number): string | null {
  const st = giftState(g, now);
  if (st === "expired") return "This gift has expired.";
  if (st === "redeemed") return "This gift has already been used.";
  if (st === "void" || st === "refunded") return "This gift is no longer valid.";
  if (st === "pending") return "This gift is not active yet.";
  if (g.claimedBy && g.claimedBy !== uid) return "This gift has already been claimed.";
  return null;
}

export async function findGiftByHash(tx: Transaction, db: Firestore, hash: string) {
  const q = await tx.get(db.collection(COLLECTIONS.gifts()).where("codeHash", "==", hash).limit(1));
  return q.empty ? null : q.docs[0]!;
}
