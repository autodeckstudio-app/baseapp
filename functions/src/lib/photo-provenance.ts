import { HttpsError } from "firebase-functions/v2/https";
/** Upload-signed metadata is provenance, not current vehicle ownership. Never
 * let changing a vehicle owner grant the next owner access to old bytes. */
export async function assertPhotoProvenance(file: { getMetadata: () => Promise<unknown[]> }, customerDocId: string): Promise<void> {
  let raw: unknown;
  try { [raw] = await file.getMetadata(); }
  catch (error) { if ((error as { code?: number }).code === 404) throw new HttpsError("not-found", "The stored photo is gone."); throw new HttpsError("unavailable", "Could not confirm photo ownership. Try again."); }
  const meta = (raw as { metadata?: Record<string, string> } | undefined)?.metadata;
  const lower = meta?.["ownerid"], camel = meta?.["ownerId"];
  // Missing provenance or contradictory casing is not permission to inherit.
  if ((!lower && !camel) || (lower && lower !== customerDocId) || (camel && camel !== customerDocId)) {
    throw new HttpsError("permission-denied", "This photo belongs to an earlier ownership record. Upload a new photo.");
  }
}
