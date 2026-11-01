import type { Protection } from "@autodeck/core";

/**
 * Read-back reconciliation after a protection save fails with an unknown or
 * conflict outcome. The listener may be offline or behind, so the client
 * fetches the record from the server and reconciles it here before claiming
 * anything about "latest".
 *
 * Identity comes from the DOCUMENT PATH the client asked for (targetId /
 * vehicleId), never from snap.data(): a legacy record may predate the stored
 * id field, and a stored field that disagrees with the path is a corrupt
 * binding that must fail closed, never display.
 */
export type ProtectionReadback =
  | { kind: "applied"; protection: Protection }
  /** The server no longer has the record - not an offline condition. */
  | { kind: "removed" }
  /** Stored identity contradicts the document path - fail closed. */
  | { kind: "corrupt" }
  /** The fetch itself failed (offline etc.) - nothing is confirmed. */
  | { kind: "unconfirmed" }
  /** A newer attempt or a different target superseded this response. */
  | { kind: "stale" };

export function reconcileProtectionReadback(args: {
  exists: boolean;
  data: Record<string, unknown> | undefined;
  snapId: string;
  targetId: string;
  vehicleId: string;
  customerId: string;
  tenantId: string;
  generation: number;
  currentGeneration: number;
}): ProtectionReadback {
  if (args.generation !== args.currentGeneration) return { kind: "stale" };
  if (args.snapId !== args.targetId) return { kind: "corrupt" };
  if (!args.exists || !args.data) return { kind: "removed" };
  const d = args.data;
  // Stored identity present and disagreeing with the path fails closed;
  // absent (legacy) is normalized from the path below.
  if (d.id !== undefined && d.id !== args.targetId) return { kind: "corrupt" };
  if (d.vehicleId !== undefined && d.vehicleId !== args.vehicleId) return { kind: "corrupt" };
  if (d.customerId !== args.customerId || d.tenantId !== args.tenantId) return { kind: "corrupt" };
  const protection = { ...d, id: (d.id as string | undefined) ?? args.snapId, vehicleId: (d.vehicleId as string | undefined) ?? args.vehicleId } as Protection;
  return { kind: "applied", protection };
}

/** Newness: an explicit numeric revision is authoritative and ALWAYS beats a
 *  legacy unversioned copy (a versioned write happened after versioning
 *  existed). Two legacy copies compare by the ISO updatedAt string. */
function strictlyNewer(a: Protection, b: Protection): boolean {
  const ra = (a as { revision?: number }).revision ?? null;
  const rb = (b as { revision?: number }).revision ?? null;
  if (ra != null && rb != null) return ra > rb;
  if (ra != null) return true;
  if (rb != null) return false;
  return (a.updatedAt ?? "") > (b.updatedAt ?? "");
}

/** Upsert by the captured target identity, monotonically: a read-back that
 *  is OLDER than what the listener already delivered never overwrites the
 *  newer copy. Replace in place, append when the listener has not delivered
 *  the record yet. */
export function upsertProtection(prev: Protection[], targetId: string, next: Protection): Protection[] {
  const i = prev.findIndex((p) => p.id === targetId);
  if (i < 0) return [...prev, next];
  if (strictlyNewer(prev[i]!, next)) return prev;
  const out = prev.slice();
  out[i] = next;
  return out;
}
