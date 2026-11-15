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

/** What to tell staff when the inspection screen cannot read its document. Firestore reports a never-started inspection (no
 *  document) as permission-denied, but permission-denied can also mean the account may not open it, so the text does not claim
 *  which. Only that code, or the rules' explicit "Null value error", is rewritten; every other error (device, network) keeps its
 *  own message. Message only: nothing is started or changed, and the rules are untouched. */
export function inspectionLoadMessage(err: { code?: string; message?: string }): string {
  if (err.code === "permission-denied" || /Null value error/.test(err.message ?? "")) {
    return "This inspection could not be opened. It may not have been started yet, or your account may not have access. Go back to the job to start or check it, or ask an admin.";
  }
  return err.message || "Could not load the inspection.";
}
