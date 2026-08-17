import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { Service } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole, assertTenant } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { updateServiceSchema } from "../../schemas/service.js";
import { assertValidMinorUnits } from "../../lib/pricing.js";

export const updateService = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "admin", "superadmin");

  const data = validate(updateServiceSchema, request.data);
  if (data.basePrice !== undefined) assertValidMinorUnits(data.basePrice, "basePrice");
  if (data.vehicleCategoryPricing !== undefined) {
    for (const rule of data.vehicleCategoryPricing) {
      assertValidMinorUnits(rule.additionalPricePaise, `vehicleCategoryPricing[${rule.vehicleCategory}].additionalPricePaise`);
    }
  }

  const db = getFirestore();
  const ref = db.collection(COLLECTIONS.services()).doc(data.serviceId);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "Service not found.");

    const existing = snap.data() as Service;
    assertTenant(user, existing.tenantId);

    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (data.name !== undefined) updates["name"] = data.name;
    if (data.category !== undefined) updates["category"] = data.category;
    if (data.brand !== undefined) updates["brand"] = data.brand;
    if (data.description !== undefined) updates["description"] = data.description;
    if (data.basePrice !== undefined) updates["basePrice"] = data.basePrice;
    if (data.currency !== undefined) updates["currency"] = data.currency;
    if (data.estimatedDurationMinutes !== undefined) updates["estimatedDurationMinutes"] = data.estimatedDurationMinutes;
    if (data.warrantyLabel !== undefined) updates["warrantyLabel"] = data.warrantyLabel;
    if (data.vehicleCategoryPricing !== undefined) updates["vehicleCategoryPricing"] = data.vehicleCategoryPricing;
    if (data.requiredBayType !== undefined) updates["requiredBayType"] = data.requiredBayType;
    if (data.membershipWashEligible !== undefined) updates["membershipWashEligible"] = data.membershipWashEligible;
    if (data.displayOrder !== undefined) updates["displayOrder"] = data.displayOrder;

    tx.update(ref, updates);
    writeAuditLog(tx, {
      action: "service.updated",
      entityType: "Service",
      entityId: data.serviceId,
      user,
      studioId: null,
      before: { name: existing.name, basePrice: existing.basePrice },
      after: updates,
    });
  });

  return { serviceId: data.serviceId };
});
