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
import type { Vehicle, VehicleCategory } from "@autodeck/core";

type CreateVehicleInput = {
  registrationNumber: string;
  make: string;
  model: string;
  year: number;
  color: string;
  category: VehicleCategory;
  archivedChoice?: "new";
};

type UpdateVehicleInput = {
  vehicleId: string;
  registrationNumber?: string;
  make?: string;
  model?: string;
  year?: number;
  color?: string;
  category?: VehicleCategory;
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
    { includeMetadataChanges: true },
    (snap: QuerySnapshot) => {
      // Deliver cached snapshots too: a freshly added or restored car must
      // appear immediately, and the listener reconciles with the server next.
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
  try {
    // Stamps the download token the apps need and points the car at the new file.
    await httpsCallable<{ vehicleId: string; path: string; publish: boolean }, { url: string }>(functions, "publishVehiclePhoto")({ vehicleId, path, publish: true });
  } catch {
    await updateVehicle({ vehicleId, photoUrl: path });
  }
  return path;
}

/** Resolves a stored vehicle photo path to a renderable URL (rules-gated read). */
export async function resolveVehiclePhotoUrl(path: string, version?: string | null): Promise<string> {
  let url: string;
  try {
    url = await getDownloadURL(storageRef(storage, path));
  } catch {
    // Photos uploaded through the signed URL have no download token yet; the
    // backend adds one and hands back a working URL.
    const vehicleId = path.split("/")[2] ?? "";
    url = (await httpsCallable<{ vehicleId: string; path: string }, { url: string }>(functions, "publishVehiclePhoto")({ vehicleId, path })).data.url;
  }
  // A replaced photo keeps the same storage path (cover.<ext>), so the URL alone never changes.
  // The vehicle's updatedAt busts browser and image caches so every screen shows the new picture.
  return version ? `${url}${url.includes("?") ? "&" : "?"}v=${encodeURIComponent(version)}` : url;
}

export function normalizePlate(value: string): string {
  return value.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

/** Registration alone identifies a car, including archived cars and old plate formatting. */
export async function findVehicleWithPlate(uid: string, tenantId: string, plate: string): Promise<Vehicle | null> {
  const snap = await getDocs(query(collection(db, COLLECTIONS.vehicles()), where("ownerId", "==", uid), where("tenantId", "==", tenantId)));
  const target = normalizePlate(plate);
  const matches = snap.docs.map((d) => ({ ...d.data(), id: d.id }) as Vehicle).filter((v) => normalizePlate(v.registrationNumber ?? "") === target);
  return matches.find((v) => !v.deletedAt) ?? matches[0] ?? null;
}

export async function restoreVehicle(vehicleId: string): Promise<void> {
  const fn = httpsCallable<{ vehicleId: string }, { vehicleId: string; restored: boolean }>(functions, "restoreVehicle");
  await fn({ vehicleId });
}

