import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { Story } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole, assertTenant, assertStudio } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { updateStorySchema } from "../../schemas/story.js";

// Admin-only: pin to Highlights (permanent), unpin, hide (soft remove) or edit the caption. Nothing is deleted.
export const updateStory = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "admin", "superadmin");
  const data = validate(updateStorySchema, request.data);
  await enforceRateLimit(subjectFrom(user), "gallery.create");

  const db = getFirestore();
  const ref = db.collection(COLLECTIONS.stories()).doc(data.storyId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "Story not found.");
    const cur = snap.data() as Story;
    assertTenant(user, cur.tenantId);
    assertStudio(user, cur.studioId, "Story");
    const patch: Partial<Story> = { updatedAt: new Date().toISOString() };
    if (data.caption !== undefined) patch.caption = data.caption;
    if (data.hidden !== undefined) patch.hidden = data.hidden;
    if (data.pinned !== undefined) patch.pinned = data.pinned;
    if (data.highlightTitle !== undefined) patch.highlightTitle = data.highlightTitle;
    tx.update(ref, patch);
    writeAuditLog(tx, { action: "story.updated", entityType: "story", entityId: ref.id, user, studioId: cur.studioId, after: { pinned: patch.pinned ?? cur.pinned, hidden: patch.hidden ?? cur.hidden } });
  });
  return { id: ref.id };
});
