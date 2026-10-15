// Admin-only: short-lived signed PUT URL for one offer image. Path: {tenantId}/offers/{random}.{ext}.
import { onCall } from "firebase-functions/v2/https";
import { getStorage } from "firebase-admin/storage";
import { randomUUID } from "node:crypto";
import { extractUser, assertRole, assertStudio } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { issueOfferUploadUrlSchema } from "../../schemas/offer.js";

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const UPLOAD_WINDOW_MS = 10 * 60 * 1000;

export const issueOfferUploadUrl = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "admin", "superadmin");
  const data = validate(issueOfferUploadUrlSchema, request.data);
  assertStudio(user, data.studioId, "Offer");
  await enforceRateLimit(subjectFrom(user), "gallery.create");
  const path = `${user.claims.tenantId}/offers/${randomUUID()}.${EXT[data.contentType]}`;
  const [uploadUrl] = await getStorage().bucket().file(path).getSignedUrl({ version: "v4", action: "write", expires: Date.now() + UPLOAD_WINDOW_MS, contentType: data.contentType });
  return { uploadUrl, path, requiredHeaders: { "Content-Type": data.contentType } };
});
