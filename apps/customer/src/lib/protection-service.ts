import { collection, query, where, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "./firebase";
import { SUBCOLLECTIONS } from "@autodeck/database";
import type { Protection } from "@autodeck/core";

export function listenToVehicleProtections(
  vehicleId: string,
  tenantId: string,
  customerId: string,
  onData: (protections: Protection[]) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, SUBCOLLECTIONS.vehicleProtections(vehicleId)),
    where("tenantId", "==", tenantId),
    where("customerId", "==", customerId),
  );
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => d.data() as Protection)),
    onError,
  );
}

/**
 * True when v is a real calendar date in YYYY-MM-DD. The regex alone accepts
 * impossible dates (2026-02-30); roundtrip through UTC rejects them. Shared
 * by Add-car and the car-detail edit form so inline feedback matches the
 * server schema.
 */
export function isCalendarDate(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y = 0, m = 0, d = 0] = v.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export type MyProtectionKind = "ppf" | "ceramic";

export type CreateMyProtectionInput = {
  vehicleId: string;
  kind: MyProtectionKind;
  /** Stable client-generated identity; retries reuse it and never duplicate. */
  declarationId: string;
  provider?: string;
  warrantyYears?: number;
  startDate?: string; // YYYY-MM-DD
  notes?: string;
};

export type UpdateMyProtectionInput = {
  vehicleId: string;
  protectionId: string;
  /** Monotonic revision the edit is based on (server rejects a stale base
   *  truthfully). null is the explicit repair election for a legacy record
   *  with no revision yet - send only after re-reading the latest record. */
  expectedRevision: number | null;
  /** Required with expectedRevision null (legacy repair election): the
   *  updatedAt of the record actually edited from. The server checks it
   *  against the stored record in-transaction; a mismatch fails closed
   *  instead of normalizing over unseen changes. */
  legacyBaseUpdatedAt?: string | null;
  provider?: string | null;
  warrantyYears?: number | null;
  startDate?: string | null;
  notes?: string | null;
};

export async function createMyProtection(input: CreateMyProtectionInput): Promise<Protection> {
  const fn = httpsCallable<CreateMyProtectionInput, { protection: Protection }>(functions, "createMyProtection");
  const result = await fn(input);
  return result.data.protection;
}

export async function updateMyProtection(input: UpdateMyProtectionInput): Promise<void> {
  const fn = httpsCallable<UpdateMyProtectionInput, { protectionId: string }>(functions, "updateMyProtection");
  await fn(input);
}
