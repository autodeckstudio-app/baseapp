// Pure rules for inspection photos (provisional backend contract, see inspection-photos.ts).
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_PHOTOS = 20;

export type PhotoCheck = { ok: true } | { ok: false; error: string };

/** Checks done before any upload: type, and the 20-photo cap per inspection. */
export function checkPhotoUpload(contentType: string, existingCount: number): PhotoCheck {
  if (!(PHOTO_TYPES as readonly string[]).includes(contentType)) return { ok: false, error: "Use a JPEG, PNG or WebP photo." };
  if (existingCount >= MAX_PHOTOS) return { ok: false, error: `An inspection holds up to ${MAX_PHOTOS} photos.` };
  return { ok: true };
}


/** Only paths in the documented layout {tenantId}/jobs/{jobId}/photos/{file} for THIS job are ever turned into a view link. */
export function isJobPhotoPath(path: string, jobId: string): boolean {
  const parts = path.split("/");
  return parts.length === 5 && parts[0] !== "" && parts[1] === "jobs" && parts[2] === jobId && parts[3] === "photos" && /^[A-Za-z0-9._-]+\.(jpe?g|png|webp)$/i.test(parts[4] ?? "") && !path.includes("..");
}
