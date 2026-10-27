/**
 * Retry pass against the REAL local Firestore + Storage emulators.
 * Proves the nested query photoCleanup.status == "failed" works on real
 * Firestore, only failed tombstones are retried, cover is deleted, RC and job
 * photos survive, and the status flips to "done". Fixtures only.
 * Place at functions/src/test/emulator/vehicle-photo-retry.emulator.test.ts
 */
import { it, expect } from "vitest";
import { deleteApp, getApp, initializeApp } from "firebase-admin/app";

it("retry pass on real firestore+storage", async () => {
  await deleteApp(getApp());
  initializeApp({ projectId: "autodeck-dev", storageBucket: "autodeck-dev.appspot.com" });
  const { getFirestore } = await import("firebase-admin/firestore");
  const { getStorage } = await import("firebase-admin/storage");
  const { retryFailedVehiclePhotoCleanups } = await import("../../lib/vehicle-delete.js");
  const { COLLECTIONS } = await import("@autodeck/database");
  const db = getFirestore();
  const bucket = getStorage().bucket();
  const T = "rt";
  await bucket.file(`${T}/vehicles/v9/cover.a.jpg`).save(Buffer.from("x"));
  await bucket.file(`${T}/vehicles/v9/rc.a.jpg`).save(Buffer.from("x"));
  await bucket.file(`${T}/jobs/j1/photos/p.jpg`).save(Buffer.from("x"));
  const base = { tenantId: T, ownerId: "o", deletedAt: "x", deletedBy: "o", snapshot: {} };
  await db.collection(COLLECTIONS.deletedVehicles()).doc("v9").set({ id: "v9", ...base, photoCleanup: { status: "failed", deleted: 0, attemptedAt: "x" } });
  await db.collection(COLLECTIONS.deletedVehicles()).doc("v8").set({ id: "v8", ...base, photoCleanup: { status: "done", deleted: 1, attemptedAt: "x" } });
  const out = await retryFailedVehiclePhotoCleanups(db, bucket as never);
  expect(out).toEqual({ attempted: 1, healed: 1, stillFailing: 0 });
  expect((await bucket.file(`${T}/vehicles/v9/cover.a.jpg`).exists())[0]).toBe(false);
  expect((await bucket.file(`${T}/vehicles/v9/rc.a.jpg`).exists())[0]).toBe(true);
  expect((await bucket.file(`${T}/jobs/j1/photos/p.jpg`).exists())[0]).toBe(true);
  expect((await db.collection(COLLECTIONS.deletedVehicles()).doc("v9").get()).get("photoCleanup.status")).toBe("done");
}, 30000);
