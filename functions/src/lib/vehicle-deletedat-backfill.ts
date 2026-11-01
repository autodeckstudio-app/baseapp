/**
 * Legacy deletedAt normalization for /vehicles - LOCAL PROTOTYPE.
 *
 * Contract research: Vehicle.deletedAt is a REQUIRED "string | null" field and
 * every current creation path writes it explicitly. A document lacking the
 * field is a CANDIDATE only, never proof of an ordinary pre-field car: the
 * field may be absent because of a malformed write, an import, or a car that
 * was archived/deleted before the field existed. Writing deletedAt:null
 * RESTORES the owner's read access (firestore.rules fails closed on the
 * missing field), so normalization is an access grant and requires
 * independent evidence plus a reviewed manifest.
 *
 * Eligibility evidence (ALL required, else quarantine - never written):
 *   - tenantId and ownerId non-empty strings;
 *   - createdAt/updatedAt parseable date strings (basic provenance);
 *   - owner customer document EXISTS, same tenant, verifiably active
 *     (its own deletedAt field present and null);
 *   - lifecycle: NO tombstone in /deletedVehicles for this id.
 * Quarantined rows are reported with reasons for human review. The fail-
 * closed rules stay exactly as they are. NOTE: this evidence rubric is a
 * conservative LOCAL heuristic, not owner-approved restoration authority -
 * even an "eligible" row is only a recommendation for the reviewed manifest;
 * nothing here proves a vehicle was never archived, and approval to restore
 * access belongs to the owner row by row.
 *
 * Safety contract:
 *   - A scope is MANDATORY: tenantId and/or allowIds. An unscoped collection
 *     scan is refused. No live read happens without a grounded scope.
 *   - Scanning is paginated (bounded pages, startAfter).
 *   - A dry run emits an eligibility manifest + sha256 digest. Apply requires
 *     the digest of the REVIEWED manifest and refuses if current evidence no
 *     longer matches it, plus an attributable performedBy.
 *   - Each doc's outcome is returned per id (applied/skipped/failed) so a
 *     partial run is recoverable; a transaction reports ONLY its committed
 *     outcome (no outer mutable state survives a conflict retry).
 *   - Exactly one field is written (deletedAt:null); updatedAt, revision and
 *     every other field stay byte-identical; an auditLog entry is written in
 *     the SAME transaction.
 *
 * Neither a live dry run nor any apply has been authorized or run.
 */
import { createHash } from "node:crypto";
import type { Firestore } from "firebase-admin/firestore";
import { COLLECTIONS } from "@autodeck/database";

export interface QuarantinedVehicle { id: string; reason: string; }
export type VehicleBackfillOutcome = "applied" | "skipped-already-normalized" | "skipped-disappeared" | "skipped-no-longer-eligible" | "failed";
export interface VehicleBackfillResult {
  scanned: number;
  missing: string[];
  eligible: string[];
  quarantined: QuarantinedVehicle[];
  manifestDigest: string;
  outcomes: Record<string, VehicleBackfillOutcome>;
  errors: Record<string, string>;
  auditIds: string[];
}

export interface BackfillScope {
  tenantId?: string;
  allowIds?: string[];
  maxCount?: number;
  pageSize?: number;
}

export interface BackfillOptions extends BackfillScope {
  apply: boolean;
  performedBy?: string;
  now?: () => string;
  /** Required with apply: sha256 digest of the REVIEWED dry-run manifest. */
  manifestDigest?: string;
  /** TEST-ONLY hook: runs between the scan and the write for one doc. */
  beforeWrite?: (id: string) => Promise<void>;
}

const parseableDate = (v: unknown) => typeof v === "string" && !Number.isNaN(Date.parse(v));

export function manifestDigestOf(eligible: string[], quarantined: QuarantinedVehicle[]): string {
  const manifest = {
    eligible: [...eligible].sort(),
    quarantined: [...quarantined].sort((a, b) => a.id.localeCompare(b.id)),
  };
  return createHash("sha256").update(JSON.stringify(manifest)).digest("hex");
}

async function quarantineReason(db: Firestore, id: string, data: Record<string, unknown>): Promise<string | null> {
  if (typeof data.tenantId !== "string" || !data.tenantId) return "missing/invalid tenantId";
  if (typeof data.ownerId !== "string" || !data.ownerId) return "missing/invalid ownerId";
  if (!parseableDate(data.createdAt) || !parseableDate(data.updatedAt)) return "unparseable createdAt/updatedAt provenance";
  const tombstone = await db.collection(COLLECTIONS.deletedVehicles()).doc(id).get();
  if (tombstone.exists) return "lifecycle: a deletion tombstone exists for this id";
  const owner = await db.collection(COLLECTIONS.customers()).doc(data.ownerId).get();
  if (!owner.exists) return "owner customer document missing";
  const o = owner.data()!;
  if (o.tenantId !== data.tenantId) return "owner customer is in a different tenant";
  if (!("deletedAt" in o) || o.deletedAt !== null) return "owner not verifiably active (customer deletedAt missing or set)";
  return null;
}

export async function backfillVehicleDeletedAt(db: Firestore, opts: BackfillOptions): Promise<VehicleBackfillResult> {
  if (!opts.tenantId && (!opts.allowIds || opts.allowIds.length === 0)) {
    throw new Error("unscoped scan refused: pass tenantId and/or allowIds");
  }
  const col = db.collection(COLLECTIONS.vehicles());
  const pageSize = Math.max(1, Math.min(opts.pageSize ?? 200, 500));
  const maxCount = Math.max(1, opts.maxCount ?? 1000);

  // Bounded, paginated scan for missing-field candidates.
  const missingData = new Map<string, Record<string, unknown>>();
  if (opts.allowIds && opts.allowIds.length > 0) {
    for (const id of opts.allowIds.slice(0, maxCount)) {
      const doc = await col.doc(id).get();
      if (doc.exists && !("deletedAt" in doc.data()!)) missingData.set(id, doc.data()!);
    }
  } else {
    let q = col.where("tenantId", "==", opts.tenantId).orderBy("__name__").limit(pageSize);
    let scanned = 0;
    while (scanned < maxCount) {
      const page = await q.get();
      if (page.empty) break;
      for (const d of page.docs) {
        scanned += 1;
        if (!("deletedAt" in d.data())) missingData.set(d.id, d.data());
        if (scanned >= maxCount) break;
      }
      if (page.size < pageSize || scanned >= maxCount) break;
      q = col.where("tenantId", "==", opts.tenantId).orderBy("__name__").startAfter(page.docs[page.size - 1]!.id).limit(pageSize);
    }
  }
  const missing = [...missingData.keys()].sort();

  const result: VehicleBackfillResult = {
    scanned: missingData.size, missing, eligible: [], quarantined: [],
    manifestDigest: "", outcomes: {}, errors: {}, auditIds: [],
  };
  for (const id of missing) {
    const reason = await quarantineReason(db, id, missingData.get(id)!);
    if (reason === null) result.eligible.push(id);
    else result.quarantined.push({ id, reason });
  }
  result.manifestDigest = manifestDigestOf(result.eligible, result.quarantined);

  if (!opts.apply) return result;
  if (!opts.performedBy || !opts.performedBy.trim()) throw new Error("apply requires an attributable performedBy");
  if (!opts.manifestDigest || opts.manifestDigest !== result.manifestDigest) {
    throw new Error("apply refused: manifest digest mismatch - re-run the dry run and review the CURRENT manifest");
  }

  const now = (opts.now ?? (() => new Date().toISOString()))();
  for (const id of result.eligible) {
    const ref = col.doc(id);
    try {
      if (opts.beforeWrite) await opts.beforeWrite(id); // TEST-ONLY seam
      // The transaction returns ONLY its committed outcome: a conflict retry
      // that finds the field present returns the skip marker, so no stale
      // first-attempt state can be reported as applied.
      const outcome = await db.runTransaction(async (tx): Promise<{ kind: "applied"; auditId: string } | { kind: "skipped" } | { kind: "ineligible" }> => {
        const doc = await tx.get(ref);
        if (!doc.exists) return { kind: "skipped" };
        const data = doc.data()!;
        if ("deletedAt" in data) return { kind: "skipped" };
        // The reviewed manifest binds to the state at SCAN time; re-verify the
        // full eligibility evidence INSIDE the transaction so an owner
        // archived (or a tombstone written) between scan and write is caught.
        const tomb = await tx.get(db.collection(COLLECTIONS.deletedVehicles()).doc(id));
        if (tomb.exists) return { kind: "ineligible" };
        const ownerId = data.ownerId;
        if (typeof data.tenantId !== "string" || !data.tenantId || typeof ownerId !== "string" || !ownerId) return { kind: "ineligible" };
        if (!parseableDate(data.createdAt) || !parseableDate(data.updatedAt)) return { kind: "ineligible" };
        const owner = await tx.get(db.collection(COLLECTIONS.customers()).doc(ownerId));
        if (!owner.exists || owner.data()!.tenantId !== data.tenantId) return { kind: "ineligible" };
        const o = owner.data()!;
        if (!("deletedAt" in o) || o.deletedAt !== null) return { kind: "ineligible" };
        const auditRef = db.collection(COLLECTIONS.auditLog()).doc();
        tx.update(ref, { deletedAt: null });
        tx.set(auditRef, {
          id: auditRef.id,
          tenantId: typeof data.tenantId === "string" ? data.tenantId : null,
          studioId: null,
          action: "vehicle.legacy_deletedat_backfill",
          entityType: "Vehicle",
          entityId: id,
          performedBy: opts.performedBy,
          performedByRole: "migration",
          before: { deletedAt: "__missing__" },
          after: { deletedAt: null },
          createdAt: now,
        });
        return { kind: "applied", auditId: auditRef.id };
      });
      if (outcome.kind === "applied") {
        result.outcomes[id] = "applied";
        result.auditIds.push(outcome.auditId);
      } else if (outcome.kind === "ineligible") {
        result.outcomes[id] = "skipped-no-longer-eligible";
      } else {
        const after = await ref.get();
        result.outcomes[id] = after.exists ? "skipped-already-normalized" : "skipped-disappeared";
      }
    } catch (e) {
      result.outcomes[id] = "failed";
      result.errors[id] = e instanceof Error ? e.message : String(e);
    }
  }
  return result;
}
