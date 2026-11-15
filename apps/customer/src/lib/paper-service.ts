import { collection, query, where, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { fetch as expoFetch } from "expo/fetch";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "./firebase";
import { COLLECTIONS } from "@autodeck/database";
import type { PaperVerification } from "@autodeck/core";
import { photoContentMd5 } from "./content-md5";

export type MyPaper = PaperVerification & { evidencePath?: string | null; submissionId?: string | null };

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

export type PaperPhotoPayload = { blob: Blob; contentType?: string } | { bytes: Uint8Array; contentType?: string };

/** Signed-PUT upload: native byte arrays must go through expo/fetch (RN cannot build Blobs from bytes); web Blobs keep the global fetch path. */
export async function putPaperPhoto(uploadUrl: string, requiredHeaders: Record<string, string>, photo: PaperPhotoPayload): Promise<void> {
  const res = "bytes" in photo
    ? await expoFetch(uploadUrl, { method: "PUT", headers: requiredHeaders, body: photo.bytes })
    : await fetch(uploadUrl, { method: "PUT", headers: requiredHeaders, body: photo.blob });
  if (!res.ok) throw new Error(`Saved, but the photo did not upload (${res.status}).`);
}

/** Classify an evidence-read failure: permission problems tell the owner to sign in again; everything else is a generic availability problem. */
export function paperEvidenceFailure(err: unknown): "permission" | "unavailable" {
  const code = (err as { code?: string } | null | undefined)?.code ?? "";
  return code.endsWith("permission-denied") || code.endsWith("unauthenticated") ? "permission" : "unavailable";
}

/** Read URL for a saved document photo via the deployed getPrivateFileUrl callable (auth, tenant and ownership checked server-side). */
export async function resolvePaperEvidenceUrl(paper: MyPaper): Promise<{ url: string | null; failure: "permission" | "unavailable" | null }> {
  try {
    const fn = httpsCallable<{ kind: "paper"; id: string }, { url: string }>(functions, "getPrivateFileUrl");
    return { url: (await fn({ kind: "paper", id: paper.id })).data.url, failure: null };
  } catch (err) {
    return { url: null, failure: paperEvidenceFailure(err) };
  }
}

async function uploadAndFinalize(res: UploadReply, photo?: PaperPhotoPayload | null): Promise<boolean> {
  let uploaded = false;
  if (photo && res.uploadUrl && res.requiredHeaders) {
    await putPaperPhoto(res.uploadUrl, res.requiredHeaders, photo);
    uploaded = true;
  }
  // Finalize when bytes are definitely at the object: either we just PUT them, or the server
  // confirmed a replayed submission's earlier upload already landed (photoState "uploaded").
  // Finalize is guarded and idempotent, so a replay of an already-decided record is a no-op.
  if (photo && (uploaded || res.photoState === "uploaded")) {
    const finalize = httpsCallable<{ paperId: string }, { status: string }>(functions, "finalizeMyPaper");
    try {
      await finalize({ paperId: res.id });
    } catch {
      // submit already returned a real record id and the bytes landed. A failed
      // check is not a failed add: never invite a second record or claim verification.
      throw new Error("Saved, but automatic checks did not finish. Open Documents to review the saved photo. Do not add it again.");
    }
  }
  return uploaded;
}

type UploadReply = { id: string; uploadUrl: string | null; requiredHeaders: Record<string, string> | null; photoState: "none" | "awaiting_upload" | "uploaded"; replayed?: boolean };

export async function submitMyPaper(input: {
  studioId: string;
  vehicleId: string;
  kind: PaperVerification["kind"];
  reference: string;
  title?: string;
  issuedOn?: string;
  expiresOn?: string;
  photo?: PaperPhotoPayload | null;
  submissionId?: string;
}): Promise<{ replayed: boolean; photoUploaded: boolean }> {
  const { photo, ...rest } = input;
  const fn = httpsCallable<typeof rest & { contentType?: string; contentMd5?: string }, UploadReply>(functions, "submitMyPaper");
  const res = (await fn({ ...rest, ...(photo ? { ...(photo.contentType ? { contentType: photo.contentType } : {}), contentMd5: await photoContentMd5(photo) } : {}) })).data;
  const photoUploaded = await uploadAndFinalize(res, photo);
  return { replayed: res.replayed === true, photoUploaded };
}

/** Edit your own document: number, name, expiry, photo. The change goes back to review. */
export async function updateMyPaper(input: {
  paperId: string;
  reference?: string;
  title?: string;
  expiresOn?: string | null;
  photo?: PaperPhotoPayload | null;
  removePhoto?: boolean;
}): Promise<void> {
  const { photo, ...rest } = input;
  const fn = httpsCallable<typeof rest & { contentType?: string; contentMd5?: string }, UploadReply>(functions, "updateMyPaper");
  const res = (await fn({ ...rest, ...(photo ? { ...(photo.contentType ? { contentType: photo.contentType } : {}), contentMd5: await photoContentMd5(photo) } : {}) })).data;
  await uploadAndFinalize(res, photo);
}

export async function deleteMyPaper(paperId: string): Promise<void> {
  await httpsCallable<{ paperId: string }, { deleted: boolean }>(functions, "deleteMyPaper")({ paperId });
}

/** Every document this customer has, across all their cars (for the duplicate-number check). */
export function listenToCustomerPapers(tenantId: string, customerId: string, onData: (papers: MyPaper[]) => void, onError: (err: Error) => void): Unsubscribe {
  // Watch only the owner's active cars, then scope each papers query to one car.
  // A former owner must never receive retained private document metadata after transfer.
  let closed = false;
  let generation = 0;
  let stops: Unsubscribe[] = [];
  const cars = query(collection(db, COLLECTIONS.vehicles()), where("tenantId", "==", tenantId), where("ownerId", "==", customerId));
  const stopCars = onSnapshot(cars, snap => {
    const current = ++generation;
    stops.forEach(stop => stop()); stops = [];
    const rows = new Map<string, MyPaper[]>();
    onData([]);
    for (const car of snap.docs) {
      if (car.data().deletedAt) continue;
      stops.push(listenToVehiclePapers(car.id, tenantId, customerId, papers => {
        if (closed || generation !== current) return;
        rows.set(car.id, papers); onData([...rows.values()].flat());
      }, err => { if (!closed && generation === current) { rows.delete(car.id); onData([...rows.values()].flat()); onError(err); } }));
    }
  }, err => { if (!closed) { ++generation; stops.forEach(stop => stop()); stops = []; onData([]); onError(err); } });
  return () => { closed = true; ++generation; stopCars(); stops.forEach(stop => stop()); stops = []; };
}

export function daysUntil(isoDate: string | null): number | null {
  if (!isoDate) return null;
  const end = new Date(`${isoDate}T00:00:00+05:30`).getTime();
  return Math.ceil((end - Date.now()) / 86400000);
}
