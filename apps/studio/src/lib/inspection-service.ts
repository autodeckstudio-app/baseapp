import { httpsCallable } from "firebase/functions";
import { doc, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { db, functions } from "./firebase";
import { COLLECTIONS } from "@autodeck/database";
import type { Inspection, InspectionRating } from "@autodeck/core";

// Doc ID == jobId — direct get, no query needed (same pattern as warranties).
export function listenToInspection(
  jobId: string,
  onData: (inspection: Inspection | null) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, COLLECTIONS.inspections(), jobId),
    (snap) => onData(snap.exists() ? (snap.data() as Inspection) : null),
    onError,
  );
}

type StartInspectionOutput = { inspection: Inspection };

export async function startInspection(jobId: string): Promise<Inspection> {
  const fn = httpsCallable<{ jobId: string }, StartInspectionOutput>(functions, "startInspection");
  const result = await fn({ jobId });
  return result.data.inspection;
}

type UpdateInspectionInput = {
  jobId: string;
  items?: Array<{ key: string; rating?: InspectionRating | null; notes?: string | null }>;
  overallNotes?: string | null;
};

export async function updateInspection(input: UpdateInspectionInput): Promise<void> {
  const fn = httpsCallable(functions, "updateInspection");
  await fn(input);
}

type FinalizeInspectionOutput = { jobId: string; alreadyFinalized: boolean };

export async function finalizeInspection(jobId: string): Promise<FinalizeInspectionOutput> {
  const fn = httpsCallable<{ jobId: string }, FinalizeInspectionOutput>(functions, "finalizeInspection");
  const result = await fn({ jobId });
  return result.data;
}
