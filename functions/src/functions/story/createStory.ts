import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import type { Story } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole, assertStudio } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { createStorySchema } from "../../schemas/story.js";

const DAY_MS = 24 * 60 * 60 * 1000;

// Admin-only: publish an uploaded photo/video as a 24-hour story (optionally pinned as a Highlight).
export const createStory = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "admin", "superadmin");
  const data = validate(createStorySchema, request.data);
  assertStudio(user, data.studioId, "Story");
  await enforceRateLimit(subjectFrom(user), "gallery.create");

  if (!data.path.startsWith(`${user.claims.tenantId}/stories/`) || data.path.includes("..")) {
    throw new HttpsError("invalid-argument", "That upload does not belong to this studio.");
  }
  const [exists] = await getStorage().bucket().file(data.path).exists();
  if (!exists) throw new HttpsError("failed-precondition", "The file was not uploaded yet.");

  const db = getFirestore();
  const ref = db.collection(COLLECTIONS.stories()).doc();
  const now = new Date();
  const story: Story = {
    id: ref.id,
    tenantId: user.claims.tenantId,
    studioId: data.studioId,
    mediaPath: data.path,
    mediaType: data.contentType.startsWith("video/") ? "video" : "image",
    contentType: data.contentType,
    caption: data.caption ?? null,
    pinned: data.highlightTitle !== undefined,
    highlightTitle: data.highlightTitle ?? null,
    hidden: false,
    createdBy: user.uid,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + DAY_MS).toISOString(),
    updatedAt: now.toISOString(),
  };
  await db.runTransaction(async (tx) => {
    tx.set(ref, story);
    writeAuditLog(tx, { action: "story.created", entityType: "story", entityId: ref.id, user, studioId: data.studioId, after: { mediaType: story.mediaType, pinned: story.pinned } });
  });
  return { id: ref.id };
});
