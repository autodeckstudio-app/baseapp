"use client";

import { httpsCallable } from "firebase/functions";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db, functions } from "./firebase";
import { COLLECTIONS, SUBCOLLECTIONS } from "@autodeck/database";
import type { Vehicle, Protection, ProtectionKind, ProtectionStatus } from "@autodeck/core";

export async function findVehicleByRegistration(
  tenantId: string,
  registrationNumber: string,
): Promise<Vehicle | null> {
  const q = query(
    collection(db, COLLECTIONS.vehicles()),
    where("tenantId", "==", tenantId),
    where("registrationNumber", "==", registrationNumber.toUpperCase()),
  );
  const snap = await getDocs(q);
  const first = snap.docs[0];
  return first ? (first.data() as Vehicle) : null;
}

export async function getVehicleProtections(vehicleId: string): Promise<Protection[]> {
  const snap = await getDocs(collection(db, SUBCOLLECTIONS.vehicleProtections(vehicleId)));
  return snap.docs.map((d) => d.data() as Protection);
}

export interface CreateProtectionInput {
  vehicleId: string;
  kind: ProtectionKind;
  provider?: string | undefined;
  policyNumber?: string | undefined;
  startDate?: string | undefined;
  expiryDate?: string | undefined;
  notes?: string | undefined;
}

export async function createProtection(input: CreateProtectionInput): Promise<Protection> {
  const fn = httpsCallable<CreateProtectionInput, { protection: Protection }>(functions, "createProtection");
  const result = await fn(input);
  return result.data.protection;
}

export interface UpdateProtectionInput {
  vehicleId: string;
  protectionId: string;
  provider?: string | undefined;
  policyNumber?: string | undefined;
  startDate?: string | undefined;
  expiryDate?: string | undefined;
  notes?: string | undefined;
  status?: ProtectionStatus | undefined;
}

export async function updateProtection(input: UpdateProtectionInput): Promise<void> {
  const fn = httpsCallable(functions, "updateProtection");
  await fn(input);
}
