import {
  collection,
  query,
  where,
  onSnapshot,
  getDocs,
  type Unsubscribe,
  type QuerySnapshot,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { getDownloadURL, ref as storageRef } from "firebase/storage";
import { db, functions, storage } from "./firebase";
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
  photoUrl?: string | null;
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

/**
 * Uploads a cover photo for a vehicle the customer owns, end to end:
 * callable-issued signed PUT URL (object metadata ownerId is stamped by the
 * signature), direct upload to Storage, then photoUrl on the vehicle doc.
 * Returns the storage object path.
 */
export async function uploadVehiclePhoto(vehicleId: string, blob: Blob, contentType: string): Promise<string> {
  const fn = httpsCallable<
    { vehicleId: string; contentType: string },
    { uploadUrl: string; path: string; requiredHeaders: Record<string, string> }
  >(functions, "issueVehiclePhotoUploadUrl");
  const { uploadUrl, path, requiredHeaders } = (await fn({ vehicleId, contentType })).data;
  const res = await fetch(uploadUrl, { method: "PUT", headers: requiredHeaders, body: blob });
  if (!res.ok) throw new Error(`Photo upload failed (${res.status}).`);
  await updateVehicle({ vehicleId, photoUrl: path });
  return path;
}

/** Resolves a stored vehicle photo path to a renderable URL (rules-gated read). */
export async function resolveVehiclePhotoUrl(path: string): Promise<string> {
  return getDownloadURL(storageRef(storage, path));
}

export function normalizePlate(value: string): string {
  return value.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

/** True when this customer already has a saved car with the same plate (spaces and case ignored). */
export async function hasVehicleWithPlate(uid: string, tenantId: string, plate: string): Promise<boolean> {
  const snap = await getDocs(
    query(
      collection(db, COLLECTIONS.vehicles()),
      where("ownerId", "==", uid),
      where("tenantId", "==", tenantId),
      where("deletedAt", "==", null),
    ),
  );
  const target = normalizePlate(plate);
  return snap.docs.some((d) => normalizePlate(String((d.data() as Vehicle).registrationNumber ?? "")) === target);
}
