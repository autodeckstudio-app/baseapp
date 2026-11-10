// Default-OFF gate proof: with STAFF_DOCUMENTS_ENABLED unset, all four staff
// document callables refuse with the intentional disabled reason BEFORE any
// validation or effect, the role wall still fires first, and the cleanup
// scheduler is a no-op. Emulator-only coverage; production never sets the env.
import { it, expect, vi } from "vitest";
delete process.env["STAFF_DOCUMENTS_ENABLED"];
const storage = vi.hoisted(() => ({
  sign: vi.fn(async () => ["https://fixture.invalid/private-document"]),
  remove: vi.fn(async () => {}),
}));
vi.mock("firebase-admin/storage", () => ({
  getStorage: () => ({
    bucket: () => ({
      file: () => ({
        getSignedUrl: storage.sign,
        getMetadata: async () => [{}],
        delete: storage.remove,
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
import { cleanExpiredStaffDocumentUploadsScheduled } from "../../functions/employee/cleanExpiredStaffDocumentUploads.js";
import { getFirestore } from "firebase-admin/firestore";
const db = getFirestore();
const studio = {
    uid: "gate-studio",
    token: { role: "studio", tenantId: "gate-tenant", studioId: "s" },
  },
  accountant = {
    uid: "gate-accountant",
    token: { role: "accountant", tenantId: "gate-tenant" },
  };
function run(fn: any, auth: any, data: any) {
  return fn.run({ auth, data });
}
function disabled(e: any) {
  expect(e.code).toBe("failed-precondition");
  expect(e.details).toMatchObject({ reason: "staff_documents_disabled" });
  expect(e.message).toBe("Staff documents are not available yet.");
}
it("default OFF: each callable refuses before validation or effects", async () => {
  const before = (await db.collection("staffDocumentUploads").get()).size;
  // Empty payloads: if the gate ran after validation these would fail with
  // invalid-argument instead of the disabled reason.
  await run(issueStaffDocumentUpload, studio, {}).then(
    () => {
      throw Error("expected refusal");
    },
    disabled,
  );
  await run(submitStaffDocument, studio, {}).then(
    () => {
      throw Error("expected refusal");
    },
    disabled,
  );
  await run(getStaffDocument, studio, {}).then(
    () => {
      throw Error("expected refusal");
    },
    disabled,
  );
  await run(reviewStaffDocument, studio, {}).then(
    () => {
      throw Error("expected refusal");
    },
    disabled,
  );
  // No storage or firestore effects: nothing signed, nothing written.
  // (Other emulator files may have written uploads; assert unchanged, not empty.)
  expect(storage.sign).not.toHaveBeenCalled();
  expect(storage.remove).not.toHaveBeenCalled();
  expect(
    (await db.collection("staffDocumentUploads").get()).size,
  ).toBe(before);

});
it("default OFF: role wall still fires before the gate", async () => {
  await run(getStaffDocument, accountant, { employeeId: "x" }).then(
    () => {
      throw Error("expected refusal");
    },
    (e: any) => {
      expect(e.code).toBe("permission-denied");
    },
  );
  await run(getStaffDocument, null, { employeeId: "x" }).then(
    () => {
      throw Error("expected refusal");
    },
    (e: any) => {
      expect(e.code).toBe("unauthenticated");
    },
  );
});
it("default OFF: cleanup scheduler is a no-op", async () => {
  await (cleanExpiredStaffDocumentUploadsScheduled as any).run({});
  expect(storage.remove).not.toHaveBeenCalled();
});
