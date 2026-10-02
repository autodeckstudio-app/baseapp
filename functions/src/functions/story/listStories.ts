import { onCall } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import type { Story, StoryView } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { listStoriesSchema } from "../../schemas/story.js";

const READ_WINDOW_MS = 60 * 60 * 1000;

// Customers get live (under 24h) and pinned stories; staff can ask for everything. Media comes back as 1-hour signed URLs.
export const listStories = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "customer", "studio", "admin", "superadmin");
  const data = validate(listStoriesSchema, request.data ?? {});
  await enforceRateLimit(subjectFrom(user), "gallery.read");

  const staff = user.claims.role !== "customer";
  const all = staff && data.includeAll === true;
  const now = Date.now();
  const snap = await getFirestore().collection(COLLECTIONS.stories()).where("tenantId", "==", user.claims.tenantId).limit(300).get();
  const keep = snap.docs
    .map((d) => d.data() as Story)
    .filter((s) => all || (!s.hidden && (s.pinned || Date.parse(s.expiresAt) > now)))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 100);

  const bucket = getStorage().bucket();
  const stories: StoryView[] = await Promise.all(
    keep.map(async (s) => {
      const [url] = await bucket.file(s.mediaPath).getSignedUrl({ version: "v4", action: "read", expires: now + READ_WINDOW_MS });
      return { id: s.id, mediaType: s.mediaType, url, caption: s.caption, pinned: s.pinned, highlightTitle: s.highlightTitle, hidden: s.hidden, createdAt: s.createdAt, expiresAt: s.expiresAt };
    }),
  );
  return { stories };
});
