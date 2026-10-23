import { HttpsError } from "firebase-functions/v2/https";
import type { Firestore } from "firebase-admin/firestore";
import type { PaperVerification } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";

/** Comparison key for a document number: case-insensitive, spaces ignored. */
export function paperNumberKey(reference: string): string {
  return reference.replace(/\s+/g, "").toUpperCase();
}

/** A paper that counts: not replaced by a newer RC. */
export function isActivePaper(p: Pick<PaperVerification, "supersededAt">): boolean {
  return !p.supersededAt;
}

/**
 * Round 7 point 6: a number already saved on any of this customer's documents (any car, any kind) is refused.
 * `exceptPaperId` lets a paper be edited without flagging itself.
 */
export async function assertNumberUnused(db: Firestore, o: { tenantId: string; customerId: string; reference: string; exceptPaperId?: string }): Promise<void> {
  const key = paperNumberKey(o.reference);
  const snap = await db.collection(COLLECTIONS.papers()).where("customerId", "==", o.customerId).where("tenantId", "==", o.tenantId).get();
  const clash = snap.docs.map((d) => d.data() as PaperVerification).find((p) => p.id !== o.exceptPaperId && isActivePaper(p) && paperNumberKey(p.reference ?? "") === key);
  if (clash) throw new HttpsError("already-exists", "This document number is already saved on one of your documents.");
}

// ---- Race-proof uniqueness (round 7) -------------------------------------------------------
// The query check above finds older papers that have no lock yet. The lock documents below make two
// concurrent writes for the same number (or the same car's RC) collide inside a transaction, so
// uniqueness never rests on a read-then-write gap. Locks are function-only (rules default deny).
import type { Transaction, DocumentReference } from "firebase-admin/firestore";

export const PAPER_LOCKS = "paperLocks";

export function numberLockId(tenantId: string, customerId: string, reference: string): string {
  return `num__${tenantId}__${customerId}__${encodeURIComponent(paperNumberKey(reference))}`;
}
export function rcLockId(vehicleId: string): string {
  return `rc__${vehicleId}`;
}

type LockDoc = { paperId: string; kind: "number" | "rc" };

/** A lock still counts only if the paper it points at still exists, is not replaced, and (for numbers) still carries that number. */
async function lockIsLive(tx: Transaction, db: Firestore, lock: LockDoc, test: (p: PaperVerification) => boolean): Promise<boolean> {
  const snap = await tx.get(db.collection(COLLECTIONS.papers()).doc(lock.paperId));
  if (!snap.exists) return false;
  const p = snap.data() as PaperVerification;
  return isActivePaper(p) && test(p);
}

export type Claim = { ref: DocumentReference; data: LockDoc };

/** Read phase (call before any write in the transaction). Throws when the number or RC is already held by a live paper other than `paperId`. Returns the locks to write. */
export async function readClaims(tx: Transaction, db: Firestore, o: { tenantId: string; customerId: string; vehicleId: string; paperId: string; reference: string; kind: string; claimRc: boolean }): Promise<Claim[]> {
  const claims: Claim[] = [];
  const numRef = db.collection(PAPER_LOCKS).doc(numberLockId(o.tenantId, o.customerId, o.reference));
  const numSnap = await tx.get(numRef);
  if (numSnap.exists) {
    const l = numSnap.data() as LockDoc;
    if (l.paperId !== o.paperId && (await lockIsLive(tx, db, l, (p) => paperNumberKey(p.reference ?? "") === paperNumberKey(o.reference)))) {
      throw new HttpsError("already-exists", "This document number is already saved on one of your documents.");
    }
  }
  claims.push({ ref: numRef, data: { paperId: o.paperId, kind: "number" } });
  if (o.claimRc) {
    const rcRef = db.collection(PAPER_LOCKS).doc(rcLockId(o.vehicleId));
    const rcSnap = await tx.get(rcRef);
    if (rcSnap.exists) {
      const l = rcSnap.data() as LockDoc;
      if (l.paperId !== o.paperId && (await lockIsLive(tx, db, l, (p) => p.kind === "RC"))) {
        throw new HttpsError("already-exists", "This car already has an RC. Edit it to replace it.");
      }
    }
    claims.push({ ref: rcRef, data: { paperId: o.paperId, kind: "rc" } });
  }
  return claims;
}
