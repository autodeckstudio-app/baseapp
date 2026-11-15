import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { randomUUID } from "node:crypto";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { z } from "zod";
import {
  extractUser,
  assertRole,
  assertTenant,
} from "../../middleware/auth.js";
import { staffDocumentsEnabled } from "../../lib/staff-documents-enabled.js";
import { validate } from "../../middleware/validate.js";
import { shouldEnforceAppCheck } from "../../lib/environment.js";
const options = {
  region: "asia-south1",
  enforceAppCheck: shouldEnforceAppCheck(),
};
const id = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[^/]+$/);
const mime = z.enum(["image/jpeg", "image/png", "application/pdf"]);
const MAX = 5 * 1024 * 1024;
/** Optional employee evidence. Never used by authentication or described as government verification. */
async function employee(request: any, employeeId: string, selfOnly = false) {
  const user = extractUser(request);
  assertRole(user, "studio", "admin", "superadmin");
  const db = getFirestore(),
    ref = db.collection("employees").doc(employeeId),
    snap = await ref.get(),
    e = snap.data();
  if (!e || e.terminatedAt || e.active !== true)
    throw new HttpsError("not-found", "Active employee profile not found.");
  assertTenant(user, e.tenantId);
  const own = e.authUid === user.uid;
  if (
    (selfOnly && !own) ||
    (!selfOnly && user.claims.role === "studio" && !own)
  )
    throw new HttpsError(
      "permission-denied",
      "This document is private to the employee and Admin.",
    );
  return { user, db, ref, e, own };
}
export const issueStaffDocumentUpload = onCall(options, async (request) => {
  assertRole(extractUser(request), "studio", "admin", "superadmin");
      if (!staffDocumentsEnabled())
        throw new HttpsError("failed-precondition", "Staff documents are not available yet.", {
          reason: "staff_documents_disabled",
        });
  const d = validate(
      z
        .object({
          employeeId: id,
          contentType: mime,
          byteSize: z.number().int().positive().max(MAX),
        })
        .strict(),
      request.data,
    ),
    { user, db, e } = await employee(request, d.employeeId, true);
  await enforceRateLimit(subjectFrom(user), "employee.documentUpload");
  const key = randomUUID(),
    path = `${e.tenantId}/staffPrivate/${d.employeeId}/${key}.${d.contentType === "application/pdf" ? "pdf" : d.contentType === "image/png" ? "png" : "jpg"}`,
    expiresAt = new Date(Date.now() + 600000).toISOString();
  const headers = {
    "Content-Type": d.contentType,
    "x-goog-if-generation-match": "0",
    "x-goog-meta-employeeid": d.employeeId,
    "x-goog-meta-owneruid": user.uid,
  };
  const [url] = await getStorage()
    .bucket()
    .file(path)
    .getSignedUrl({
      version: "v4",
      action: "write",
      expires: Date.parse(expiresAt),
      contentType: d.contentType,
      extensionHeaders: Object.fromEntries(
        Object.entries(headers).filter(([k]) => k !== "Content-Type"),
      ),
    });
  await db.collection("staffDocumentUploads").doc(key).create({
    employeeId: d.employeeId,
    tenantId: e.tenantId,
    ownerUid: user.uid,
    path,
    contentType: d.contentType,
    byteSize: d.byteSize,
    expiresAt,
    consumed: false,
  });
  return { uploadId: key, path, uploadUrl: url, requiredHeaders: headers };
});
export const submitStaffDocument = onCall(options, async (request) => {
  assertRole(extractUser(request), "studio", "admin", "superadmin");
      if (!staffDocumentsEnabled())
        throw new HttpsError("failed-precondition", "Staff documents are not available yet.", {
          reason: "staff_documents_disabled",
        });
  const d = validate(
      z
        .object({ employeeId: id, uploadId: id, consent: z.literal(true) })
        .strict(),
      request.data,
    ),
    { user, db, ref, e } = await employee(request, d.employeeId, true),
    ur = db.collection("staffDocumentUploads").doc(d.uploadId),
    us = await ur.get(),
    u = us.data();
  if (
    !u ||
    u.employeeId !== d.employeeId ||
    u.ownerUid !== user.uid ||
    u.tenantId !== e.tenantId ||
    Date.parse(u.expiresAt) <= Date.now()
  )
    throw new HttpsError(
      "failed-precondition",
      "Upload expired. Choose the document again.",
    );
  const file = getStorage().bucket().file(u.path),
    [meta] = await file.getMetadata();
  if (
    meta.contentType !== u.contentType ||
    Number(meta.size) !== u.byteSize ||
    Number(meta.size) > MAX ||
    meta.metadata?.employeeid !== d.employeeId ||
    meta.metadata?.owneruid !== user.uid
  )
    throw new HttpsError(
      "failed-precondition",
      "Uploaded document could not be verified.",
    );
  const [signature]=await file.download({start:0,end:7});
  const validSignature=u.contentType==="application/pdf"?signature.subarray(0,5).toString()==="%PDF-":u.contentType==="image/jpeg"?signature[0]===255&&signature[1]===216&&signature[2]===255:signature.equals(Buffer.from([137,80,78,71,13,10,26,10]));
  if(!validSignature)throw new HttpsError("failed-precondition","The file content does not match its document type.");
  const now = new Date().toISOString();
  await db.runTransaction(async (tx) => {
    const [es, fresh] = await Promise.all([tx.get(ref), tx.get(ur)]);
    const current = es.data(),
      upload = fresh.data();
    if (upload?.consumed && current?.documentReview?.revision === d.uploadId)
      return;
    if (
      !current ||
      current.active !== true ||
      current.terminatedAt ||
      current.authUid !== user.uid ||
      current.tenantId !== e.tenantId ||
      !upload ||
      upload.consumed ||
      upload.cleanupClaimed ||
      upload.ownerUid !== user.uid ||
      Date.parse(upload.expiresAt) <= Date.now()
    )
      throw new HttpsError(
        "failed-precondition",
        "Profile or submission changed.",
      );
    tx.set(db.collection("staffDocuments").doc(d.employeeId), {
      employeeId: d.employeeId,
      tenantId: e.tenantId,
      ownerUid: user.uid,
      revision: d.uploadId,
      path: u.path,
      contentType: u.contentType,
      byteSize: u.byteSize,
      status: "submitted",
      submittedAt: now,
      reviewedAt: null,
      reviewedBy: null,
    });
    tx.update(ur, { consumed: true });
    writeAuditLog(tx, {
      action: "employee.document_submitted",
      entityType: "employee",
      entityId: d.employeeId,
      user,
      studioId: e.studioId,
      before: null,
      after: { revision: d.uploadId, status: "submitted" },
    });
    tx.update(ref, {
      documentReview: {
        revision: d.uploadId,
        status: "submitted",
        submittedAt: now,
        reviewedAt: null,
      },
      updatedAt: now,
    });
  });
  return { submitted: true, revision: d.uploadId };
});
export const getStaffDocument = onCall(options, async (request) => {
  assertRole(extractUser(request), "studio", "admin", "superadmin");
      if (!staffDocumentsEnabled())
        throw new HttpsError("failed-precondition", "Staff documents are not available yet.", {
          reason: "staff_documents_disabled",
        });
  const d = validate(
      z.object({ employeeId: id, open: z.boolean().optional() }).strict(),
      request.data,
    ),
    { db, e, user } = await employee(request, d.employeeId),
    snap = await db.collection("staffDocuments").doc(d.employeeId).get(),
    doc = snap.data();
  await enforceRateLimit(subjectFrom(user), "employee.documentRead");
  if (!doc) return { document: null };
  if (
    doc.tenantId !== e.tenantId ||
    doc.employeeId !== d.employeeId ||
    doc.ownerUid !== e.authUid
  )
    throw new HttpsError(
      "failed-precondition",
      "Document binding needs review.",
    );
  let url: string | null = null;
  if (d.open) {
    [url] = await getStorage()
      .bucket()
      .file(doc.path)
      .getSignedUrl({
        version: "v4",
        action: "read",
        expires: Date.now() + 120000,
        responseDisposition: "inline",
        responseType: doc.contentType,
      });
  }
  return {
    document: {
      revision: doc.revision,
      status: doc.status,
      submittedAt: doc.submittedAt,
      reviewedAt: doc.reviewedAt,
      contentType: doc.contentType,
    },
    url,
    expiresInSeconds: url ? 120 : null,
  };
});
export const reviewStaffDocument = onCall(options, async (request) => {
  assertRole(extractUser(request), "studio", "admin", "superadmin");
      if (!staffDocumentsEnabled())
        throw new HttpsError("failed-precondition", "Staff documents are not available yet.", {
          reason: "staff_documents_disabled",
        });
  const d = validate(
      z
        .object({
          employeeId: id,
          revision: id,
          decision: z.enum(["reviewed", "needs_resubmission"]),
        })
        .strict(),
      request.data,
    ),
    scope = await employee(request, d.employeeId);
  assertRole(scope.user, "admin", "superadmin");
  await enforceRateLimit(subjectFrom(scope.user), "employee.documentReview");
  const { db, user, ref, e } = scope,
    dr = db.collection("staffDocuments").doc(d.employeeId),
    now = new Date().toISOString();
  await db.runTransaction(async (tx) => {
    const [es, s] = await Promise.all([tx.get(ref), tx.get(dr)]),
      doc = s.data(),
      current = es.data();
    if (
      !current ||
      current.active !== true ||
      current.terminatedAt ||
      current.tenantId !== e.tenantId ||
      current.authUid !== doc?.ownerUid ||
      !doc ||
      doc.revision !== d.revision ||
      doc.tenantId !== e.tenantId
    )
      throw new HttpsError(
        "failed-precondition",
        "The document changed. Review the current submission.",
      );
    writeAuditLog(tx, {
      action: "employee.document_reviewed",
      entityType: "employee",
      entityId: d.employeeId,
      user,
      studioId: e.studioId,
      before: { revision: doc.revision, status: doc.status },
      after: { revision: doc.revision, status: d.decision },
    });
    tx.update(dr, {
      status: d.decision,
      reviewedAt: now,
      reviewedBy: user.uid,
    });
    tx.update(ref, {
      documentReview: {
        revision: d.revision,
        status: d.decision,
        submittedAt: doc.submittedAt,
        reviewedAt: now,
      },
      updatedAt: now,
    });
  });
  return { reviewed: true };
});
