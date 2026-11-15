// PROVISIONAL: wired to the backend contracts relayed on 26 Oct (issueInspectionPhotoUploadUrl, updateInspection addPhotos).
// Those functions are not deployed. Nothing here has run against a real function.
import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";

import { checkPhotoUpload } from "./inspection-photo-rules";

type UploadUrl = { uploadUrl: string; path: string; requiredHeaders?: Record<string, string> };

/** Asks for a short-lived upload link, sends the file with exactly the headers the server named, then attaches the stored path to the inspection. Returns the stored path. */
export async function uploadInspectionPhoto(jobId: string, file: Blob, existingCount: number, fetchImpl: typeof fetch = fetch): Promise<string> {
  const contentType = file.type;
  const check = checkPhotoUpload(contentType, existingCount);
  if (!check.ok) throw new Error(check.error);
  const issue = httpsCallable<{ jobId: string; contentType: string }, UploadUrl>(functions, "issueInspectionPhotoUploadUrl");
  const { data } = await issue({ jobId, contentType });
  const res = await fetchImpl(data.uploadUrl, { method: "PUT", headers: data.requiredHeaders ?? { "Content-Type": contentType }, body: file });
  if (!res.ok) throw new Error("The photo did not upload. Try again.");
  await httpsCallable(functions, "updateInspection")({ jobId, addPhotos: [data.path] });
  return data.path;
}
