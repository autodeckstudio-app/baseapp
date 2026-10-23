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
