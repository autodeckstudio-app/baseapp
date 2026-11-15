import { getFirestore } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import { COLLECTIONS } from "@autodeck/database";

/**
 * Superseded-photo reap queue.
 *
 * Every transactional field move off a photo path enqueues the previous path here
 * (same transaction), so a superseded object is always recorded before it loses
 * its last reference. Entries are removed ONLY after a successful delete
 * (ignoreNotFound counts as success); failed entries are retained and retried by
 * the next drain. Nothing is ever silently dropped.
 */

export const REAP_QUEUE_CAP = 25;          // hard bound per vehicle (fail closed at cap)
export const REAP_DRAIN_ATTEMPTS = 10;     // max delete attempts per invocation (bounds runtime)
export const REAP_ENTRY_ATTEMPT_CAP = 10;  // beyond this: retained, structured ops log, no auto-retry

export interface ReapEntry {
  path: string;
  kind: "cover" | "rc";
  enqueuedAt: string;
  attempts: number;
  lastError: string | null;
}

/** Own-path validation: must live directly under this vehicle's prefix
 * (`<tenantId>/vehicles/<vehicleId>/<name>`), no traversal, full URLs rejected. */
export function isOwnPhotoPath(path: unknown, tenantId: string, vehicleId: string): path is string {
  const prefix = `${tenantId}/vehicles/${vehicleId}/`;
  if (typeof path !== "string" || !path.startsWith(prefix)) return false;
  const name = path.slice(prefix.length);
  return /^[\w.-]+$/.test(name) && !name.includes("..");
}

export function readQueue(vehicle: Record<string, unknown>): ReapEntry[] {
  const q = vehicle["photoReapQueue"];
  if (!Array.isArray(q)) return [];
  return q.filter(
    (e): e is ReapEntry =>
      !!e && typeof e === "object" && typeof (e as ReapEntry).path === "string" &&
      typeof (e as ReapEntry).attempts === "number",
  );
}

/** Append to the queue inside a transaction. Throws failed-precondition when the hard cap is reached. */
export function enqueueReap(
  queue: ReapEntry[],
  path: string,
  kind: "cover" | "rc",
): ReapEntry[] {
  if (queue.some((e) => e.path === path)) return queue; // already tracked
  if (queue.length >= REAP_QUEUE_CAP) {
    throw new HttpsError("failed-precondition", "photo-cleanup-backlog, try again");
  }
  return [...queue, { path, kind, enqueuedAt: new Date().toISOString(), attempts: 0, lastError: null }];
}

/**
 * Drain this vehicle's reap queue: oldest first, at most REAP_DRAIN_ATTEMPTS delete
 * attempts. Entries deleted (or already gone) are removed; failed entries stay with
 * attempts+1. The write-back merges against a fresh read so concurrently enqueued
 * entries are never lost.
 */
export async function drainVehiclePhotoReap(
  vehicleId: string,
  bucket: { file: (p: string) => { delete: (o: { ignoreNotFound: boolean }) => Promise<unknown> } },
  maxAttempts: number = REAP_DRAIN_ATTEMPTS,
  skipPaths?: ReadonlySet<string>,
): Promise<{ attempts: number; failedPaths: Set<string> }> {
  const db = getFirestore();
  const ref = db.collection(COLLECTIONS.vehicles()).doc(vehicleId);
  const snap = await ref.get();
  if (!snap.exists) return { attempts: 0, failedPaths: new Set() };
  const queue = readQueue(snap.data() as Record<string, unknown>);
  if (queue.length === 0) return { attempts: 0, failedPaths: new Set() };

  const deleted = new Set<string>();
  const failed = new Map<string, string>();
  let attempts = 0;
  for (const entry of queue) {
    if (attempts >= maxAttempts) break;
    if (skipPaths?.has(entry.path)) continue; // already attempted this invocation
    if (entry.attempts >= REAP_ENTRY_ATTEMPT_CAP) continue; // retained, no auto-retry
    attempts++;
    try {
      await bucket.file(entry.path).delete({ ignoreNotFound: true });
      deleted.add(entry.path);
    } catch (err) {
      failed.set(entry.path, err instanceof Error ? err.message : String(err));
    }
  }

  const keptPaths = new Set<string>();
  const updated = new Map<string, { attempts: number; lastError: string | null }>();
  for (const entry of queue) {
    if (deleted.has(entry.path)) continue;
    keptPaths.add(entry.path);
    const f = failed.get(entry.path);
    if (f !== undefined) updated.set(entry.path, { attempts: entry.attempts + 1, lastError: f });
  }
  if (deleted.size === 0 && updated.size === 0) return { attempts, failedPaths: new Set(failed.keys()) };

  // Merge write-back: remove only what THIS drain deleted, bump only what THIS drain
  // failed; entries enqueued concurrently (after our read) survive untouched.
  await db.runTransaction(async (tx) => {
    const fresh = await tx.get(ref);
    if (!fresh.exists) return;
    const current = readQueue(fresh.data() as Record<string, unknown>);
    const next = current
      .filter((e) => !deleted.has(e.path))
      .map((e) => {
        const u = updated.get(e.path);
        return u ? { ...e, attempts: u.attempts, lastError: u.lastError } : e;
      });
    tx.update(ref, { photoReapQueue: next });
  });
  for (const [path, msg] of failed) {
    logger.warn("vehicle photo reap failed; entry retained for retry", { vehicleId, path, error: msg });
  }
  for (const entry of queue) {
    if (!deleted.has(entry.path) && entry.attempts >= REAP_ENTRY_ATTEMPT_CAP) {
      logger.error("vehicle photo reap entry exceeded attempt cap; retained, manual cleanup needed", {
        vehicleId, path: entry.path, attempts: entry.attempts,
      });
    }
  }
  return { attempts, failedPaths: new Set(failed.keys()) };
}
