// Driving licence photo on a customer. Same pattern as the vehicle photo callables:
// a signed PUT URL (ownerId stamped in metadata), then a publish step that stamps a
// download token and records the path on the customer as licensePhotoUrl.
// A customer can only touch their own licence; studio and admin can for any customer in their tenant.
import { randomUUID } from "node:crypto";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { z } from "zod";
import type { Customer } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole, assertTenant } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const UPLOAD_WINDOW_MS = 10 * 60 * 1000;

const issueSchema = z.object({
  customerId: z.string().min(1).optional(),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
}).strict();

const publishSchema = z.object({
  customerId: z.string().min(1).optional(),
  path: z.string().min(1).max(300),
  publish: z.boolean().optional(),
}).strict();

async function loadCustomer(user: ReturnType<typeof extractUser>, requested: string | undefined) {
  const customerId = user.claims.role === "customer" ? user.uid : requested;
  if (!customerId) throw new HttpsError("invalid-argument", "customerId is required.");
  if (user.claims.role === "customer" && requested !== undefined && requested !== user.uid) {
    throw new HttpsError("permission-denied", "That is not your profile.");
  }
  const ref = getFirestore().collection(COLLECTIONS.customers()).doc(customerId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Customer not found.");
  const customer = snap.data() as Customer;
  assertTenant(user, customer.tenantId);
  return { ref, customer, customerId };
}

export const issueLicensePhotoUploadUrl = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "customer", "studio", "admin", "superadmin");
  const data = validate(issueSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "customer.licenseUpload");
  const { customer, customerId } = await loadCustomer(user, data.customerId);

  const path = `${customer.tenantId}/customers/${customerId}/licence.${randomUUID()}.${EXT[data.contentType]}`;
  const [uploadUrl] = await getStorage().bucket().file(path).getSignedUrl({
    version: "v4",
    action: "write",
    expires: Date.now() + UPLOAD_WINDOW_MS,
    contentType: data.contentType,
    extensionHeaders: { "x-goog-meta-ownerId": customerId },
  });
  return { uploadUrl, path, requiredHeaders: { "Content-Type": data.contentType, "x-goog-meta-ownerId": customerId } };
});

export const publishLicensePhoto = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "customer", "studio", "admin", "superadmin");
  const data = validate(publishSchema, request.data);
  const { ref, customer, customerId } = await loadCustomer(user, data.customerId);

  const prefix = `${customer.tenantId}/customers/${customerId}/licence.`;
  if (!data.path.startsWith(prefix) || data.path.includes("..")) {
    throw new HttpsError("invalid-argument", "That is not this customer's licence photo.");
  }
  const bucket = getStorage().bucket();
  const file = bucket.file(data.path);
  const [exists] = await file.exists();
  if (!exists) throw new HttpsError("not-found", "Photo not found. Upload it again.");

  const [meta] = await file.getMetadata();
  const existing = (meta.metadata as Record<string, string> | undefined)?.["firebaseStorageDownloadTokens"];
  const token = data.publish || !existing ? randomUUID() : existing.split(",")[0]!;
  if (token !== existing) await file.setMetadata({ metadata: { firebaseStorageDownloadTokens: token } });
  const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(data.path)}?alt=media&token=${token}`;

  if (data.publish) await ref.update({ licensePhotoUrl: data.path, updatedAt: new Date().toISOString() });
  return { path: data.path, url };
});
