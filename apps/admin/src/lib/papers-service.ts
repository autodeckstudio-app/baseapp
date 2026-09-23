"use client";

import { collection, getDocs, limit, onSnapshot, query, where, type Unsubscribe } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import type { PaperKind, PaperVerification, Vehicle } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { db, functions } from "./firebase";

/** Live papers feed for one studio, optionally one status bucket. */
export function listenToPapers(
  tenantId: string,
  studioId: string,
  status: "PENDING" | "VERIFIED" | "REJECTED" | null,
  onData: (papers: PaperVerification[]) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const base = [
    where("tenantId", "==", tenantId),
    where("studioId", "==", studioId),
    ...(status ? [where("status", "==", status)] : []),
  ];
  const q = query(collection(db, COLLECTIONS.papers()), ...base);
  return onSnapshot(
    q,
    (snap) =>
      onData(
        snap.docs
          .map((d) => d.data() as PaperVerification)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .slice(0, 200),
      ),
    onError,
  );
}

/** Plate lookup so staff never type a document id. */
export async function findVehicleByPlate(
  tenantId: string,
  registrationNumber: string,
): Promise<Vehicle | null> {
  const q = query(
    collection(db, COLLECTIONS.vehicles()),
    where("tenantId", "==", tenantId),
    where("registrationNumber", "==", registrationNumber.trim().toUpperCase()),
    limit(1),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return snap.docs[0]!.data() as Vehicle;
}

export async function submitPaper(input: {
  studioId: string;
  vehicleId: string;
  kind: PaperKind;
  reference: string;
  issuedOn?: string;
  expiresOn?: string;
  notes?: string;
}): Promise<{ id: string }> {
  const fn = httpsCallable<typeof input, { id: string }>(functions, "submitPaper");
  return (await fn(input)).data;
}

export async function reviewPaper(input: {
  paperId: string;
  decision: "VERIFIED" | "REJECTED";
  rejectionReason?: string;
}): Promise<{ id: string }> {
  const fn = httpsCallable<typeof input, { id: string }>(functions, "reviewPaper");
  return (await fn(input)).data;
}
