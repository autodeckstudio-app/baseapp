// Makes a signed-URL-uploaded vehicle photo readable in the apps, and (publish=true)
// the SINGLE transactional writer of the vehicle's photoUrl/rcPhotoUrl fields.
//
// Photo protocol (orphan fix): issueVehiclePhotoUploadUrl records a per-kind pending
// path on the vehicle doc; publish requires the published path to equal that pending
// path, moves the field, consumes the pending entry, and enqueues the superseded
// path onto the vehicle's bounded reap queue - all in one transaction. A drained
// queue is what deletes Storage objects; failed deletes stay queued and are retried,
// so a superseded object can never silently leak. One legacy accept per vehicle
// (fields absent) migrates pre-protocol cars; replays of the current path succeed
// as no-ops; stale or consumed paths fail closed with "stale-upload".
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { logger } from "firebase-functions/v2";
import type { Vehicle } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole, assertTenant } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { publishVehiclePhotoSchema } from "../../schemas/vehicle.js";
import { shouldEnforceAppCheck } from "../../lib/environment.js";
import {
  drainVehiclePhotoReap,
  enqueueReap,
  isOwnPhotoPath,
  readQueue,
  REAP_DRAIN_ATTEMPTS,
} from "../../lib/vehicle-photo-reap.js";

export const publishVehiclePhoto = onCall({ region: "asia-south1" , enforceAppCheck: shouldEnforceAppCheck() }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "customer", "studio", "admin", "superadmin");
  const data = validate(publishVehiclePhotoSchema, request.data);
  const db = getFirestore();
  const ref = db.collection(COLLECTIONS.vehicles()).doc(data.vehicleId);
  const isRc = data.kind === "rc";
  const field = isRc ? "rcPhotoUrl" : "photoUrl";
  const bucket = getStorage().bucket();
  const file = bucket.file(data.path);

  if (!data.publish) {
    // Read-URL minter for the current photo. Unchanged semantics: no protocol
    // checks, so legacy photos keep working; own-prefix + exists still enforced.
    const snap = await ref.get();
    if (!snap.exists) throw new HttpsError("not-found", "Vehicle not found");
    const vehicle = snap.data() as Vehicle;
    assertTenant(user, vehicle.tenantId);
    if (user.claims.role === "customer" && vehicle.ownerId !== user.uid) {
      throw new HttpsError("permission-denied", "You do not own this car.");
    }
    const readPrefix = `${vehicle.tenantId}/vehicles/${data.vehicleId}/${isRc ? "rc" : "cover"}.`;
    if (!data.path.startsWith(readPrefix) || data.path.includes("..")) {
      throw new HttpsError("invalid-argument", "Path is not this vehicle's own photo object");
    }
    const [exists] = await file.exists();
    if (!exists) throw new HttpsError("not-found", "Photo not found. Upload it again.");
    const [url] = await file.getSignedUrl({ version: "v4", action: "read", expires: Date.now() + 10 * 60 * 1000 });
    return { path: data.path, url };
  }

  // The new object must exist BEFORE anything moves (base semantics): a missing
  // object fails here with no field change and no reap of the current photo.
  const [newExists] = await file.exists();
  if (!newExists) throw new HttpsError("not-found", "Photo not found. Upload it again.");

  // Drain the backlog first (oldest-first), then move the field. One 10-attempt
  // budget is shared by both drains in this invocation, and a path that failed in
  // the first drain is not retried by the second - a publish never does more than
  // REAP_DRAIN_ATTEMPTS delete attempts in total, and never two against one path.
  const pre = await drainVehiclePhotoReap(data.vehicleId, bucket);

  let replay = false;
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "Vehicle not found");
    const vehicle = snap.data() as Vehicle & Record<string, unknown>;
    assertTenant(user, vehicle.tenantId);
    if (user.claims.role === "customer" && vehicle.ownerId !== user.uid) {
      throw new HttpsError("permission-denied", "You do not own this car.");
    }
    const prefix = `${vehicle.tenantId}/vehicles/${data.vehicleId}/${isRc ? "rc" : "cover"}.`;
    if (!data.path.startsWith(prefix) || data.path.includes("..")) {
      throw new HttpsError("invalid-argument", "Path is not this vehicle's own photo object");
    }
    const current = (vehicle[field] as string | null) ?? null;

    // Replay-tolerant: re-publishing the current path is a no-op success (covers a
    // client retry after commit-but-lost-response).
    if (data.path === current) { replay = true; return; }

    const kindKey = isRc ? "rc" : "cover";
    const pendingMap = (vehicle["pendingPhoto"] ?? {}) as Record<string, { path?: string } | null>;
    const pendingPath = pendingMap[kindKey]?.path ?? null;
    if (pendingPath) {
      if (data.path !== pendingPath) {
        throw new HttpsError("failed-precondition", "stale-upload: a newer upload was issued; restart the photo flow");
      }
    } else if ((vehicle["photoProtocol"] as Record<string, number> | undefined)?.[kindKey] === 1) {
      // Protocol live, nothing pending for this kind: consumed or superseded path.
      throw new HttpsError("failed-precondition", "stale-upload: no pending upload matches; restart the photo flow");
    }
    // else: legacy one-time accept (car predates the protocol, or the upload was
    // issued just before deploy). This transaction initializes the protocol.

    const updates: Record<string, unknown> = {
      [field]: data.path,
      [`pendingPhoto.${kindKey}`]: null,
      [`photoProtocol.${kindKey}`]: 1,
      updatedAt: new Date().toISOString(),
    };
    if (current && current !== data.path) {
      if (isOwnPhotoPath(current, vehicle.tenantId, data.vehicleId)) {
        updates.photoReapQueue = enqueueReap(readQueue(vehicle as Record<string, unknown>), current, kindKey);
      } else {
        // Legacy value may be a full URL or foreign path - heal what we can, skip the rest.
        logger.warn("previous photo value is not an own-path; skipped reap enqueue", { vehicleId: data.vehicleId, field });
      }
    }
    tx.update(ref, updates);
  });

  if (!replay) {
    // Drain again so the just-enqueued superseded object is deleted in this invocation.
    await drainVehiclePhotoReap(data.vehicleId, bucket, REAP_DRAIN_ATTEMPTS - pre.attempts, pre.failedPaths);
    logger.info("Vehicle photo published", { vehicleId: data.vehicleId, kind: data.kind ?? "cover" });
  }
  const [url] = await file.getSignedUrl({ version: "v4", action: "read", expires: Date.now() + 10 * 60 * 1000 });
  return { path: data.path, url };
});
