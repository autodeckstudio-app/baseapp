import { beforeEach, it, expect, vi } from "vitest";
import { getFirestore } from "firebase-admin/firestore";
const storage = vi.hoisted(() => ({
  meta: new Map<string, any>(),
  sign: vi.fn(async () => ["https://fixture.invalid/private-document"]),
  remove: vi.fn(async () => {}),
}));
vi.mock("firebase-admin/storage", () => ({
  getStorage: () => ({
    bucket: () => ({
      file: (path: string) => ({
        getSignedUrl: storage.sign,
        getMetadata: async () => [storage.meta.get(path)],
        delete: storage.remove,
        download:async()=>[Buffer.from("%PDF-1.7")],
      }),
    }),
  }),
}));
import {
  issueStaffDocumentUpload,
  submitStaffDocument,
  getStaffDocument,
  reviewStaffDocument,
} from "../../functions/employee/staffDocuments.js";
const db = getFirestore();
let n = 0;
async function setup() {
  const employeeId = `document-${Date.now()}-${n++}`,
    tenantId = "document-tenant",
    uid = `uid-${employeeId}`;
  await db.collection("employees").doc(employeeId).set({
    id: employeeId,
    tenantId,
    studioId: "s",
    authUid: uid,
    active: true,
    terminatedAt: null,
  });
  return {
    employeeId,
    uid,
    tenantId,
    auth: { uid, token: { role: "studio", tenantId, studioId: "s" } },
    admin: { uid: "admin", token: { role: "admin", tenantId, studioId: null } },
  };
}
function run(fn: any, auth: any, data: any) {
  return fn.run({ auth, data });
}
async function upload(f: Awaited<ReturnType<typeof setup>>) {
  const u = await run(issueStaffDocumentUpload, f.auth, {
    employeeId: f.employeeId,
    contentType: "application/pdf",
    byteSize: 12,
  });
  storage.meta.set(u.path, {
    contentType: "application/pdf",
    size: "12",
    metadata: { employeeid: f.employeeId, owneruid: f.uid },
  });
  return u;
}
beforeEach(() => {
  storage.sign.mockClear();
  storage.meta.clear();
  storage.remove.mockClear();
});
it("has no document until optional self submission; rejects unrelated staff, customer and cross-tenant Admin", async () => {
  const f = await setup();
  expect(
    (await run(getStaffDocument, f.auth, { employeeId: f.employeeId }))
      .document,
  ).toBeNull();
  for (const auth of [
    { ...f.auth, uid: "other" },
    { uid: "customer", token: { role: "customer", tenantId: f.tenantId } },
    { uid: "otheradmin", token: { role: "admin", tenantId: "other" } },
  ])
    await expect(
      run(getStaffDocument, auth, { employeeId: f.employeeId, open: true }),
    ).rejects.toMatchObject({ code: "permission-denied" });
  expect(storage.sign).not.toHaveBeenCalled();
});
it("bound upload, submission replay, Admin read/review and replacement resets the employee tick, without public paths", async () => {
  const f = await setup(),
    u = await upload(f);
  expect(u.path).toContain(`/staffPrivate/${f.employeeId}/`);
  expect(u.requiredHeaders["x-goog-if-generation-match"]).toBe("0");
  await run(submitStaffDocument, f.auth, {
    employeeId: f.employeeId,
    uploadId: u.uploadId,
    consent: true,
  });
  await run(submitStaffDocument, f.auth, {
    employeeId: f.employeeId,
    uploadId: u.uploadId,
    consent: true,
  });
  const result = await run(getStaffDocument, f.admin, {
    employeeId: f.employeeId,
    open: true,
  });
  expect(result.document.status).toBe("submitted");
  expect(result.expiresInSeconds).toBe(120);
  expect(JSON.stringify(result)).not.toContain("staffPrivate");
  await expect(
    run(reviewStaffDocument, f.auth, {
      employeeId: f.employeeId,
      revision: u.uploadId,
      decision: "reviewed",
    }),
  ).rejects.toMatchObject({ code: "permission-denied" });
  await run(reviewStaffDocument, f.admin, {
    employeeId: f.employeeId,
    revision: u.uploadId,
    decision: "reviewed",
  });
  expect(
    (await db.collection("employees").doc(f.employeeId).get()).data()!
      .documentReview.status,
  ).toBe("reviewed");
  const replacement = await upload(f);
  await run(submitStaffDocument, f.auth, {
    employeeId: f.employeeId,
    uploadId: replacement.uploadId,
    consent: true,
  });
  expect(
    (await db.collection("employees").doc(f.employeeId).get()).data()!
      .documentReview.status,
  ).toBe("submitted");
  await expect(
    run(reviewStaffDocument, f.admin, {
      employeeId: f.employeeId,
      revision: u.uploadId,
      decision: "reviewed",
    }),
  ).rejects.toMatchObject({ code: "failed-precondition" });
  const audit = await db
    .collection("auditLog")
    .where("entityId", "==", f.employeeId)
    .get();
  expect(audit.size).toBe(3);
});
it("rejects metadata mismatch, expired intent, forged employee association and missing consent", async () => {
  const f = await setup(),
    other = await setup(),
    u = await upload(f);
  storage.meta.get(u.path).size = "13";
  await expect(
    run(submitStaffDocument, f.auth, {
      employeeId: f.employeeId,
      uploadId: u.uploadId,
      consent: true,
    }),
  ).rejects.toMatchObject({ code: "failed-precondition" });
  await expect(
    run(submitStaffDocument, other.auth, {
      employeeId: other.employeeId,
      uploadId: u.uploadId,
      consent: true,
    }),
  ).rejects.toMatchObject({ code: "failed-precondition" });
  await expect(
    run(submitStaffDocument, f.auth, {
      employeeId: f.employeeId,
      uploadId: u.uploadId,
      consent: false,
    }),
  ).rejects.toMatchObject({ code: "invalid-argument" });
  await db
    .collection("staffDocumentUploads")
    .doc(u.uploadId)
    .update({ expiresAt: new Date(0).toISOString() });
  await expect(
    run(submitStaffDocument, f.auth, {
      employeeId: f.employeeId,
      uploadId: u.uploadId,
      consent: true,
    }),
  ).rejects.toMatchObject({ code: "failed-precondition" });
  expect(
    (await db.collection("staffDocuments").doc(f.employeeId).get()).exists,
  ).toBe(false);
});
it("rejects inactive profiles and invalid/oversize file types before signing", async () => {
  const f = await setup();
  await expect(
    run(issueStaffDocumentUpload, f.auth, {
      employeeId: f.employeeId,
      contentType: "text/html",
      byteSize: 12,
    }),
  ).rejects.toMatchObject({ code: "invalid-argument" });
  await expect(
    run(issueStaffDocumentUpload, f.auth, {
      employeeId: f.employeeId,
      contentType: "application/pdf",
      byteSize: 6 * 1024 * 1024,
    }),
  ).rejects.toMatchObject({ code: "invalid-argument" });
  await db.collection("employees").doc(f.employeeId).update({ active: false });
  await expect(
    run(issueStaffDocumentUpload, f.auth, {
      employeeId: f.employeeId,
      contentType: "application/pdf",
      byteSize: 12,
    }),
  ).rejects.toMatchObject({ code: "not-found" });
  expect(storage.sign).not.toHaveBeenCalled();
});

it("cleanup deletes expired abandoned and superseded copies but preserves the current employee document", async () => {
  const f = await setup(),
    current = await upload(f),
    abandoned = await upload(f);
  await run(submitStaffDocument, f.auth, {
    employeeId: f.employeeId,
    uploadId: current.uploadId,
    consent: true,
  });
  for (const u of [current, abandoned])
    await db
      .collection("staffDocumentUploads")
      .doc(u.uploadId)
      .update({ expiresAt: new Date(0).toISOString() });
  const { cleanExpiredStaffDocumentUploads } =
    await import("../../functions/employee/cleanExpiredStaffDocumentUploads.js");
  await cleanExpiredStaffDocumentUploads.run({} as never);
  expect(
    (await db.collection("staffDocumentUploads").doc(current.uploadId).get())
      .exists,
  ).toBe(true);
  expect(
    (await db.collection("staffDocumentUploads").doc(abandoned.uploadId).get())
      .exists,
  ).toBe(false);
  expect(
    (await db.collection("staffDocuments").doc(f.employeeId).get()).data()!
      .revision,
  ).toBe(current.uploadId);
  expect(storage.remove).toHaveBeenCalled();
});
