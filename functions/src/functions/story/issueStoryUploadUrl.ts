// Admin-only: short-lived signed PUT URL for one story photo or video.
// Path: {tenantId}/stories/{random}.{ext}. Reads happen via signed GET URLs from listStories.
import { onCall } from "firebase-functions/v2/https";
import { getStorage } from "firebase-admin/storage";
import { randomUUID } from "node:crypto";
import { extractUser, assertRole, assertStudio } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { issueStoryUploadUrlSchema } from "../../schemas/story.js";

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "video/mp4": "mp4" };
const UPLOAD_WINDOW_MS = 10 * 60 * 1000;

export const issueStoryUploadUrl = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "admin", "superadmin");
  const data = validate(issueStoryUploadUrlSchema, request.data);
  assertStudio(user, data.studioId, "Story");
  await enforceRateLimit(subjectFrom(user), "gallery.create");

  const path = `${user.claims.tenantId}/stories/${randomUUID()}.${EXT[data.contentType]}`;
  const [uploadUrl] = await getStorage().bucket().file(path).getSignedUrl({
    version: "v4",
    action: "write",
    expires: Date.now() + UPLOAD_WINDOW_MS,
    contentType: data.contentType,
  });
  return { uploadUrl, path, requiredHeaders: { "Content-Type": data.contentType } };
});
