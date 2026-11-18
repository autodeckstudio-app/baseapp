import { createHash } from "node:crypto";
import { z } from "zod";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldPath } from "firebase-admin/firestore";
import { selectionScopeIssue, type Service } from "@autodeck/core";
import {
  extractUser,
  extractCustomerUser,
  assertRole,
} from "../../middleware/auth.js";
import { requireCustomerDocId } from "../../lib/customer-identity.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { shouldEnforceAppCheck } from "../../lib/environment.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { validate } from "../../middleware/validate.js";
const options = {
    region: "asia-south1",
    enforceAppCheck: shouldEnforceAppCheck(),
  },
  COL = "visitCoordinationRequests";
const id = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[A-Za-z0-9_-]+$/);
const cursor = z.object({ id, createdAt: z.string().datetime() }).strict();
const start = z
  .object({
    operationId: z.string().uuid(),
    studioId: id,
    vehicleId: id,
    serviceIds: z.array(id).min(2).max(5),
    notes: z.string().trim().max(1000).optional(),
  })
  .strict();
type Row = {
  id: string;
  tenantId: string;
  studioId: string;
  customerId: string;
  vehicleId: string;
  customerName: string | null;
  vehicleLabel: string;
  lines: { serviceId: string; name: string; updatedAt: string | null }[];
  notes: string;
  status: "requested" | "answered" | "withdrawn";
  version: number;
  reply: string | null;
  createdAt: string;
  updatedAt: string;
  sourceHash: string;
  lastOperationId: string | null;
};
const digest = (v: unknown) =>
  createHash("sha256").update(JSON.stringify(v)).digest("hex");
const view = (r: Row) => ({
  id: r.id,
  studioId: r.studioId,
  customerId: r.customerId,
  vehicleId: r.vehicleId,
  customerName: r.customerName,
  vehicleLabel: r.vehicleLabel,
  lines: r.lines.map(({ serviceId, name }) => ({ serviceId, name })),
  notes: r.notes,
  status: r.status,
  version: r.version,
  reply: r.reply,
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
});
/** An enquiry only. Never creates a visit, booking, slot, quote, payment or work permission. */
export const requestVisitCoordination = onCall(options, async (request) => {
  const user = extractCustomerUser(request),
    d = validate(start, request.data);
  if (new Set(d.serviceIds).size !== d.serviceIds.length)
    throw new HttpsError("invalid-argument", "Choose each service once.");
  await enforceRateLimit(subjectFrom(user), "quote.create");
  const db = getFirestore(),
    customerId = await requireCustomerDocId(
      db,
      "customers",
      user.claims.tenantId,
      user.uid,
    ),
    requestId =
      "coord_" + digest([user.claims.tenantId, customerId, d.operationId]),
    ref = db.collection(COL).doc(requestId),
    sourceHash = digest([
      d.studioId,
      d.vehicleId,
      [...d.serviceIds].sort(),
      d.notes ?? "",
    ]);
  return db.runTransaction(async (tx) => {
    const old = (await tx.get(ref)).data() as Row | undefined;
    if (old) {
      if (
        old.customerId !== customerId ||
        old.tenantId !== user.claims.tenantId ||
        old.sourceHash !== sourceHash
      )
        throw new HttpsError(
          "already-exists",
          "This request saved a different selection.",
        );
      return view(old);
    }
    const [c, v, config, ...snaps] = await Promise.all([
      tx.get(db.collection("customers").doc(customerId)),
      tx.get(db.collection("vehicles").doc(d.vehicleId)),
      tx.get(db.collection("studioConfig").doc(d.studioId)),
      ...d.serviceIds.map((s) => tx.get(db.collection("services").doc(s))),
    ]);
    const customer = c!.data(),
      car = v!.data();
    if (
      !c!.exists ||
      customer?.["tenantId"] !== user.claims.tenantId ||
      customer?.["authUid"] !== user.uid ||
      customer?.["deletedAt"] ||
      !v!.exists ||
      car?.["tenantId"] !== user.claims.tenantId ||
      car?.["ownerId"] !== customerId ||
      car?.["deletedAt"]
    )
      throw new HttpsError(
        "permission-denied",
        "Choose a current car on your account.",
      );
    if (
      !config!.exists ||
      config!.data()?.["tenantId"] !== user.claims.tenantId
    )
      throw new HttpsError("failed-precondition", "Studio is unavailable.");
    const services = snaps.map(
      (s, index) => ({ ...s.data(), id: d.serviceIds[index] }) as Service,
    );
    if (
      services.some(
        (s) =>
          s.tenantId !== user.claims.tenantId ||
          s.active !== true ||
          s.catalogueEntryKind === "enquiry" ||
          s.customerMenu?.bookingMode ||
          s.priceOnRequest ||
          s.basePrice <= 0 ||
          s.estimatedDurationMinutes < 1,
      )
    )
      throw new HttpsError(
        "failed-precondition",
        "A selected service is no longer available for this request.",
      );
    const issue = selectionScopeIssue(services);
    if (issue) throw new HttpsError("failed-precondition", issue);
    if (new Set(services.map((s) => s.requiredBayType)).size < 2)
      throw new HttpsError(
        "failed-precondition",
        "These services can use the normal booking review.",
      );
    const now = new Date().toISOString(),
      row: Row = {
        id: requestId,
        tenantId: user.claims.tenantId,
        studioId: d.studioId,
        customerId,
        vehicleId: d.vehicleId,
        customerName:
          typeof customer?.["name"] === "string" ? customer["name"] : null,
        vehicleLabel: [
          car?.["make"],
          car?.["model"],
          car?.["registrationNumber"],
        ]
          .filter((x) => typeof x === "string")
          .join(" "),
        lines: services.map((s) => ({
          serviceId: s.id,
          name: s.name,
          updatedAt: s.updatedAt ?? null,
        })),
        notes: d.notes ?? "",
        status: "requested",
        version: 1,
        reply: null,
        createdAt: now,
        updatedAt: now,
        sourceHash,
        lastOperationId: null,
      };
    tx.create(ref, row);
    writeAuditLog(tx, {
      action: "visit.coordination_requested",
      entityType: "VisitCoordinationRequest",
      entityId: ref.id,
      user,
      studioId: d.studioId,
      after: { serviceIds: d.serviceIds, vehicleId: d.vehicleId },
    });
    return view(row);
  });
});
const list = z
  .object({ studioId: id.optional(), cursor: cursor.optional() })
  .strict();
export const getVisitCoordinationRequests = onCall(options, async (request) => {
  const user = extractUser(request);
  assertRole(user, "customer", "studio", "admin", "superadmin");
  const d = validate(list, request.data ?? {}),
    db = getFirestore();
  await enforceRateLimit(subjectFrom(user), "read.catalogue");
  let q = db.collection(COL).where("tenantId", "==", user.claims.tenantId);
  if (!d.studioId) {
    const customer = extractCustomerUser(request),
      customerId = await requireCustomerDocId(
        db,
        "customers",
        customer.claims.tenantId,
        customer.uid,
      );
    q = q.where("customerId", "==", customerId);
  } else {
    assertRole(user, "studio", "admin", "superadmin");
    if (user.claims.role === "studio" && user.claims.studioId !== d.studioId)
      throw new HttpsError("permission-denied", "Another studio.");
    q = q.where("studioId", "==", d.studioId);
  }
  let page = q
    .orderBy("createdAt", "desc")
    .orderBy(FieldPath.documentId(), "desc")
    .limit(26);
  if (d.cursor) page = page.startAfter(d.cursor.createdAt, d.cursor.id);
  const docs = (await page.get()).docs,
    rows = docs.slice(0, 25).map((d) => d.data() as Row),
    last = rows.at(-1);
  return {
    requests: rows.map(view),
    nextCursor:
      docs.length > 25 && last
        ? { id: last.id, createdAt: last.createdAt }
        : null,
  };
});
const update = z
  .object({
    id,
    expectedVersion: z.number().int().positive(),
    operationId: z.string().uuid(),
    action: z.enum(["reply", "withdraw"]),
    reply: z.string().trim().min(1).max(2000).optional(),
  })
  .strict();
export const updateVisitCoordinationRequest = onCall(
  options,
  async (request) => {
    const user = extractUser(request),
      d = validate(update, request.data),
      db = getFirestore();
    if (d.action === "reply") {
      assertRole(user, "studio", "admin", "superadmin");
      if (!d.reply)
        throw new HttpsError(
          "invalid-argument",
          "Add a customer-visible reply.",
        );
    } else if (d.reply)
      throw new HttpsError(
        "invalid-argument",
        "A withdrawal cannot add a reply.",
      );
    await enforceRateLimit(subjectFrom(user), "quote.update");
    const customerId =
      d.action === "withdraw"
        ? await requireCustomerDocId(
            db,
            "customers",
            user.claims.tenantId,
            extractCustomerUser(request).uid,
          )
        : null;
    return db.runTransaction(async (tx) => {
      const ref = db.collection(COL).doc(d.id),
        row = (await tx.get(ref)).data() as Row | undefined;
      if (!row || row.tenantId !== user.claims.tenantId)
        throw new HttpsError("not-found", "Request not found.");
      if (
        (d.action === "reply" &&
          user.claims.role === "studio" &&
          user.claims.studioId !== row.studioId) ||
        (d.action === "withdraw" && customerId !== row.customerId)
      )
        throw new HttpsError(
          "permission-denied",
          "This request belongs to another account or studio.",
        );
      const target = d.action === "reply" ? "answered" : "withdrawn";
      if (row.lastOperationId === d.operationId) {
        if (
          row.status !== target ||
          (d.action === "reply" && row.reply !== d.reply)
        )
          throw new HttpsError(
            "already-exists",
            "This action saved a different response.",
          );
        return view(row);
      }
      if (
        row.version !== d.expectedVersion ||
        row.status === "withdrawn" ||
        (d.action === "reply" && row.status !== "requested")
      )
        throw new HttpsError(
          "aborted",
          "Request changed. Refresh before continuing.",
        );
      const next: Row = {
        ...row,
        status: target,
        reply: d.action === "reply" ? d.reply! : row.reply,
        version: row.version + 1,
        updatedAt: new Date().toISOString(),
        lastOperationId: d.operationId,
      };
      tx.set(ref, next);
      writeAuditLog(tx, {
        action:
          d.action === "reply"
            ? "visit.coordination_replied"
            : "visit.coordination_withdrawn",
        entityType: "VisitCoordinationRequest",
        entityId: ref.id,
        user,
        studioId: row.studioId,
        after: { status: target, version: next.version },
      });
      return view(next);
    });
  },
);
