import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import type { Story } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole, assertTenant, assertStudio } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { deleteStorySchema } from "../../schemas/story.js";

// Admin-only: remove a story for good (record and file). Hiding is the soft option; this is the real delete.
export const deleteStory = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "admin", "superadmin");
  const data = validate(deleteStorySchema, request.data);
  await enforceRateLimit(subjectFrom(user), "gallery.create");

  const db = getFirestore();
  const ref = db.collection(COLLECTIONS.stories()).doc(data.storyId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Story not found.");
  const cur = snap.data() as Story;
  assertTenant(user, cur.tenantId);
  assertStudio(user, cur.studioId, "Story");
  await db.runTransaction(async (tx) => {
    tx.delete(ref);
    writeAuditLog(tx, { action: "story.deleted", entityType: "story", entityId: ref.id, user, studioId: cur.studioId, before: { mediaType: cur.mediaType, pinned: cur.pinned, highlightTitle: cur.highlightTitle } });
  });
  // The file goes after the record, so a failure here never leaves a record pointing at nothing.
  if (cur.mediaPath.startsWith(`${cur.tenantId}/stories/`) && !cur.mediaPath.includes("..")) {
    await getStorage().bucket().file(cur.mediaPath).delete({ ignoreNotFound: true }).catch(() => undefined);
  }
  return { id: ref.id };
});
