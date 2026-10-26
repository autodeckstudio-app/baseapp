// Shared abuse limiter for guest shop endpoints. The count lives in a
// Firestore doc (shopRateLimits), one transaction per hit, so separate
// function instances share one count — an in-memory limiter resets per
// instance and lets bursts through. Keys are SHA-256 hashed: raw IPs and
// client keys are never stored.
import { createHash } from "node:crypto";
import type { Firestore } from "firebase-admin/firestore";
import { COLLECTIONS } from "@autodeck/database";

export interface LimiterRule { limit: number; windowMs: number }

export function limiterKey(scope: string, rawId: string): string {
  return createHash("sha256").update(`${scope}:${rawId}`).digest("hex").slice(0, 40);
}

/**
 * Counts one hit and returns whether it is within the rule. The window doc is
 * shopRateLimits/{hashedKey}; a new window starts fresh. Runs before any
 * catalogue read, so abuse never reaches the data.
 */
export async function hitLimiter(
  db: Firestore,
  i: { scope: string; rawId: string; rule: LimiterRule; nowMs?: number },
): Promise<{ allowed: boolean; retryAfterMs: number }> {
  const now = i.nowMs ?? Date.now();
  const ref = db.collection(COLLECTIONS.shopRateLimits()).doc(limiterKey(i.scope, i.rawId));
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const rec = snap.exists ? (snap.data() as { windowStart: number; count: number }) : null;
    const fresh = !rec || now - rec.windowStart >= i.rule.windowMs;
    const count = fresh ? 1 : rec!.count + 1;
    tx.set(ref, { windowStart: fresh ? now : rec!.windowStart, count, updatedAt: new Date(now).toISOString() });
    if (count > i.rule.limit) {
      return { allowed: false, retryAfterMs: (fresh ? now : rec!.windowStart) + i.rule.windowMs - now };
    }
    return { allowed: true, retryAfterMs: 0 };
  });
}
