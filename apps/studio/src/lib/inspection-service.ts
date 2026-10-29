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

/** What to tell staff when the inspection screen cannot read its document. A job whose inspection was never started has
 *  no document, and Firestore reports that read as permission-denied (the rules read the document's own fields).
 *  Message only: nothing is started or changed, and the rules are untouched. */
export function inspectionLoadMessage(err: { code?: string; message?: string }): string {
  if (err.code === "permission-denied" || /permission|Null value error/i.test(err.message ?? "")) {
    return "This inspection has not been started yet, or you cannot open it. Go back to the job and tap Start inspection.";
  }
  return err.message || "Could not load the inspection.";
}
