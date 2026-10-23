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
    (snap) => onData(snap.docs.map((d) => d.data() as MyPaper).filter((p) => !p.supersededAt).sort((a, b) => b.createdAt.localeCompare(a.createdAt))),
    onError,
  );
}

async function uploadAndFinalize(res: { id: string; uploadUrl: string | null; requiredHeaders: Record<string, string> | null }, photo?: { blob: Blob; contentType: string } | null): Promise<void> {
  if (photo && res.uploadUrl && res.requiredHeaders) {
    const put = await fetch(res.uploadUrl, { method: "PUT", headers: res.requiredHeaders, body: photo.blob });
    if (!put.ok) throw new Error(`Saved, but the photo did not upload (${put.status}).`);
    const finalize = httpsCallable<{ paperId: string }, { status: string }>(functions, "finalizeMyPaper");
    await finalize({ paperId: res.id });
  }
}

type UploadReply = { id: string; uploadUrl: string | null; requiredHeaders: Record<string, string> | null };

export async function submitMyPaper(input: {
  studioId: string;
  vehicleId: string;
  kind: PaperVerification["kind"];
  reference: string;
  title?: string;
  issuedOn?: string;
  expiresOn?: string;
  photo?: { blob: Blob; contentType: string } | null;
}): Promise<void> {
  const { photo, ...rest } = input;
  const fn = httpsCallable<typeof rest & { contentType?: string }, UploadReply>(functions, "submitMyPaper");
  const res = (await fn({ ...rest, ...(photo ? { contentType: photo.contentType } : {}) })).data;
  await uploadAndFinalize(res, photo);
}

/** Edit your own document: number, name, expiry, photo. The change goes back to review. */
export async function updateMyPaper(input: {
  paperId: string;
  reference?: string;
  title?: string;
  expiresOn?: string | null;
  photo?: { blob: Blob; contentType: string } | null;
}): Promise<void> {
  const { photo, ...rest } = input;
  const fn = httpsCallable<typeof rest & { contentType?: string }, UploadReply>(functions, "updateMyPaper");
  const res = (await fn({ ...rest, ...(photo ? { contentType: photo.contentType } : {}) })).data;
  await uploadAndFinalize(res, photo);
}

export async function deleteMyPaper(paperId: string): Promise<void> {
  await httpsCallable<{ paperId: string }, { deleted: boolean }>(functions, "deleteMyPaper")({ paperId });
}

/** Every document this customer has, across all their cars (for the duplicate-number check). */
export function listenToCustomerPapers(tenantId: string, customerId: string, onData: (papers: MyPaper[]) => void, onError: (err: Error) => void): Unsubscribe {
  const q = query(collection(db, COLLECTIONS.papers()), where("tenantId", "==", tenantId), where("customerId", "==", customerId));
  return onSnapshot(q, (snap) => onData(snap.docs.map((d) => d.data() as MyPaper)), onError);
}

export function daysUntil(isoDate: string | null): number | null {
  if (!isoDate) return null;
  const end = new Date(`${isoDate}T00:00:00+05:30`).getTime();
  return Math.ceil((end - Date.now()) / 86400000);
}
