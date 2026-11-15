import { beforeAll, afterAll, it } from "vitest";
import {
  initializeTestEnvironment,
  assertFails,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { TEST_PROJECT_ID } from "../emulator-setup";
let env: RulesTestEnvironment;
beforeAll(async () => {
  if (
    !TEST_PROJECT_ID.startsWith("demo-") ||
    !process.env["FIREBASE_STORAGE_EMULATOR_HOST"]?.startsWith("127.0.0.1:")
  )
    throw Error("Local demo storage required");
  env = await initializeTestEnvironment({
    projectId: TEST_PROJECT_ID,
    firestore: {
      host: "127.0.0.1",
      port: Number(process.env["FIRESTORE_EMULATOR_HOST"]!.split(":")[1]),
      rules: readFileSync(
        resolve(__dirname, "../../../../firestore.rules"),
        "utf8",
      ),
    },
    storage: {
      host: "127.0.0.1",
      port: Number(
        process.env["FIREBASE_STORAGE_EMULATOR_HOST"]!.split(":")[1],
      ),
      rules: readFileSync(
        resolve(__dirname, "../../../../storage.rules"),
        "utf8",
      ),
    },
  });
  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore();
    await db.collection("staffDocuments").doc("employee").set({
      tenantId: "tenant",
      employeeId: "employee",
      ownerUid: "owner",
      path: "tenant/staffPrivate/employee/synthetic.pdf",
      status: "submitted",
    });
    await db
      .collection("staffDocumentUploads")
      .doc("intent")
      .set({ tenantId: "tenant", employeeId: "employee", ownerUid: "owner" });
    await c
      .storage()
      .ref("tenant/staffPrivate/employee/synthetic.pdf")
      .put(new Uint8Array([37, 80, 68, 70, 45]), {
        contentType: "application/pdf",
      });
  });
});
afterAll(async () => {
  await env?.cleanup();
});
it.each([
  "owner",
  "other-staff",
  "admin",
  "superadmin",
  "customer",
  "foreign-admin",
  "anonymous",
])(
  "private document bytes/metadata/list/write/delete and internal records deny direct %s access",
  async (name) => {
    const ctx =
      name === "anonymous"
        ? env.unauthenticatedContext()
        : env.authenticatedContext(name, {
            role:
              name === "owner" || name === "other-staff"
                ? "studio"
                : name === "foreign-admin"
                  ? "admin"
                  : name,
            tenantId: name === "foreign-admin" ? "other" : "tenant",
            studioId: null,
          });
    const db = ctx.firestore(),
      store = ctx.storage();
    const file = store.ref("tenant/staffPrivate/employee/synthetic.pdf");
    await assertFails(file.getMetadata());
    await assertFails(file.getDownloadURL());
    await assertFails(store.ref("tenant/staffPrivate/employee").listAll());
    await assertFails(
      Promise.resolve(
        file.put(new Uint8Array([1, 2, 3]), { contentType: "application/pdf" }),
      ),
    );
    await assertFails(file.delete());
    for (const [col, id] of [
      ["staffDocuments", "employee"],
      ["staffDocumentUploads", "intent"],
    ]) {
      const doc = db.collection(col!).doc(id!);
      await assertFails(doc.get());
      await assertFails(doc.set({ ownerUid: name, tenantId: "tenant" }));
      await assertFails(doc.delete());
      await assertFails(db.collection(col!).get());
    }
  },
);
