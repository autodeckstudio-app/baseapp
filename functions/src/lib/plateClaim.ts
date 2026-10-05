import type { Firestore, Transaction } from "firebase-admin/firestore";
import { COLLECTIONS } from "@autodeck/database";

/**
 * One claim document per tenant + owner + plate. Reading the claim inside a
 * transaction makes two simultaneous creates for the same plate conflict, which a
 * query cannot do. A claim only counts while the car it points at is live and still
 * has that plate, so a stale claim never blocks a customer.
 */
export function plateClaimId(tenantId: string, ownerId: string, plate: string): string {
  return `${tenantId}__${ownerId}__${plate}`;
}

export function plateClaimRef(db: Firestore, tenantId: string, ownerId: string, plate: string) {
  return db.collection(COLLECTIONS.vehiclePlateClaims()).doc(plateClaimId(tenantId, ownerId, plate));
}

type ClaimData = { vehicleId?: string | null } | undefined;
type VehicleData = { deletedAt?: string | null; registrationNumber?: string } | undefined;

/** True when a live car other than selfId currently holds this plate claim. Reads only. */
export async function claimIsHeldByOther(
  db: Firestore,
  tx: Transaction,
  tenantId: string,
  ownerId: string,
  plate: string,
  selfId: string | null,
): Promise<boolean> {
  const claimSnap = await tx.get(plateClaimRef(db, tenantId, ownerId, plate));
  if (!claimSnap.exists) return false;
  const holder = (claimSnap.data() as ClaimData)?.vehicleId ?? null;
  if (!holder || holder === selfId) return false;
  const vSnap = await tx.get(db.collection(COLLECTIONS.vehicles()).doc(holder));
  if (!vSnap.exists) return false;
  const v = vSnap.data() as VehicleData;
  return v?.deletedAt === null && v?.registrationNumber === plate;
}

export function writeClaim(
  db: Firestore,
  tx: Transaction,
  tenantId: string,
  ownerId: string,
  plate: string,
  vehicleId: string,
  now: string,
): void {
  tx.set(plateClaimRef(db, tenantId, ownerId, plate), { tenantId, ownerId, plate, vehicleId, updatedAt: now });
}

/** Marks a claim as no longer held. Only touches it if this car holds it. */
export async function releaseClaim(
  db: Firestore,
  tx: Transaction,
  claimSnapData: ClaimData,
  tenantId: string,
  ownerId: string,
  plate: string,
  vehicleId: string,
  now: string,
): Promise<void> {
  if (claimSnapData?.vehicleId !== vehicleId) return;
  tx.set(plateClaimRef(db, tenantId, ownerId, plate), { tenantId, ownerId, plate, vehicleId: null, updatedAt: now });
}
