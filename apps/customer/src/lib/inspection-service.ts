import { doc, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { db } from "./firebase";
import { COLLECTIONS } from "@autodeck/database";
import type { Inspection } from "@autodeck/core";

// Doc ID == jobId — direct get, no query needed (same pattern as warranties).
// Read-only for the customer app; Firestore rules already restrict to the
// inspection's own customerId, and the UI only ever shows finalized reports.
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
