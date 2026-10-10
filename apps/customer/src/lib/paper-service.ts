import { collection, query, where, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "./firebase";
import { COLLECTIONS } from "@autodeck/database";
import type { PaperVerification } from "@autodeck/core";

export type MyPaper = PaperVerification & { evidencePath?: string | null };

export function listenToVehiclePapers(
  vehicleId: string,
  tenantId: string,
  customerId: string,
  onData: (papers: MyPaper[]) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, COLLECTIONS.papers()),
    where("vehicleId", "==", vehicleId),
    where("tenantId", "==", tenantId),
    where("customerId", "==", customerId),
  );
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => d.data() as MyPaper).sort((a, b) => b.createdAt.localeCompare(a.createdAt))),
    onError,
  );
}

export async function submitMyPaper(input: {
  studioId: string;
  vehicleId: string;
  kind: PaperVerification["kind"];
  reference: string;
  issuedOn?: string;
  expiresOn?: string;
  photo?: { blob: Blob; contentType: string } | null;
}): Promise<void> {
  const { photo, ...rest } = input;
  const fn = httpsCallable<
    typeof rest & { contentType?: string },
    { id: string; uploadUrl: string | null; requiredHeaders: Record<string, string> | null }
  >(functions, "submitMyPaper");
  const res = (await fn({ ...rest, ...(photo ? { contentType: photo.contentType } : {}) })).data;
  if (photo && res.uploadUrl && res.requiredHeaders) {
    const put = await fetch(res.uploadUrl, { method: "PUT", headers: res.requiredHeaders, body: photo.blob });
    if (!put.ok) throw new Error(`Saved, but the photo did not upload (${put.status}).`);
    const finalize = httpsCallable<{ paperId: string }, { status: string }>(functions, "finalizeMyPaper");
    await finalize({ paperId: res.id });
  }
}

export function daysUntil(isoDate: string | null): number | null {
  if (!isoDate) return null;
  const end = new Date(`${isoDate}T00:00:00+05:30`).getTime();
  return Math.ceil((end - Date.now()) / 86400000);
}
