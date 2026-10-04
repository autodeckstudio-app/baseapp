import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { auth, storage } from "./firebase";

const MAX_BYTES = 5 * 1024 * 1024;

/** Uploads a service photo to service-images/{tenant}/ and returns its public URL. */
export async function uploadServiceImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Pick an image file (JPG or PNG).");
  if (file.size >= MAX_BYTES) throw new Error("That photo is over 5 MB. Pick a smaller one.");
  const user = auth.currentUser;
  if (!user) throw new Error("Sign in again to upload.");
  const tenantId = (await user.getIdTokenResult()).claims["tenantId"];
  if (typeof tenantId !== "string" || !tenantId) throw new Error("Your account has no studio set up for uploads.");
  const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "jpg";
  const path = `service-images/${tenantId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const r = ref(storage, path);
  await uploadBytes(r, file, { contentType: file.type });
  return getDownloadURL(r);
}
