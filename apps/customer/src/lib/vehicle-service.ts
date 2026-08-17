import {
  collection,
  query,
  where,
  onSnapshot,
  type Unsubscribe,
  type QuerySnapshot,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "./firebase";
import { COLLECTIONS } from "@autodeck/database";
import type { Vehicle } from "@autodeck/core";

type CreateVehicleInput = {
  registrationNumber: string;
  make: string;
  model: string;
  year: number;
  color: string;
};

type UpdateVehicleInput = {
  vehicleId: string;
  registrationNumber?: string;
  make?: string;
  model?: string;
  year?: number;
  color?: string;
  odometer?: number;
};

export async function createVehicle(input: CreateVehicleInput): Promise<Vehicle> {
  const fn = httpsCallable<CreateVehicleInput, { vehicle: Vehicle }>(
    functions,
    "createVehicle",
  );
  const result = await fn(input);
  return result.data.vehicle;
}

export async function updateVehicle(input: UpdateVehicleInput): Promise<void> {
  const fn = httpsCallable<UpdateVehicleInput, { vehicleId: string }>(
    functions,
    "updateVehicle",
  );
  await fn(input);
}

export async function archiveVehicle(vehicleId: string): Promise<void> {
  const fn = httpsCallable<{ vehicleId: string }, { vehicleId: string; archived: boolean }>(
    functions,
    "archiveVehicle",
  );
  await fn({ vehicleId });
}

/**
 * Real-time listener for the authenticated customer's vehicles.
 * Only returns non-archived vehicles (deletedAt == null).
 * Firestore rules enforce that customers can only read their own vehicles.
 */
export function listenToMyVehicles(
  uid: string,
  tenantId: string,
  onData: (vehicles: Vehicle[]) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, COLLECTIONS.vehicles()),
    where("ownerId", "==", uid),
    where("tenantId", "==", tenantId),
    where("deletedAt", "==", null),
  );

  return onSnapshot(
    q,
    (snap: QuerySnapshot) => {
      const vehicles = snap.docs.map((doc) => doc.data() as Vehicle);
      onData(vehicles);
    },
    onError,
  );
}
