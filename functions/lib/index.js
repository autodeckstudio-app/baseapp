"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/lib/mock-payment-provider.ts
var mock_payment_provider_exports = {};
__export(mock_payment_provider_exports, {
  MockPaymentProvider: () => MockPaymentProvider,
  mockProvider: () => mockProvider
});
var MockPaymentProvider, mockProvider;
var init_mock_payment_provider = __esm({
  "src/lib/mock-payment-provider.ts"() {
    "use strict";
    MockPaymentProvider = class {
      name = "mock";
      // Deterministic IDs for emulator test assertions
      mockPaymentLinkId(referenceId) {
        return `mock_plink_${referenceId}`;
      }
      mockRefundId(referenceId) {
        return `mock_rfnd_${referenceId}`;
      }
      async createPaymentLink(params) {
        return {
          providerPaymentLinkId: this.mockPaymentLinkId(params.referenceId),
          providerOrderId: `mock_order_${params.referenceId}`,
          paymentUrl: `https://mock-razorpay.local/pay/${params.referenceId}?amount=${params.amount}`
        };
      }
      verifyWebhookSignature(_params) {
        return true;
      }
      parseWebhookEvent(rawBody) {
        const parsed = JSON.parse(rawBody);
        const body = parsed;
        const eventType = body.event ?? "payment.captured";
        const payment = body.payload?.payment?.entity;
        const refund = body.payload?.refund?.entity;
        const plink = body.payload?.payment_link?.entity;
        return {
          eventType,
          providerEventId: body.id ?? `mock_event_${Date.now()}`,
          providerPaymentId: payment?.id ?? refund?.payment_id ?? "mock_pay_id",
          providerPaymentLinkId: plink?.id ?? null,
          providerRefundId: refund?.id ?? null,
          amount: payment?.amount ?? refund?.amount ?? 0,
          currency: payment?.currency ?? "INR"
        };
      }
      async initiateRefund(params) {
        return { providerRefundId: this.mockRefundId(params.referenceId) };
      }
    };
    mockProvider = new MockPaymentProvider();
  }
});

// src/index.ts
var src_exports = {};
__export(src_exports, {
  addHoliday: () => addHoliday,
  addStaffMember: () => addStaffMember,
  advanceJobStatus: () => advanceJobStatus,
  archiveVehicle: () => archiveVehicle,
  assignBay: () => assignBay,
  calculateServicePrice: () => calculateServicePrice,
  cancelBooking: () => cancelBooking,
  confirmPaymentMock: () => confirmPaymentMock,
  createBooking: () => createBooking,
  createService: () => createService,
  createVehicle: () => createVehicle,
  createWalkinJob: () => createWalkinJob,
  deactivateStaffMember: () => deactivateStaffMember,
  getAvailability: () => getAvailability,
  getInvoice: () => getInvoice,
  getMyBookings: () => getMyBookings,
  getPaymentStatus: () => getPaymentStatus,
  getServiceCatalogue: () => getServiceCatalogue,
  getStudioJobs: () => getStudioJobs,
  healthCheck: () => healthCheck,
  initiatePayment: () => initiatePayment,
  initiateRefund: () => initiateRefund,
  recordManualPayment: () => recordManualPayment,
  removeHoliday: () => removeHoliday,
  rescheduleBooking: () => rescheduleBooking,
  setServiceActive: () => setServiceActive,
  setupCustomerProfile: () => setupCustomerProfile,
  updateService: () => updateService,
  updateStaffRole: () => updateStaffRole,
  updateStudioSettings: () => updateStudioSettings,
  updateVehicle: () => updateVehicle,
  upsertBay: () => upsertBay,
  voidInvoice: () => voidInvoice
});
module.exports = __toCommonJS(src_exports);
var import_app = require("firebase-admin/app");

// src/functions/auth/setupCustomerProfile.ts
var import_https3 = require("firebase-functions/v2/https");
var import_firestore2 = require("firebase-admin/firestore");
var import_auth = require("firebase-admin/auth");

// ../packages/core/src/constants.ts
var FIRST_TENANT_ID = "automodz";
var DEFAULT_CURRENCY = "INR";
var DEFAULT_TAX_RATE_PERCENT = 18;
var DEFAULT_TAX_DESCRIPTION = "GST 18%";
var SLOT_INTERVAL_MINUTES = 30;
var TURNOVER_BUFFER_MINUTES = 15;
var MAX_ADVANCE_BOOKING_DAYS = 30;
var MAX_CUSTOMER_RESCHEDULES = 3;
var CANCELLATION_FREE_WINDOW_HOURS = 24;
var JOB_STATUS_TRANSITIONS = {
  PENDING_VEHICLE: ["VEHICLE_RECEIVED", "CANCELLED"],
  VEHICLE_RECEIVED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["QUALITY_CHECK", "CANCELLED"],
  QUALITY_CHECK: ["READY_FOR_DELIVERY", "IN_PROGRESS"],
  READY_FOR_DELIVERY: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: []
};

// ../packages/database/src/collections.ts
var COLLECTIONS = {
  tenants: () => "tenants",
  customers: () => "customers",
  vehicles: () => "vehicles",
  bookings: () => "bookings",
  jobs: () => "jobs",
  approvals: () => "approvals",
  payments: () => "payments",
  invoices: () => "invoices",
  warranties: () => "warranties",
  memberships: () => "memberships",
  services: () => "services",
  serviceScopes: () => "serviceScopes",
  employees: () => "employees",
  studioConfig: () => "studioConfig",
  inventory: () => "inventory",
  auditLog: () => "auditLog",
  notifications: () => "notifications",
  bookingIntents: () => "bookingIntents",
  // invoiceCounters/{tenantId} — atomic invoice number counter (Admin SDK only)
  invoiceCounters: () => "invoiceCounters",
  // paymentEvents/{providerEventId} — idempotency guard for webhook/event deduplication
  paymentEvents: () => "paymentEvents"
};

// src/middleware/auth.ts
var import_https = require("firebase-functions/v2/https");
function extractRawAuth(request) {
  if (!request.auth) {
    throw new import_https.HttpsError("unauthenticated", "Authentication required.");
  }
  return {
    uid: request.auth.uid,
    phone: request.auth.token.phone_number ?? null,
    email: request.auth.token.email ?? null
  };
}
function extractUser(request) {
  if (!request.auth) {
    throw new import_https.HttpsError("unauthenticated", "Authentication required.");
  }
  const { uid, token } = request.auth;
  const rawClaims = token;
  if (typeof rawClaims["role"] !== "string" || typeof rawClaims["tenantId"] !== "string") {
    throw new import_https.HttpsError(
      "permission-denied",
      "Account setup incomplete. Sign in again after profile setup."
    );
  }
  const claims = {
    role: rawClaims["role"],
    tenantId: rawClaims["tenantId"],
    studioId: typeof rawClaims["studioId"] === "string" ? rawClaims["studioId"] : null
  };
  return {
    uid,
    phone: token.phone_number ?? null,
    email: token.email ?? null,
    claims
  };
}
function assertRole(user, ...roles) {
  if (!roles.includes(user.claims.role)) {
    throw new import_https.HttpsError(
      "permission-denied",
      `Role '${user.claims.role}' is not authorized for this operation.`
    );
  }
}
function assertTenant(user, documentTenantId) {
  if (user.claims.role === "superadmin") return;
  if (user.claims.tenantId !== documentTenantId) {
    throw new import_https.HttpsError("permission-denied", "Cross-tenant access denied.");
  }
}

// src/middleware/validate.ts
var import_https2 = require("firebase-functions/v2/https");
function validate(schema, data) {
  const result = schema.safeParse(data);
  if (result.success) {
    return result.data;
  }
  throw new import_https2.HttpsError("invalid-argument", formatZodError(result.error));
}
function formatZodError(error) {
  return error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
}

// src/middleware/audit.ts
var import_firestore = require("firebase-admin/firestore");
function writeAuditLog(tx, params) {
  const db = (0, import_firestore.getFirestore)();
  const ref = db.collection(COLLECTIONS.auditLog()).doc();
  const entry = {
    id: ref.id,
    tenantId: params.user.claims.tenantId,
    studioId: params.studioId,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    performedBy: params.user.uid,
    performedByRole: params.user.claims.role,
    before: params.before ?? null,
    after: params.after ?? null,
    metadata: params.metadata ?? {},
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  tx.set(ref, entry);
}

// src/schemas/customer.ts
var import_zod = require("zod");
var setupCustomerProfileSchema = import_zod.z.object({
  name: import_zod.z.string().min(2).max(100).trim().optional()
});
var updateCustomerProfileSchema = import_zod.z.object({
  name: import_zod.z.string().min(2).max(100).trim().optional(),
  notificationPrefs: import_zod.z.object({
    push: import_zod.z.boolean(),
    quietMode: import_zod.z.boolean()
  }).optional()
});

// src/functions/auth/setupCustomerProfile.ts
var setupCustomerProfile = (0, import_https3.onCall)(
  { region: "asia-south1" },
  async (request) => {
    const rawAuth = extractRawAuth(request);
    const data = validate(setupCustomerProfileSchema, request.data);
    const { uid, phone } = rawAuth;
    const tenantId = FIRST_TENANT_ID;
    const db = (0, import_firestore2.getFirestore)();
    const adminAuth = (0, import_auth.getAuth)();
    const customerRef = db.collection(COLLECTIONS.customers()).doc(uid);
    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(customerRef);
      if (snap.exists) {
        const existing = snap.data();
        return { customer: existing, isNew: false };
      }
      if (!data.name) {
        throw new import_https3.HttpsError("invalid-argument", "Name is required for new customers.");
      }
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const customer = {
        id: uid,
        tenantId,
        authUid: uid,
        name: data.name,
        phone: phone ?? "",
        notificationPrefs: { push: true, quietMode: false },
        createdAt: now,
        updatedAt: now,
        deletedAt: null
      };
      tx.set(customerRef, customer);
      const tempUser = {
        uid,
        phone,
        email: rawAuth.email,
        claims: { role: "customer", tenantId, studioId: null }
      };
      writeAuditLog(tx, {
        action: "customer.created",
        entityType: "Customer",
        entityId: uid,
        user: tempUser,
        studioId: null,
        after: { id: uid, tenantId, name: data.name, phone }
      });
      return { customer, isNew: true };
    });
    await adminAuth.setCustomUserClaims(uid, {
      role: "customer",
      tenantId,
      studioId: null
    });
    if (result.isNew) {
      await adminAuth.updateUser(uid, { displayName: result.customer.name });
    }
    return {
      customer: result.customer,
      isNew: result.isNew,
      // Client must call getIdToken(true) to receive updated claims
      claimsUpdated: true
    };
  }
);

// src/functions/vehicle/createVehicle.ts
var import_https4 = require("firebase-functions/v2/https");
var import_firestore3 = require("firebase-admin/firestore");

// src/schemas/vehicle.ts
var import_zod2 = require("zod");
var INDIA_PLATE_REGEX = /^[A-Z]{2}\d{2}[A-Z]{1,3}\d{4}$/;
var vehicleCategorySchema = import_zod2.z.enum([
  "hatchback",
  "sedan",
  "suv",
  "luxury",
  "commercial",
  "van"
]);
var createVehicleSchema = import_zod2.z.object({
  registrationNumber: import_zod2.z.string().toUpperCase().regex(INDIA_PLATE_REGEX, "Invalid India vehicle registration format (e.g. GJ01AB1234)"),
  make: import_zod2.z.string().min(1).max(50).trim(),
  model: import_zod2.z.string().min(1).max(100).trim(),
  year: import_zod2.z.number().int().min(1980).max((/* @__PURE__ */ new Date()).getFullYear() + 1),
  color: import_zod2.z.string().min(1).max(50).trim(),
  category: vehicleCategorySchema.nullable().optional()
});
var updateVehicleSchema = import_zod2.z.object({
  vehicleId: import_zod2.z.string().min(1),
  registrationNumber: import_zod2.z.string().toUpperCase().regex(INDIA_PLATE_REGEX).optional(),
  make: import_zod2.z.string().min(1).max(50).trim().optional(),
  model: import_zod2.z.string().min(1).max(100).trim().optional(),
  year: import_zod2.z.number().int().min(1980).max((/* @__PURE__ */ new Date()).getFullYear() + 1).optional(),
  color: import_zod2.z.string().min(1).max(50).trim().optional(),
  odometer: import_zod2.z.number().int().min(0).optional(),
  category: vehicleCategorySchema.nullable().optional()
});
var archiveVehicleSchema = import_zod2.z.object({
  vehicleId: import_zod2.z.string().min(1)
});

// src/functions/vehicle/createVehicle.ts
var createVehicle = (0, import_https4.onCall)({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "customer", "studio", "admin", "superadmin");
  assertTenant(user, user.claims.tenantId);
  const data = validate(createVehicleSchema, request.data);
  const db = (0, import_firestore3.getFirestore)();
  const ref = db.collection(COLLECTIONS.vehicles()).doc();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const vehicle = {
    id: ref.id,
    tenantId: user.claims.tenantId,
    // Server-set — not client-settable
    ownerId: user.uid,
    // Server-set — not client-settable
    registrationNumber: data.registrationNumber,
    make: data.make,
    model: data.model,
    year: data.year,
    color: data.color,
    category: data.category ?? null,
    photoUrl: null,
    odometer: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null
  };
  await db.runTransaction(async (tx) => {
    tx.set(ref, vehicle);
    writeAuditLog(tx, {
      action: "vehicle.created",
      entityType: "Vehicle",
      entityId: ref.id,
      user,
      studioId: null,
      after: { id: ref.id, tenantId: vehicle.tenantId, ownerId: vehicle.ownerId }
    });
  });
  return { vehicle };
});

// src/functions/vehicle/updateVehicle.ts
var import_https5 = require("firebase-functions/v2/https");
var import_firestore4 = require("firebase-admin/firestore");
var updateVehicle = (0, import_https5.onCall)({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "customer", "studio", "admin", "superadmin");
  const data = validate(updateVehicleSchema, request.data);
  const db = (0, import_firestore4.getFirestore)();
  const ref = db.collection(COLLECTIONS.vehicles()).doc(data.vehicleId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      throw new import_https5.HttpsError("not-found", "Vehicle not found.");
    }
    const existing = snap.data();
    assertTenant(user, existing.tenantId);
    if (user.claims.role === "customer" && existing.ownerId !== user.uid) {
      throw new import_https5.HttpsError("permission-denied", "You do not own this vehicle.");
    }
    const updates = {
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (data.registrationNumber !== void 0) updates["registrationNumber"] = data.registrationNumber;
    if (data.make !== void 0) updates["make"] = data.make;
    if (data.model !== void 0) updates["model"] = data.model;
    if (data.year !== void 0) updates["year"] = data.year;
    if (data.color !== void 0) updates["color"] = data.color;
    if (data.odometer !== void 0) updates["odometer"] = data.odometer;
    if (data.category !== void 0) updates["category"] = data.category;
    tx.update(ref, updates);
    writeAuditLog(tx, {
      action: "vehicle.updated",
      entityType: "Vehicle",
      entityId: data.vehicleId,
      user,
      studioId: null,
      before: { registrationNumber: existing.registrationNumber },
      after: updates
    });
  });
  return { vehicleId: data.vehicleId };
});

// src/functions/vehicle/archiveVehicle.ts
var import_https6 = require("firebase-functions/v2/https");
var import_firestore5 = require("firebase-admin/firestore");
var archiveVehicle = (0, import_https6.onCall)({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "customer", "studio", "admin", "superadmin");
  const data = validate(archiveVehicleSchema, request.data);
  const db = (0, import_firestore5.getFirestore)();
  const ref = db.collection(COLLECTIONS.vehicles()).doc(data.vehicleId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      throw new import_https6.HttpsError("not-found", "Vehicle not found.");
    }
    const existing = snap.data();
    assertTenant(user, existing.tenantId);
    if (user.claims.role === "customer" && existing.ownerId !== user.uid) {
      throw new import_https6.HttpsError("permission-denied", "You do not own this vehicle.");
    }
    if (existing.deletedAt !== null) {
      throw new import_https6.HttpsError("failed-precondition", "Vehicle is already archived.");
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    tx.update(ref, { deletedAt: now, updatedAt: now });
    writeAuditLog(tx, {
      action: "vehicle.archived",
      entityType: "Vehicle",
      entityId: data.vehicleId,
      user,
      studioId: null,
      before: { deletedAt: null },
      after: { deletedAt: now }
    });
  });
  return { vehicleId: data.vehicleId, archived: true };
});

// src/functions/service/getServiceCatalogue.ts
var import_https7 = require("firebase-functions/v2/https");
var import_firestore6 = require("firebase-admin/firestore");

// src/schemas/service.ts
var import_zod3 = require("zod");
var vehicleCategoryEnum = import_zod3.z.enum([
  "hatchback",
  "sedan",
  "suv",
  "luxury",
  "commercial",
  "van"
]);
var serviceCategoryEnum = import_zod3.z.enum([
  "ppf",
  "ceramic",
  "washing",
  "coating",
  "inspection",
  "tinting",
  "other"
]);
var bayTypeEnum = import_zod3.z.enum(["wash", "protection", "general"]);
var vehicleCategoryPricingSchema = import_zod3.z.object({
  vehicleCategory: vehicleCategoryEnum,
  additionalPricePaise: import_zod3.z.number().int().min(0, "Price must be non-negative paise"),
  additionalMinutes: import_zod3.z.number().int().min(0)
});
var createServiceSchema = import_zod3.z.object({
  name: import_zod3.z.string().min(1).max(100).trim(),
  category: serviceCategoryEnum,
  brand: import_zod3.z.string().max(100).trim().nullable(),
  description: import_zod3.z.string().min(1).max(2e3).trim(),
  basePrice: import_zod3.z.number().int().min(0, "Base price must be a non-negative integer (paise)"),
  currency: import_zod3.z.string().length(3).optional(),
  estimatedDurationMinutes: import_zod3.z.number().int().min(1).max(1440),
  warrantyLabel: import_zod3.z.string().max(200).trim().nullable(),
  vehicleCategoryPricing: import_zod3.z.array(vehicleCategoryPricingSchema).optional(),
  requiredBayType: bayTypeEnum.optional(),
  membershipWashEligible: import_zod3.z.boolean().optional(),
  displayOrder: import_zod3.z.number().int().min(0).optional()
});
var updateServiceSchema = import_zod3.z.object({
  serviceId: import_zod3.z.string().min(1),
  name: import_zod3.z.string().min(1).max(100).trim().optional(),
  category: serviceCategoryEnum.optional(),
  brand: import_zod3.z.string().max(100).trim().nullable().optional(),
  description: import_zod3.z.string().min(1).max(2e3).trim().optional(),
  basePrice: import_zod3.z.number().int().min(0).optional(),
  currency: import_zod3.z.string().length(3).optional(),
  estimatedDurationMinutes: import_zod3.z.number().int().min(1).max(1440).optional(),
  warrantyLabel: import_zod3.z.string().max(200).trim().nullable().optional(),
  vehicleCategoryPricing: import_zod3.z.array(vehicleCategoryPricingSchema).optional(),
  requiredBayType: bayTypeEnum.optional(),
  membershipWashEligible: import_zod3.z.boolean().optional(),
  displayOrder: import_zod3.z.number().int().min(0).optional()
});
var setServiceActiveSchema = import_zod3.z.object({
  serviceId: import_zod3.z.string().min(1),
  active: import_zod3.z.boolean()
});
var calculatePriceSchema = import_zod3.z.object({
  serviceId: import_zod3.z.string().min(1),
  vehicleCategory: vehicleCategoryEnum
});
var getServiceCatalogueSchema = import_zod3.z.object({
  category: serviceCategoryEnum.optional()
});

// src/functions/service/getServiceCatalogue.ts
var getServiceCatalogue = (0, import_https7.onCall)({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertTenant(user, user.claims.tenantId);
  const data = validate(getServiceCatalogueSchema, request.data);
  const db = (0, import_firestore6.getFirestore)();
  let query = db.collection(COLLECTIONS.services()).where("tenantId", "==", user.claims.tenantId).where("active", "==", true).orderBy("displayOrder", "asc");
  if (data.category !== void 0) {
    query = query.where("category", "==", data.category);
  }
  const snap = await query.get();
  const services = snap.docs.map((doc) => doc.data());
  return { services };
});

// src/functions/service/calculatePrice.ts
var import_https8 = require("firebase-functions/v2/https");
var import_firestore7 = require("firebase-admin/firestore");

// src/lib/pricing.ts
function calculatePrice(input) {
  assertValidMinorUnits(input.basePrice, "basePrice");
  const taxRatePercent = input.taxRatePercent ?? DEFAULT_TAX_RATE_PERCENT;
  const taxDescription = input.taxDescription ?? DEFAULT_TAX_DESCRIPTION;
  const currency = input.currency ?? DEFAULT_CURRENCY;
  const categoryRule = input.vehicleCategoryPricing.find(
    (r) => r.vehicleCategory === input.vehicleCategory
  );
  const scopeAdjustment = categoryRule?.additionalPricePaise ?? 0;
  assertValidMinorUnits(scopeAdjustment, "vehicleCategoryPricing.additionalPricePaise");
  const subtotal = input.basePrice + scopeAdjustment;
  const tax = calculateTax(subtotal, taxRatePercent);
  const total = subtotal + tax;
  return {
    vehicleCategory: input.vehicleCategory,
    basePrice: input.basePrice,
    scopeAdjustment,
    addOns: [],
    // V1: no add-ons
    subtotal,
    membershipDiscount: null,
    // V1: no membership
    membershipDiscountPercent: null,
    pickupFee: 0,
    // V1: no pickup/drop
    dropFee: 0,
    taxRatePercent,
    taxDescription,
    tax,
    total,
    currency
  };
}
function calculateTax(subtotalPaise, taxRatePercent) {
  return Math.round(subtotalPaise * taxRatePercent / 100);
}
function assertValidMinorUnits(value, field) {
  if (!Number.isInteger(value)) {
    throw new Error(`${field} must be an integer (paise). Got: ${value}`);
  }
  if (value < 0) {
    throw new Error(`${field} must be non-negative (paise). Got: ${value}`);
  }
}

// src/functions/service/calculatePrice.ts
var calculateServicePrice = (0, import_https8.onCall)({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertTenant(user, user.claims.tenantId);
  const data = validate(calculatePriceSchema, request.data);
  const db = (0, import_firestore7.getFirestore)();
  const snap = await db.collection(COLLECTIONS.services()).doc(data.serviceId).get();
  if (!snap.exists) throw new import_https8.HttpsError("not-found", "Service not found.");
  const service = snap.data();
  assertTenant(user, service.tenantId);
  if (!service.active) {
    throw new import_https8.HttpsError("failed-precondition", "Service is not currently available.");
  }
  const breakdown = calculatePrice({
    basePrice: service.basePrice,
    vehicleCategory: data.vehicleCategory,
    vehicleCategoryPricing: service.vehicleCategoryPricing,
    currency: service.currency
    // taxRatePercent and taxDescription use defaults (GST 18%) — tenant config is V2+
  });
  const snapshot = {
    serviceId: service.id,
    serviceName: service.name,
    serviceCategory: service.category,
    vehicleCategory: data.vehicleCategory,
    basePrice: breakdown.basePrice,
    vehicleCategoryAdjustment: breakdown.scopeAdjustment,
    subtotal: breakdown.subtotal,
    taxRatePercent: breakdown.taxRatePercent,
    taxDescription: breakdown.taxDescription,
    tax: breakdown.tax,
    total: breakdown.total,
    currency: breakdown.currency,
    snapshotAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  return { breakdown, snapshot };
});

// src/functions/service/createService.ts
var import_https9 = require("firebase-functions/v2/https");
var import_firestore8 = require("firebase-admin/firestore");
var createService = (0, import_https9.onCall)({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "admin", "superadmin");
  assertTenant(user, user.claims.tenantId);
  const data = validate(createServiceSchema, request.data);
  assertValidMinorUnits(data.basePrice, "basePrice");
  const vehicleCategoryPricing = data.vehicleCategoryPricing ?? [];
  for (const rule of vehicleCategoryPricing) {
    assertValidMinorUnits(rule.additionalPricePaise, `vehicleCategoryPricing[${rule.vehicleCategory}].additionalPricePaise`);
  }
  const db = (0, import_firestore8.getFirestore)();
  const ref = db.collection(COLLECTIONS.services()).doc();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const service = {
    id: ref.id,
    tenantId: user.claims.tenantId,
    name: data.name,
    category: data.category,
    brand: data.brand,
    description: data.description,
    basePrice: data.basePrice,
    currency: data.currency ?? "INR",
    estimatedDurationMinutes: data.estimatedDurationMinutes,
    warrantyLabel: data.warrantyLabel,
    vehicleCategoryPricing,
    requiredBayType: data.requiredBayType ?? "general",
    membershipWashEligible: data.membershipWashEligible ?? false,
    active: true,
    displayOrder: data.displayOrder ?? 0,
    createdAt: now,
    updatedAt: now
  };
  await db.runTransaction(async (tx) => {
    tx.set(ref, service);
    writeAuditLog(tx, {
      action: "service.created",
      entityType: "Service",
      entityId: ref.id,
      user,
      studioId: null,
      after: { id: ref.id, name: service.name, basePrice: service.basePrice, active: true }
    });
  });
  return { service };
});

// src/functions/service/updateService.ts
var import_https10 = require("firebase-functions/v2/https");
var import_firestore9 = require("firebase-admin/firestore");
var updateService = (0, import_https10.onCall)({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "admin", "superadmin");
  const data = validate(updateServiceSchema, request.data);
  if (data.basePrice !== void 0) assertValidMinorUnits(data.basePrice, "basePrice");
  if (data.vehicleCategoryPricing !== void 0) {
    for (const rule of data.vehicleCategoryPricing) {
      assertValidMinorUnits(rule.additionalPricePaise, `vehicleCategoryPricing[${rule.vehicleCategory}].additionalPricePaise`);
    }
  }
  const db = (0, import_firestore9.getFirestore)();
  const ref = db.collection(COLLECTIONS.services()).doc(data.serviceId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new import_https10.HttpsError("not-found", "Service not found.");
    const existing = snap.data();
    assertTenant(user, existing.tenantId);
    const updates = { updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
    if (data.name !== void 0) updates["name"] = data.name;
    if (data.category !== void 0) updates["category"] = data.category;
    if (data.brand !== void 0) updates["brand"] = data.brand;
    if (data.description !== void 0) updates["description"] = data.description;
    if (data.basePrice !== void 0) updates["basePrice"] = data.basePrice;
    if (data.currency !== void 0) updates["currency"] = data.currency;
    if (data.estimatedDurationMinutes !== void 0) updates["estimatedDurationMinutes"] = data.estimatedDurationMinutes;
    if (data.warrantyLabel !== void 0) updates["warrantyLabel"] = data.warrantyLabel;
    if (data.vehicleCategoryPricing !== void 0) updates["vehicleCategoryPricing"] = data.vehicleCategoryPricing;
    if (data.requiredBayType !== void 0) updates["requiredBayType"] = data.requiredBayType;
    if (data.membershipWashEligible !== void 0) updates["membershipWashEligible"] = data.membershipWashEligible;
    if (data.displayOrder !== void 0) updates["displayOrder"] = data.displayOrder;
    tx.update(ref, updates);
    writeAuditLog(tx, {
      action: "service.updated",
      entityType: "Service",
      entityId: data.serviceId,
      user,
      studioId: null,
      before: { name: existing.name, basePrice: existing.basePrice },
      after: updates
    });
  });
  return { serviceId: data.serviceId };
});

// src/functions/service/setServiceActive.ts
var import_https11 = require("firebase-functions/v2/https");
var import_firestore10 = require("firebase-admin/firestore");
var setServiceActive = (0, import_https11.onCall)({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "admin", "superadmin");
  const data = validate(setServiceActiveSchema, request.data);
  const db = (0, import_firestore10.getFirestore)();
  const ref = db.collection(COLLECTIONS.services()).doc(data.serviceId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new import_https11.HttpsError("not-found", "Service not found.");
    const existing = snap.data();
    assertTenant(user, existing.tenantId);
    tx.update(ref, { active: data.active, updatedAt: (/* @__PURE__ */ new Date()).toISOString() });
    writeAuditLog(tx, {
      action: data.active ? "service.activated" : "service.deactivated",
      entityType: "Service",
      entityId: data.serviceId,
      user,
      studioId: null,
      before: { active: existing.active },
      after: { active: data.active }
    });
  });
  return { serviceId: data.serviceId, active: data.active };
});

// src/functions/booking/getAvailability.ts
var import_https12 = require("firebase-functions/v2/https");
var import_firestore11 = require("firebase-admin/firestore");

// src/schemas/booking.ts
var import_zod4 = require("zod");
var vehicleCategoryEnum2 = import_zod4.z.enum([
  "hatchback",
  "sedan",
  "suv",
  "luxury",
  "commercial",
  "van"
]);
var dateStr = import_zod4.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD");
var timeStr = import_zod4.z.string().regex(/^\d{2}:\d{2}$/, "Must be HH:mm");
var getAvailabilitySchema = import_zod4.z.object({
  serviceId: import_zod4.z.string().min(1),
  studioId: import_zod4.z.string().min(1),
  startDate: dateStr,
  lookAheadDays: import_zod4.z.number().int().min(1).max(30).optional()
});
var createBookingSchema = import_zod4.z.object({
  serviceId: import_zod4.z.string().min(1),
  vehicleId: import_zod4.z.string().min(1),
  vehicleCategory: vehicleCategoryEnum2,
  studioId: import_zod4.z.string().min(1),
  scheduledDate: dateStr,
  scheduledTime: timeStr,
  idempotencyKey: import_zod4.z.string().min(1).max(128),
  notes: import_zod4.z.string().max(500).optional()
});
var cancelBookingSchema = import_zod4.z.object({
  bookingId: import_zod4.z.string().min(1),
  reason: import_zod4.z.string().min(1).max(500)
});
var rescheduleBookingSchema = import_zod4.z.object({
  bookingId: import_zod4.z.string().min(1),
  newDate: dateStr,
  newTime: timeStr,
  idempotencyKey: import_zod4.z.string().min(1).max(128)
});
var getMyBookingsSchema = import_zod4.z.object({
  status: import_zod4.z.enum(["PENDING", "CONFIRMED", "ACTIVE", "COMPLETED", "CANCELLED", "EXPIRED"]).optional()
});

// src/lib/schedule.ts
function getTZOffsetMinutes(timezone, atUTC) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
  const parts = fmt.formatToParts(atUTC);
  const get = (type) => parseInt(parts.find((p) => p.type === type)?.value ?? "0", 10);
  const localAsUTC = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second")
  );
  return Math.round((localAsUTC - atUTC.getTime()) / 6e4);
}
function localToUTC(dateStr2, timeStr2, timezone) {
  const [year, month, day] = dateStr2.split("-").map(Number);
  const [hour, minute] = timeStr2.split(":").map(Number);
  const approxUTC = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const offset = getTZOffsetMinutes(timezone, approxUTC);
  return new Date(approxUTC.getTime() - offset * 6e4);
}
function utcToLocalTime(utcDate, timezone) {
  return utcDate.toLocaleString("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}
function utcToLocalDate(utcDate, timezone) {
  return utcDate.toLocaleDateString("en-CA", { timeZone: timezone });
}
function timeToMinutes(time) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}
function minutesToTime(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
function addDays(dateStr2, days) {
  const d = /* @__PURE__ */ new Date(`${dateStr2}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function getDayOfWeek(localDateStr) {
  const d = /* @__PURE__ */ new Date(`${localDateStr}T12:00:00Z`);
  return d.getUTCDay();
}
function isHoliday(dateStr2, holidays) {
  return holidays.includes(dateStr2);
}

// src/lib/availability.ts
function generateDaySlots(params) {
  const { date, openTime, closeTime, serviceDurationMinutes, occupiedIntervals, timezone } = params;
  const slotDuration = serviceDurationMinutes + TURNOVER_BUFFER_MINUTES;
  const openMin = timeToMinutes(openTime);
  const closeMin = timeToMinutes(closeTime);
  const maxStartMin = closeMin - slotDuration;
  if (maxStartMin < openMin) return [];
  const slots = [];
  let candidate = openMin;
  while (candidate <= maxStartMin) {
    const candidateStartTime = minutesToTime(candidate);
    const candidateEndTime = minutesToTime(candidate + serviceDurationMinutes);
    const startUTC = localToUTC(date, candidateStartTime, timezone);
    const endUTC = new Date(startUTC.getTime() + slotDuration * 6e4);
    const blocked = occupiedIntervals.some(
      ({ startAt, endAt }) => startUTC < endAt && endUTC > startAt
    );
    if (!blocked) {
      slots.push({
        date,
        startTime: candidateStartTime,
        endTime: candidateEndTime,
        startAt: startUTC.toISOString(),
        estimatedEndAt: new Date(
          startUTC.getTime() + serviceDurationMinutes * 6e4
        ).toISOString()
      });
    }
    candidate += SLOT_INTERVAL_MINUTES;
  }
  return slots;
}
function computeAvailability(params) {
  const {
    startDate,
    lookAheadDays,
    serviceDurationMinutes,
    requiredBayType,
    bays,
    operatingHours,
    holidays,
    timezone
  } = params;
  const activeBays = bays.filter((b) => b.active && b.bayType === requiredBayType);
  if (activeBays.length === 0) return [];
  const seenSlots = /* @__PURE__ */ new Set();
  const results = [];
  for (let d = 0; d < lookAheadDays; d++) {
    const date = addDays(startDate, d);
    if (isHoliday(date, holidays)) continue;
    const dow = getDayOfWeek(date);
    const hours = operatingHours.find((h) => h.dayOfWeek === dow);
    if (!hours || hours.closed) continue;
    for (const bay of activeBays) {
      const occupied = params.occupiedByBay.get(bay.id) ?? [];
      const daySlots = generateDaySlots({
        date,
        openTime: hours.open,
        closeTime: hours.close,
        serviceDurationMinutes,
        occupiedIntervals: occupied,
        timezone
      });
      for (const slot of daySlots) {
        const key = `${slot.date}|${slot.startTime}`;
        if (!seenSlots.has(key)) {
          seenSlots.add(key);
          results.push(slot);
        }
      }
    }
  }
  return results;
}
function buildOccupiedInterval(scheduledAtISO, estimatedEndAtISO) {
  const startAt = new Date(scheduledAtISO);
  const rawEnd = new Date(estimatedEndAtISO);
  const endAt = new Date(rawEnd.getTime() + TURNOVER_BUFFER_MINUTES * 6e4);
  return { startAt, endAt };
}
function hasConflict(startAt, serviceDurationMinutes, occupied) {
  const slotDuration = serviceDurationMinutes + TURNOVER_BUFFER_MINUTES;
  const endAt = new Date(startAt.getTime() + slotDuration * 6e4);
  return occupied.some((o) => startAt < o.endAt && endAt > o.startAt);
}

// src/functions/booking/getAvailability.ts
var MAX_RETURNED_SLOTS = 60;
var getAvailability = (0, import_https12.onCall)({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  const data = validate(getAvailabilitySchema, request.data);
  const db = (0, import_firestore11.getFirestore)();
  const lookAheadDays = data.lookAheadDays ?? 14;
  const serviceSnap = await db.collection(COLLECTIONS.services()).doc(data.serviceId).get();
  if (!serviceSnap.exists) throw new import_https12.HttpsError("not-found", "Service not found.");
  const service = serviceSnap.data();
  if (service.tenantId !== user.claims.tenantId) {
    throw new import_https12.HttpsError("permission-denied", "Cross-tenant access denied.");
  }
  if (!service.active) {
    throw new import_https12.HttpsError("failed-precondition", "Service is not currently available.");
  }
  const configSnap = await db.collection(COLLECTIONS.studioConfig()).doc(data.studioId).get();
  if (!configSnap.exists) throw new import_https12.HttpsError("not-found", "Studio not found.");
  const config = configSnap.data();
  if (config.tenantId !== user.claims.tenantId) {
    throw new import_https12.HttpsError("permission-denied", "Cross-tenant access denied.");
  }
  const compatibleBays = config.bays.filter(
    (b) => b.active && b.bayType === service.requiredBayType
  );
  if (compatibleBays.length === 0) {
    return { slots: [] };
  }
  const endDate = addDays(data.startDate, lookAheadDays);
  const occupiedByBay = /* @__PURE__ */ new Map();
  await Promise.all(
    compatibleBays.map(async (bay) => {
      const jobsSnap = await db.collection(COLLECTIONS.jobs()).where("studioId", "==", data.studioId).where("bayId", "==", bay.id).where("scheduledDate", ">=", data.startDate).where("scheduledDate", "<=", endDate).get();
      const intervals = [];
      for (const doc of jobsSnap.docs) {
        const job = doc.data();
        if (job.status === "CANCELLED" || job.status === "DELIVERED") continue;
        intervals.push(buildOccupiedInterval(job.scheduledAt, job.estimatedEndAt));
      }
      occupiedByBay.set(bay.id, intervals);
    })
  );
  const slots = computeAvailability({
    startDate: data.startDate,
    lookAheadDays,
    serviceDurationMinutes: service.estimatedDurationMinutes,
    requiredBayType: service.requiredBayType,
    bays: config.bays,
    operatingHours: config.operatingHours,
    holidays: config.holidays,
    timezone: config.timezone,
    occupiedByBay
  });
  return { slots: slots.slice(0, MAX_RETURNED_SLOTS) };
});

// src/functions/booking/createBooking.ts
var import_https13 = require("firebase-functions/v2/https");
var import_firestore12 = require("firebase-admin/firestore");
var createBooking = (0, import_https13.onCall)({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  const data = validate(createBookingSchema, request.data);
  const db = (0, import_firestore12.getFirestore)();
  const now = /* @__PURE__ */ new Date();
  const requestedStart = localToUTC(data.scheduledDate, data.scheduledTime, "Asia/Kolkata");
  const maxDate = new Date(now.getTime() + MAX_ADVANCE_BOOKING_DAYS * 24 * 60 * 60 * 1e3);
  if (requestedStart <= now) {
    throw new import_https13.HttpsError("invalid-argument", "Booking time must be in the future.");
  }
  if (requestedStart > maxDate) {
    throw new import_https13.HttpsError(
      "invalid-argument",
      `Cannot book more than ${MAX_ADVANCE_BOOKING_DAYS} days in advance.`
    );
  }
  const [serviceSnap, configSnap, vehicleSnap] = await Promise.all([
    db.collection(COLLECTIONS.services()).doc(data.serviceId).get(),
    db.collection(COLLECTIONS.studioConfig()).doc(data.studioId).get(),
    db.collection(COLLECTIONS.vehicles()).doc(data.vehicleId).get()
  ]);
  if (!serviceSnap.exists) throw new import_https13.HttpsError("not-found", "Service not found.");
  if (!configSnap.exists) throw new import_https13.HttpsError("not-found", "Studio not found.");
  if (!vehicleSnap.exists) throw new import_https13.HttpsError("not-found", "Vehicle not found.");
  const service = serviceSnap.data();
  const config = configSnap.data();
  const vehicle = vehicleSnap.data();
  if (service.tenantId !== user.claims.tenantId) {
    throw new import_https13.HttpsError("permission-denied", "Cross-tenant access denied.");
  }
  if (config.tenantId !== user.claims.tenantId) {
    throw new import_https13.HttpsError("permission-denied", "Cross-tenant access denied.");
  }
  if (vehicle.ownerId !== user.uid) {
    throw new import_https13.HttpsError("permission-denied", "Vehicle does not belong to this customer.");
  }
  if (!service.active) {
    throw new import_https13.HttpsError("failed-precondition", "Service is not currently available.");
  }
  const compatibleBays = config.bays.filter(
    (b) => b.active && b.bayType === service.requiredBayType
  );
  if (compatibleBays.length === 0) {
    throw new import_https13.HttpsError("failed-precondition", "No bays available for this service type.");
  }
  const breakdown = calculatePrice({
    basePrice: service.basePrice,
    vehicleCategory: data.vehicleCategory,
    vehicleCategoryPricing: service.vehicleCategoryPricing,
    taxRatePercent: config.taxRatePercent,
    taxDescription: config.taxDescription,
    currency: config.currency
  });
  const estimatedEndAt = new Date(
    requestedStart.getTime() + service.estimatedDurationMinutes * 6e4
  );
  const nowIso = now.toISOString();
  const bookingRef = db.collection(COLLECTIONS.bookings()).doc();
  const jobRef = db.collection(COLLECTIONS.jobs()).doc();
  const intentRef = db.collection(COLLECTIONS.bookingIntents()).doc(data.idempotencyKey);
  const result = await db.runTransaction(async (tx) => {
    const intentSnap = await tx.get(intentRef);
    if (intentSnap.exists) {
      const existingBookingId = intentSnap.data().bookingId;
      const existingSnap = await tx.get(
        db.collection(COLLECTIONS.bookings()).doc(existingBookingId)
      );
      return { booking: existingSnap.data() };
    }
    const bayOccupancy = /* @__PURE__ */ new Map();
    for (const bay of compatibleBays) {
      const jobsSnap = await tx.get(
        db.collection(COLLECTIONS.jobs()).where("studioId", "==", data.studioId).where("bayId", "==", bay.id).where("scheduledDate", "==", data.scheduledDate)
      );
      const intervals = [];
      for (const doc of jobsSnap.docs) {
        const job2 = doc.data();
        if (job2.status === "CANCELLED" || job2.status === "DELIVERED") continue;
        intervals.push(buildOccupiedInterval(job2.scheduledAt, job2.estimatedEndAt));
      }
      bayOccupancy.set(bay.id, intervals);
    }
    let assignedBayId = null;
    let minJobs = Infinity;
    for (const bay of compatibleBays) {
      const occupied = bayOccupancy.get(bay.id) ?? [];
      if (!hasConflict(requestedStart, service.estimatedDurationMinutes, occupied)) {
        if (occupied.length < minJobs) {
          minJobs = occupied.length;
          assignedBayId = bay.id;
        }
      }
    }
    if (!assignedBayId) {
      throw new import_https13.HttpsError(
        "resource-exhausted",
        "No bays available for the requested time slot. Please choose another time."
      );
    }
    const booking = {
      id: bookingRef.id,
      tenantId: user.claims.tenantId,
      studioId: data.studioId,
      customerId: user.uid,
      vehicleId: data.vehicleId,
      serviceId: data.serviceId,
      vehicleCategory: data.vehicleCategory,
      scheduledAt: requestedStart.toISOString(),
      scheduledDate: data.scheduledDate,
      scheduledTime: data.scheduledTime,
      estimatedEndAt: estimatedEndAt.toISOString(),
      estimatedEndDate: utcToLocalDate(estimatedEndAt, config.timezone),
      estimatedEndTime: utcToLocalTime(estimatedEndAt, config.timezone),
      durationMinutes: service.estimatedDurationMinutes,
      bayId: assignedBayId,
      assignedEmployeeId: null,
      status: "CONFIRMED",
      priceBreakdown: breakdown,
      totalAmount: breakdown.total,
      membershipDiscountApplied: false,
      paymentStatus: "unpaid",
      notes: data.notes ?? null,
      idempotencyKey: data.idempotencyKey,
      rescheduleCount: 0,
      confirmedAt: nowIso,
      cancelledAt: null,
      cancellationReason: null,
      createdAt: nowIso,
      updatedAt: nowIso
    };
    const job = {
      id: jobRef.id,
      tenantId: user.claims.tenantId,
      studioId: data.studioId,
      bookingId: bookingRef.id,
      customerId: user.uid,
      vehicleId: data.vehicleId,
      serviceId: data.serviceId,
      bayId: assignedBayId,
      assignedEmployeeId: null,
      status: "PENDING_VEHICLE",
      statusHistory: [
        {
          status: "PENDING_VEHICLE",
          changedAt: nowIso,
          changedBy: user.uid,
          notes: null
        }
      ],
      scheduledAt: requestedStart.toISOString(),
      scheduledDate: data.scheduledDate,
      estimatedEndAt: new Date(
        requestedStart.getTime() + (service.estimatedDurationMinutes + TURNOVER_BUFFER_MINUTES) * 6e4
      ).toISOString(),
      estimatedDurationMinutes: service.estimatedDurationMinutes,
      studioNotes: data.notes ?? null,
      additionalWorkDelta: 0,
      priceBreakdown: breakdown,
      // same snapshot already computed for the booking — not recomputed
      totalAmount: breakdown.total,
      paymentStatus: "unpaid",
      isWalkIn: false,
      createdAt: nowIso,
      updatedAt: nowIso,
      sealedAt: null
    };
    tx.set(bookingRef, booking);
    tx.set(jobRef, job);
    tx.set(intentRef, {
      bookingId: bookingRef.id,
      customerId: user.uid,
      tenantId: user.claims.tenantId,
      createdAt: nowIso
    });
    writeAuditLog(tx, {
      action: "booking.created",
      entityType: "Booking",
      entityId: bookingRef.id,
      user,
      studioId: data.studioId,
      after: {
        id: bookingRef.id,
        serviceId: data.serviceId,
        scheduledAt: requestedStart.toISOString(),
        bayId: assignedBayId,
        totalAmount: breakdown.total,
        status: "CONFIRMED"
      }
    });
    return { booking };
  });
  return result;
});

// src/functions/booking/cancelBooking.ts
var import_https14 = require("firebase-functions/v2/https");
var import_firestore13 = require("firebase-admin/firestore");
var cancelBooking = (0, import_https14.onCall)({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  const data = validate(cancelBookingSchema, request.data);
  const db = (0, import_firestore13.getFirestore)();
  const bookingSnap = await db.collection(COLLECTIONS.bookings()).doc(data.bookingId).get();
  if (!bookingSnap.exists) throw new import_https14.HttpsError("not-found", "Booking not found.");
  const booking = bookingSnap.data();
  assertTenant(user, booking.tenantId);
  const isCustomer = user.claims.role === "customer";
  const isStudioOrAbove = user.claims.role === "studio" || user.claims.role === "admin" || user.claims.role === "superadmin";
  if (isCustomer && booking.customerId !== user.uid) {
    throw new import_https14.HttpsError("permission-denied", "Cannot cancel another customer's booking.");
  }
  if (!isCustomer && !isStudioOrAbove) {
    throw new import_https14.HttpsError("permission-denied", "Unauthorized.");
  }
  if (booking.status === "CANCELLED") {
    return { success: true, alreadyCancelled: true };
  }
  if (booking.status === "COMPLETED" || booking.status === "EXPIRED") {
    throw new import_https14.HttpsError(
      "failed-precondition",
      `Cannot cancel a booking with status ${booking.status}.`
    );
  }
  if (isCustomer) {
    const scheduledAt = new Date(booking.scheduledAt);
    const hoursUntil = (scheduledAt.getTime() - Date.now()) / 36e5;
    if (hoursUntil < CANCELLATION_FREE_WINDOW_HOURS) {
      throw new import_https14.HttpsError(
        "failed-precondition",
        `Cancellations within ${CANCELLATION_FREE_WINDOW_HOURS} hours of the appointment must be made by contacting the studio directly.`
      );
    }
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const bookingRef = db.collection(COLLECTIONS.bookings()).doc(data.bookingId);
  const jobsSnap = await db.collection(COLLECTIONS.jobs()).where("bookingId", "==", data.bookingId).limit(1).get();
  await db.runTransaction(async (tx) => {
    tx.update(bookingRef, {
      status: "CANCELLED",
      cancelledAt: now,
      cancellationReason: data.reason,
      updatedAt: now
    });
    if (!jobsSnap.empty) {
      const jobDoc = jobsSnap.docs[0];
      if (!jobDoc) {
      } else {
        const job = jobDoc.data();
        const cancellableStatuses = ["PENDING_VEHICLE", "VEHICLE_RECEIVED"];
        if (cancellableStatuses.includes(job.status)) {
          tx.update(db.collection(COLLECTIONS.jobs()).doc(jobDoc.id), {
            status: "CANCELLED",
            statusHistory: [
              ...job.statusHistory,
              {
                status: "CANCELLED",
                changedAt: now,
                changedBy: user.uid,
                notes: `Booking cancelled: ${data.reason}`
              }
            ],
            updatedAt: now
          });
        }
      }
    }
    writeAuditLog(tx, {
      action: "booking.cancelled",
      entityType: "Booking",
      entityId: data.bookingId,
      user,
      studioId: booking.studioId,
      before: { status: booking.status },
      after: { status: "CANCELLED", cancellationReason: data.reason }
    });
  });
  return { success: true };
});

// src/functions/booking/rescheduleBooking.ts
var import_https15 = require("firebase-functions/v2/https");
var import_firestore14 = require("firebase-admin/firestore");
var rescheduleBooking = (0, import_https15.onCall)({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  const data = validate(rescheduleBookingSchema, request.data);
  const db = (0, import_firestore14.getFirestore)();
  const isCustomer = user.claims.role === "customer";
  const isStudioOrAbove = user.claims.role === "studio" || user.claims.role === "admin" || user.claims.role === "superadmin";
  const bookingSnap = await db.collection(COLLECTIONS.bookings()).doc(data.bookingId).get();
  if (!bookingSnap.exists) throw new import_https15.HttpsError("not-found", "Booking not found.");
  const booking = bookingSnap.data();
  assertTenant(user, booking.tenantId);
  if (isCustomer && booking.customerId !== user.uid) {
    throw new import_https15.HttpsError("permission-denied", "Cannot reschedule another customer's booking.");
  }
  if (!isCustomer && !isStudioOrAbove) {
    throw new import_https15.HttpsError("permission-denied", "Unauthorized.");
  }
  if (booking.status !== "CONFIRMED") {
    throw new import_https15.HttpsError(
      "failed-precondition",
      `Cannot reschedule a booking with status ${booking.status}.`
    );
  }
  if (isCustomer) {
    if (booking.rescheduleCount >= MAX_CUSTOMER_RESCHEDULES) {
      throw new import_https15.HttpsError(
        "failed-precondition",
        `Maximum reschedules (${MAX_CUSTOMER_RESCHEDULES}) reached. Contact the studio to reschedule.`
      );
    }
    const scheduledAt = new Date(booking.scheduledAt);
    const hoursUntil = (scheduledAt.getTime() - Date.now()) / 36e5;
    if (hoursUntil < CANCELLATION_FREE_WINDOW_HOURS) {
      throw new import_https15.HttpsError(
        "failed-precondition",
        `Reschedules within ${CANCELLATION_FREE_WINDOW_HOURS} hours of the appointment must be made by contacting the studio directly.`
      );
    }
  }
  const [serviceSnap, configSnap] = await Promise.all([
    db.collection(COLLECTIONS.services()).doc(booking.serviceId).get(),
    db.collection(COLLECTIONS.studioConfig()).doc(booking.studioId).get()
  ]);
  if (!serviceSnap.exists) throw new import_https15.HttpsError("not-found", "Service not found.");
  if (!configSnap.exists) throw new import_https15.HttpsError("not-found", "Studio not found.");
  const service = serviceSnap.data();
  const config = configSnap.data();
  const newStart = localToUTC(data.newDate, data.newTime, config.timezone);
  if (newStart <= /* @__PURE__ */ new Date()) {
    throw new import_https15.HttpsError("invalid-argument", "New booking time must be in the future.");
  }
  const compatibleBays = config.bays.filter(
    (b) => b.active && b.bayType === service.requiredBayType
  );
  if (compatibleBays.length === 0) {
    throw new import_https15.HttpsError("failed-precondition", "No bays available for this service type.");
  }
  const newEstimatedEndAt = new Date(
    newStart.getTime() + service.estimatedDurationMinutes * 6e4
  );
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const jobsSnap = await db.collection(COLLECTIONS.jobs()).where("bookingId", "==", data.bookingId).limit(1).get();
  const jobDoc = jobsSnap.docs[0];
  const updatedBooking = await db.runTransaction(async (tx) => {
    const bayOccupancy = /* @__PURE__ */ new Map();
    for (const bay of compatibleBays) {
      const jobsOnBay = await tx.get(
        db.collection(COLLECTIONS.jobs()).where("studioId", "==", booking.studioId).where("bayId", "==", bay.id).where("scheduledDate", "==", data.newDate)
      );
      const intervals = [];
      for (const doc of jobsOnBay.docs) {
        const j = doc.data();
        if (j.bookingId === data.bookingId) continue;
        if (j.status === "CANCELLED" || j.status === "DELIVERED") continue;
        intervals.push(buildOccupiedInterval(j.scheduledAt, j.estimatedEndAt));
      }
      bayOccupancy.set(bay.id, intervals);
    }
    let assignedBayId = null;
    let minJobs = Infinity;
    for (const bay of compatibleBays) {
      const occupied = bayOccupancy.get(bay.id) ?? [];
      if (!hasConflict(newStart, service.estimatedDurationMinutes, occupied)) {
        if (occupied.length < minJobs) {
          minJobs = occupied.length;
          assignedBayId = bay.id;
        }
      }
    }
    if (!assignedBayId) {
      throw new import_https15.HttpsError(
        "resource-exhausted",
        "No bays available for the new time slot. Please choose another time."
      );
    }
    const bookingUpdates = {
      scheduledAt: newStart.toISOString(),
      scheduledDate: data.newDate,
      scheduledTime: data.newTime,
      estimatedEndAt: newEstimatedEndAt.toISOString(),
      estimatedEndDate: utcToLocalDate(newEstimatedEndAt, config.timezone),
      estimatedEndTime: utcToLocalTime(newEstimatedEndAt, config.timezone),
      bayId: assignedBayId,
      rescheduleCount: booking.rescheduleCount + 1,
      updatedAt: now
    };
    tx.update(db.collection(COLLECTIONS.bookings()).doc(data.bookingId), bookingUpdates);
    if (jobDoc) {
      const job = jobDoc.data();
      tx.update(db.collection(COLLECTIONS.jobs()).doc(jobDoc.id), {
        scheduledAt: newStart.toISOString(),
        scheduledDate: data.newDate,
        estimatedEndAt: new Date(
          newStart.getTime() + (service.estimatedDurationMinutes + TURNOVER_BUFFER_MINUTES) * 6e4
        ).toISOString(),
        bayId: assignedBayId,
        statusHistory: [
          ...job.statusHistory,
          {
            status: job.status,
            changedAt: now,
            changedBy: user.uid,
            notes: `Rescheduled to ${data.newDate} ${data.newTime}`
          }
        ],
        updatedAt: now
      });
    }
    writeAuditLog(tx, {
      action: "booking.rescheduled",
      entityType: "Booking",
      entityId: data.bookingId,
      user,
      studioId: booking.studioId,
      before: {
        scheduledAt: booking.scheduledAt,
        bayId: booking.bayId,
        rescheduleCount: booking.rescheduleCount
      },
      after: {
        scheduledAt: newStart.toISOString(),
        bayId: assignedBayId,
        rescheduleCount: booking.rescheduleCount + 1
      }
    });
    return { ...booking, ...bookingUpdates };
  });
  return { booking: updatedBooking };
});

// src/functions/booking/getMyBookings.ts
var import_https16 = require("firebase-functions/v2/https");
var import_firestore15 = require("firebase-admin/firestore");
var getMyBookings = (0, import_https16.onCall)({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  const data = validate(getMyBookingsSchema, request.data);
  const db = (0, import_firestore15.getFirestore)();
  let q = db.collection(COLLECTIONS.bookings()).where("customerId", "==", user.uid).where("tenantId", "==", user.claims.tenantId).orderBy("scheduledAt", "desc");
  if (data.status) {
    q = db.collection(COLLECTIONS.bookings()).where("customerId", "==", user.uid).where("tenantId", "==", user.claims.tenantId).where("status", "==", data.status).orderBy("scheduledAt", "desc");
  }
  const snap = await q.limit(50).get();
  const bookings = snap.docs.map((doc) => doc.data());
  return { bookings };
});

// src/functions/job/createWalkinJob.ts
var import_https17 = require("firebase-functions/v2/https");
var import_firestore16 = require("firebase-admin/firestore");

// src/schemas/job.ts
var import_zod5 = require("zod");
var vehicleCategoryEnum3 = import_zod5.z.enum([
  "hatchback",
  "sedan",
  "suv",
  "luxury",
  "commercial",
  "van"
]);
var createWalkinJobSchema = import_zod5.z.object({
  serviceId: import_zod5.z.string().min(1),
  vehicleId: import_zod5.z.string().min(1),
  vehicleCategory: vehicleCategoryEnum3,
  bayId: import_zod5.z.string().min(1),
  customerId: import_zod5.z.string().min(1),
  studioId: import_zod5.z.string().min(1),
  notes: import_zod5.z.string().max(500).optional()
});
var advanceJobStatusSchema = import_zod5.z.object({
  jobId: import_zod5.z.string().min(1),
  notes: import_zod5.z.string().max(500).optional()
});
var getStudioJobsSchema = import_zod5.z.object({
  studioId: import_zod5.z.string().min(1),
  date: import_zod5.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD").optional()
});
var assignBaySchema = import_zod5.z.object({
  jobId: import_zod5.z.string().min(1),
  bayId: import_zod5.z.string().min(1),
  reason: import_zod5.z.string().max(500).optional()
});

// src/functions/job/createWalkinJob.ts
var createWalkinJob = (0, import_https17.onCall)({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "studio", "admin", "superadmin");
  const data = validate(createWalkinJobSchema, request.data);
  const db = (0, import_firestore16.getFirestore)();
  const now = /* @__PURE__ */ new Date();
  const nowIso = now.toISOString();
  const [serviceSnap, configSnap, vehicleSnap] = await Promise.all([
    db.collection(COLLECTIONS.services()).doc(data.serviceId).get(),
    db.collection(COLLECTIONS.studioConfig()).doc(data.studioId).get(),
    db.collection(COLLECTIONS.vehicles()).doc(data.vehicleId).get()
  ]);
  if (!serviceSnap.exists) throw new import_https17.HttpsError("not-found", "Service not found.");
  if (!configSnap.exists) throw new import_https17.HttpsError("not-found", "Studio not found.");
  if (!vehicleSnap.exists) throw new import_https17.HttpsError("not-found", "Vehicle not found.");
  const service = serviceSnap.data();
  const config = configSnap.data();
  const vehicle = vehicleSnap.data();
  assertTenant(user, service.tenantId);
  assertTenant(user, config.tenantId);
  assertTenant(user, vehicle.tenantId);
  if (!service.active) {
    throw new import_https17.HttpsError("failed-precondition", "Service is not currently available.");
  }
  const bay = config.bays.find((b) => b.id === data.bayId);
  if (!bay) throw new import_https17.HttpsError("not-found", "Bay not found in studio configuration.");
  if (!bay.active) throw new import_https17.HttpsError("failed-precondition", "Bay is not active.");
  if (bay.bayType !== service.requiredBayType) {
    throw new import_https17.HttpsError(
      "failed-precondition",
      `Bay type '${bay.bayType}' is not compatible with service requiring '${service.requiredBayType}'.`
    );
  }
  const priceBreakdown = calculatePrice({
    basePrice: service.basePrice,
    vehicleCategory: data.vehicleCategory,
    vehicleCategoryPricing: service.vehicleCategoryPricing,
    taxRatePercent: config.taxRatePercent,
    taxDescription: config.taxDescription,
    currency: config.currency
  });
  const scheduledDate = utcToLocalDate(now, config.timezone);
  const estimatedEndAt = new Date(
    now.getTime() + (service.estimatedDurationMinutes + TURNOVER_BUFFER_MINUTES) * 6e4
  );
  const jobRef = db.collection(COLLECTIONS.jobs()).doc();
  await db.runTransaction(async (tx) => {
    const activeJobsSnap = await tx.get(
      db.collection(COLLECTIONS.jobs()).where("studioId", "==", data.studioId).where("bayId", "==", data.bayId).where("scheduledDate", "==", scheduledDate)
    );
    const occupied = [];
    for (const doc of activeJobsSnap.docs) {
      const job = doc.data();
      if (job.status === "CANCELLED" || job.status === "DELIVERED") continue;
      occupied.push(buildOccupiedInterval(job.scheduledAt, job.estimatedEndAt));
    }
    if (hasConflict(now, service.estimatedDurationMinutes, occupied)) {
      throw new import_https17.HttpsError(
        "resource-exhausted",
        "Bay is currently occupied. Please select a different bay."
      );
    }
    const walkinJob = {
      id: jobRef.id,
      tenantId: user.claims.tenantId,
      studioId: data.studioId,
      bookingId: null,
      customerId: data.customerId,
      vehicleId: data.vehicleId,
      serviceId: data.serviceId,
      bayId: data.bayId,
      assignedEmployeeId: user.uid,
      status: "VEHICLE_RECEIVED",
      statusHistory: [
        {
          status: "VEHICLE_RECEIVED",
          changedAt: nowIso,
          changedBy: user.uid,
          notes: data.notes ?? null
        }
      ],
      scheduledAt: nowIso,
      scheduledDate,
      estimatedEndAt: estimatedEndAt.toISOString(),
      estimatedDurationMinutes: service.estimatedDurationMinutes,
      studioNotes: data.notes ?? null,
      additionalWorkDelta: 0,
      priceBreakdown,
      totalAmount: priceBreakdown.total,
      paymentStatus: "unpaid",
      isWalkIn: true,
      createdAt: nowIso,
      updatedAt: nowIso,
      sealedAt: null
    };
    tx.set(jobRef, walkinJob);
    writeAuditLog(tx, {
      action: "job.walkin_created",
      entityType: "ServiceJob",
      entityId: jobRef.id,
      user,
      studioId: data.studioId,
      after: {
        id: jobRef.id,
        bayId: data.bayId,
        serviceId: data.serviceId,
        vehicleId: data.vehicleId,
        customerId: data.customerId,
        totalAmount: priceBreakdown.total
      }
    });
  });
  const created = await db.collection(COLLECTIONS.jobs()).doc(jobRef.id).get();
  return { job: created.data() };
});

// src/functions/job/advanceJobStatus.ts
var import_https18 = require("firebase-functions/v2/https");
var import_firestore17 = require("firebase-admin/firestore");
var advanceJobStatus = (0, import_https18.onCall)({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "studio", "admin", "superadmin");
  const data = validate(advanceJobStatusSchema, request.data);
  const db = (0, import_firestore17.getFirestore)();
  const jobSnap = await db.collection(COLLECTIONS.jobs()).doc(data.jobId).get();
  if (!jobSnap.exists) throw new import_https18.HttpsError("not-found", "Job not found.");
  const job = jobSnap.data();
  assertTenant(user, job.tenantId);
  if (user.claims.role === "studio" && user.claims.studioId !== job.studioId) {
    throw new import_https18.HttpsError("permission-denied", "Job belongs to a different studio.");
  }
  const validTransitions = JOB_STATUS_TRANSITIONS[job.status] ?? [];
  if (validTransitions.length === 0) {
    throw new import_https18.HttpsError(
      "failed-precondition",
      `Job is in terminal status '${job.status}' and cannot be advanced.`
    );
  }
  const nextStatus = validTransitions.find((s) => s !== "CANCELLED");
  if (!nextStatus) {
    throw new import_https18.HttpsError(
      "failed-precondition",
      `No forward transition available from status '${job.status}'.`
    );
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const newHistoryEntry = {
    status: nextStatus,
    changedAt: now,
    changedBy: user.uid,
    notes: data.notes ?? null
  };
  await db.runTransaction(async (tx) => {
    tx.update(db.collection(COLLECTIONS.jobs()).doc(data.jobId), {
      status: nextStatus,
      statusHistory: [...job.statusHistory, newHistoryEntry],
      updatedAt: now,
      ...nextStatus === "DELIVERED" ? { sealedAt: now } : {}
    });
    if (job.bookingId) {
      const bookingUpdate = { updatedAt: now };
      if (nextStatus === "VEHICLE_RECEIVED") {
        bookingUpdate["status"] = "ACTIVE";
      } else if (nextStatus === "DELIVERED") {
        bookingUpdate["status"] = "COMPLETED";
      }
      if (Object.keys(bookingUpdate).length > 1) {
        tx.update(db.collection(COLLECTIONS.bookings()).doc(job.bookingId), bookingUpdate);
      }
    }
    writeAuditLog(tx, {
      action: "job.status_advanced",
      entityType: "ServiceJob",
      entityId: data.jobId,
      user,
      studioId: job.studioId,
      before: { status: job.status },
      after: { status: nextStatus }
    });
  });
  return { jobId: data.jobId, previousStatus: job.status, newStatus: nextStatus };
});

// src/functions/job/getStudioJobs.ts
var import_https19 = require("firebase-functions/v2/https");
var import_firestore18 = require("firebase-admin/firestore");
var getStudioJobs = (0, import_https19.onCall)({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "studio", "admin", "superadmin");
  const data = validate(getStudioJobsSchema, request.data);
  const db = (0, import_firestore18.getFirestore)();
  if (user.claims.role === "studio" && user.claims.studioId !== data.studioId) {
    throw new import_https19.HttpsError("permission-denied", "Access denied to this studio's jobs.");
  }
  const targetDate = data.date ?? utcToLocalDate(/* @__PURE__ */ new Date(), "Asia/Kolkata");
  const snap = await db.collection(COLLECTIONS.jobs()).where("studioId", "==", data.studioId).where("tenantId", "==", user.claims.tenantId).where("scheduledDate", "==", targetDate).orderBy("scheduledAt", "asc").get();
  const jobs = snap.docs.map((doc) => doc.data());
  return { jobs, date: targetDate };
});

// src/functions/job/assignBay.ts
var import_https20 = require("firebase-functions/v2/https");
var import_firestore19 = require("firebase-admin/firestore");
var assignBay = (0, import_https20.onCall)({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "studio", "admin", "superadmin");
  const data = validate(assignBaySchema, request.data);
  const db = (0, import_firestore19.getFirestore)();
  const jobSnap = await db.collection(COLLECTIONS.jobs()).doc(data.jobId).get();
  if (!jobSnap.exists) throw new import_https20.HttpsError("not-found", "Job not found.");
  const job = jobSnap.data();
  assertTenant(user, job.tenantId);
  if (user.claims.role === "studio" && user.claims.studioId !== job.studioId) {
    throw new import_https20.HttpsError("permission-denied", "Job belongs to a different studio.");
  }
  if (job.status === "DELIVERED" || job.status === "CANCELLED") {
    throw new import_https20.HttpsError(
      "failed-precondition",
      `Cannot reassign bay for a job with status '${job.status}'.`
    );
  }
  const configSnap = await db.collection(COLLECTIONS.studioConfig()).doc(job.studioId).get();
  if (!configSnap.exists) throw new import_https20.HttpsError("not-found", "Studio config not found.");
  const config = configSnap.data();
  const bay = config.bays.find((b) => b.id === data.bayId);
  if (!bay) throw new import_https20.HttpsError("not-found", "Bay not found in studio configuration.");
  if (!bay.active) throw new import_https20.HttpsError("failed-precondition", "Target bay is not active.");
  const previousBayId = job.bayId;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  await db.runTransaction(async (tx) => {
    tx.update(db.collection(COLLECTIONS.jobs()).doc(data.jobId), {
      bayId: data.bayId,
      updatedAt: now
    });
    if (job.bookingId) {
      tx.update(db.collection(COLLECTIONS.bookings()).doc(job.bookingId), {
        bayId: data.bayId,
        updatedAt: now
      });
    }
    writeAuditLog(tx, {
      action: "job.bay_reassigned",
      entityType: "ServiceJob",
      entityId: data.jobId,
      user,
      studioId: job.studioId,
      before: { bayId: previousBayId },
      after: { bayId: data.bayId, reason: data.reason ?? null }
    });
  });
  return { jobId: data.jobId, previousBayId, newBayId: data.bayId };
});

// src/functions/payment/initiatePayment.ts
var import_https21 = require("firebase-functions/v2/https");
var import_firestore20 = require("firebase-admin/firestore");

// src/schemas/payment.ts
var import_zod6 = require("zod");
var initiatePaymentSchema = import_zod6.z.object({
  jobId: import_zod6.z.string().min(1),
  method: import_zod6.z.enum(["razorpay_payment_link", "cash", "upi_manual", "bank_transfer"])
});
var confirmPaymentMockSchema = import_zod6.z.object({
  paymentId: import_zod6.z.string().min(1),
  // 'success' simulates a successful provider webhook; 'failure' simulates a failed payment
  mockResult: import_zod6.z.enum(["success", "failure"])
});
var recordManualPaymentSchema = import_zod6.z.object({
  jobId: import_zod6.z.string().min(1),
  method: import_zod6.z.enum(["cash", "upi_manual", "bank_transfer"]),
  manualReference: import_zod6.z.string().optional()
});
var getPaymentStatusSchema = import_zod6.z.object({
  jobId: import_zod6.z.string().min(1)
});
var initiateRefundSchema = import_zod6.z.object({
  paymentId: import_zod6.z.string().min(1),
  reason: import_zod6.z.string().min(1).max(500)
});

// src/lib/razorpay-provider.ts
var import_node_crypto = require("node:crypto");
var RazorpayProvider = class {
  name = "razorpay";
  keyId;
  keySecret;
  webhookSecret;
  baseUrl = "https://api.razorpay.com/v1";
  constructor(keyId, keySecret, webhookSecret) {
    this.keyId = keyId;
    this.keySecret = keySecret;
    this.webhookSecret = webhookSecret;
  }
  get authHeader() {
    const credentials = Buffer.from(`${this.keyId}:${this.keySecret}`).toString("base64");
    return `Basic ${credentials}`;
  }
  async createPaymentLink(params) {
    const response = await fetch(`${this.baseUrl}/payment_links`, {
      method: "POST",
      headers: {
        Authorization: this.authHeader,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        amount: params.amount,
        currency: params.currency,
        description: params.description,
        customer: {
          name: params.customerName,
          contact: params.customerPhone
        },
        reference_id: params.referenceId,
        notes: { bookingId: params.bookingId },
        callback_url: null,
        // handled via webhook
        callback_method: null
      })
    });
    if (!response.ok) {
      throw new Error(`Razorpay createPaymentLink failed: ${response.status}`);
    }
    const data = await response.json();
    return {
      providerPaymentLinkId: data.id,
      providerOrderId: data.order_id ?? null,
      paymentUrl: data.short_url
    };
  }
  verifyWebhookSignature(params) {
    const expected = (0, import_node_crypto.createHmac)("sha256", this.webhookSecret).update(params.rawBody).digest("hex");
    return expected === params.signature;
  }
  parseWebhookEvent(rawBody) {
    const body = JSON.parse(rawBody);
    const eventType = body.event;
    const payment = body.payload?.payment?.entity;
    const refund = body.payload?.refund?.entity;
    const plink = body.payload?.payment_link?.entity;
    return {
      eventType,
      providerEventId: body.id,
      providerPaymentId: payment?.id ?? refund?.payment_id ?? "",
      providerPaymentLinkId: plink?.id ?? null,
      providerRefundId: refund?.id ?? null,
      amount: payment?.amount ?? refund?.amount ?? 0,
      currency: payment?.currency ?? "INR"
    };
  }
  async initiateRefund(params) {
    const response = await fetch(
      `${this.baseUrl}/payments/${params.providerPaymentId}/refund`,
      {
        method: "POST",
        headers: {
          Authorization: this.authHeader,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          amount: params.amount,
          notes: { reason: params.reason },
          receipt: params.referenceId
        })
      }
    );
    if (!response.ok) {
      throw new Error(`Razorpay initiateRefund failed: ${response.status}`);
    }
    const data = await response.json();
    return { providerRefundId: data.id };
  }
};
function getPaymentProvider() {
  const useMock = process.env["USE_PAYMENT_MOCK"] === "true" || process.env["FUNCTIONS_EMULATOR"] === "true" || !process.env["RAZORPAY_KEY_ID"];
  if (useMock) {
    const { mockProvider: mockProvider2 } = (init_mock_payment_provider(), __toCommonJS(mock_payment_provider_exports));
    return mockProvider2;
  }
  const keyId = process.env["RAZORPAY_KEY_ID"] ?? "";
  const keySecret = process.env["RAZORPAY_KEY_SECRET"] ?? "";
  const webhookSecret = process.env["RAZORPAY_WEBHOOK_SECRET"] ?? "";
  return new RazorpayProvider(keyId, keySecret, webhookSecret);
}

// src/functions/payment/initiatePayment.ts
var initiatePayment = (0, import_https21.onCall)({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  const data = validate(initiatePaymentSchema, request.data);
  const db = (0, import_firestore20.getFirestore)();
  const jobSnap = await db.collection(COLLECTIONS.jobs()).doc(data.jobId).get();
  if (!jobSnap.exists) throw new import_https21.HttpsError("not-found", "Job not found.");
  const job = jobSnap.data();
  const isOwner = job.customerId === user.uid;
  const isStudioOrAdmin = ["studio", "admin", "superadmin"].includes(user.claims.role);
  if (!isOwner && !isStudioOrAdmin) {
    throw new import_https21.HttpsError("permission-denied", "Cannot initiate payment for this job.");
  }
  if (job.tenantId !== user.claims.tenantId) {
    throw new import_https21.HttpsError("permission-denied", "Cross-tenant access denied.");
  }
  if (job.status === "CANCELLED") {
    throw new import_https21.HttpsError("failed-precondition", "Cannot pay for a cancelled job.");
  }
  const existingPayments = await db.collection(COLLECTIONS.payments()).where("jobId", "==", data.jobId).where("status", "in", ["pending", "processing", "completed"]).limit(1).get();
  if (!existingPayments.empty) {
    const existing = existingPayments.docs[0]?.data();
    if (existing?.status === "completed") {
      throw new import_https21.HttpsError("already-exists", "This job has already been paid.");
    }
    return { paymentId: existing.id, paymentUrl: null, status: existing.status };
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const paymentRef = db.collection(COLLECTIONS.payments()).doc();
  const amount = job.totalAmount;
  let paymentUrl = null;
  let razorpayPaymentLinkId = null;
  let razorpayOrderId = null;
  if (data.method === "razorpay_payment_link") {
    const provider = getPaymentProvider();
    const result = await provider.createPaymentLink({
      amount,
      currency: job.priceBreakdown.currency,
      bookingId: job.bookingId ?? job.id,
      description: `AutoDeck Job ${job.id}`,
      customerName: user.email ?? user.phone ?? "Customer",
      customerPhone: user.phone ?? "",
      referenceId: paymentRef.id
    });
    paymentUrl = result.paymentUrl;
    razorpayPaymentLinkId = result.providerPaymentLinkId;
    razorpayOrderId = result.providerOrderId;
  }
  const payment = {
    id: paymentRef.id,
    tenantId: job.tenantId,
    studioId: job.studioId,
    jobId: job.id,
    bookingId: job.bookingId,
    customerId: job.customerId,
    amount,
    currency: job.priceBreakdown.currency,
    method: data.method,
    status: "pending",
    razorpayPaymentLinkId,
    razorpayPaymentId: null,
    razorpayOrderId,
    razorpayRefundId: null,
    refundAmount: null,
    manualReference: null,
    recordedBy: null,
    invoiceId: null,
    providerEventId: null,
    completedAt: null,
    failedAt: null,
    cancelledAt: null,
    refundedAt: null,
    createdAt: now,
    updatedAt: now
  };
  await db.runTransaction(async (tx) => {
    tx.set(paymentRef, payment);
    writeAuditLog(tx, {
      action: "payment.initiated",
      entityType: "Payment",
      entityId: paymentRef.id,
      user,
      studioId: job.studioId,
      after: { jobId: job.id, bookingId: job.bookingId, amount, method: data.method, status: "pending" }
    });
  });
  return { paymentId: paymentRef.id, paymentUrl, status: "pending" };
});

// src/functions/payment/confirmPaymentMock.ts
var import_https22 = require("firebase-functions/v2/https");
var import_firestore21 = require("firebase-admin/firestore");

// src/lib/invoice-counter.ts
function formatInvoiceNumber(year, sequence) {
  return `INV-${year}-${String(sequence).padStart(5, "0")}`;
}
async function allocateInvoiceNumber(tx, db, tenantId) {
  const counterRef = db.collection(COLLECTIONS.invoiceCounters()).doc(tenantId);
  const snap = await tx.get(counterRef);
  const now = /* @__PURE__ */ new Date();
  const year = now.getUTCFullYear();
  let nextNumber = 1;
  if (snap.exists) {
    const data = snap.data();
    nextNumber = data.year === year ? data.nextNumber : 1;
  }
  const invoiceNumber = formatInvoiceNumber(year, nextNumber);
  tx.set(counterRef, {
    tenantId,
    nextNumber: nextNumber + 1,
    year
  });
  return invoiceNumber;
}

// src/lib/invoice-builder.ts
var import_node_crypto2 = require("node:crypto");
function buildInvoice(params) {
  const {
    invoiceId,
    invoiceNumber,
    tenantId,
    studioId,
    jobId,
    bookingId,
    customerId,
    vehicleId,
    priceBreakdown: pb,
    paymentId,
    serviceName
  } = params;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const lineItems = [
    {
      description: serviceName,
      quantity: 1,
      unitPrice: pb.basePrice + pb.scopeAdjustment,
      total: pb.basePrice + pb.scopeAdjustment
    }
  ];
  if (pb.pickupFee > 0) {
    lineItems.push({ description: "Pickup Fee", quantity: 1, unitPrice: pb.pickupFee, total: pb.pickupFee });
  }
  if (pb.dropFee > 0) {
    lineItems.push({ description: "Drop Fee", quantity: 1, unitPrice: pb.dropFee, total: pb.dropFee });
  }
  for (const addOn of pb.addOns) {
    lineItems.push({
      description: addOn.name,
      quantity: 1,
      unitPrice: addOn.price,
      total: addOn.price
    });
  }
  const subtotal = lineItems.reduce((sum, li) => sum + li.total, 0);
  return {
    id: invoiceId,
    tenantId,
    studioId,
    jobId,
    bookingId,
    customerId,
    vehicleId,
    paymentId,
    invoiceNumber,
    lineItems,
    subtotal,
    taxRatePercent: pb.taxRatePercent,
    taxDescription: pb.taxDescription,
    tax: pb.tax,
    total: pb.total,
    // must equal the source's totalAmount — never editable
    currency: pb.currency,
    status: paymentId ? "issued" : "draft",
    pdfUrl: null,
    publicToken: (0, import_node_crypto2.randomUUID)(),
    issuedAt: paymentId ? now : null,
    voidedAt: null,
    voidedReason: null,
    createdAt: now,
    updatedAt: now
  };
}

// src/functions/payment/confirmPaymentMock.ts
var confirmPaymentMock = (0, import_https22.onCall)({ region: "asia-south1" }, async (request) => {
  const isEmulator = process.env["FUNCTIONS_EMULATOR"] === "true" || process.env["USE_PAYMENT_MOCK"] === "true";
  if (!isEmulator) {
    throw new import_https22.HttpsError(
      "failed-precondition",
      "confirmPaymentMock is only available in emulator/dev environments."
    );
  }
  const user = extractUser(request);
  if (!["studio", "admin", "superadmin"].includes(user.claims.role)) {
    throw new import_https22.HttpsError("permission-denied", "Studio or admin role required.");
  }
  const data = validate(confirmPaymentMockSchema, request.data);
  const db = (0, import_firestore21.getFirestore)();
  const paymentSnap = await db.collection(COLLECTIONS.payments()).doc(data.paymentId).get();
  if (!paymentSnap.exists) throw new import_https22.HttpsError("not-found", "Payment not found.");
  const payment = paymentSnap.data();
  if (payment.tenantId !== user.claims.tenantId) {
    throw new import_https22.HttpsError("permission-denied", "Cross-tenant access denied.");
  }
  const mockEventId = `mock_${data.paymentId}_${data.mockResult}`;
  const eventRef = db.collection(COLLECTIONS.paymentEvents()).doc(mockEventId);
  const eventSnap = await eventRef.get();
  if (eventSnap.exists) {
    return { paymentId: data.paymentId, result: data.mockResult, idempotent: true };
  }
  if (payment.status !== "pending" && payment.status !== "processing") {
    throw new import_https22.HttpsError(
      "failed-precondition",
      `Payment is already in terminal state: ${payment.status}`
    );
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const isSuccess = data.mockResult === "success";
  await db.runTransaction(async (tx) => {
    if (isSuccess) {
      if (!payment.jobId) throw new import_https22.HttpsError("failed-precondition", "Payment has no linked job.");
      const jobSnap = await tx.get(db.collection(COLLECTIONS.jobs()).doc(payment.jobId));
      if (!jobSnap.exists) throw new import_https22.HttpsError("not-found", "Job not found.");
      const job = jobSnap.data();
      const invoiceRef = db.collection(COLLECTIONS.invoices()).doc();
      const invoiceNumber = await allocateInvoiceNumber(tx, db, job.tenantId);
      const invoice = buildInvoice({
        invoiceId: invoiceRef.id,
        invoiceNumber,
        tenantId: job.tenantId,
        studioId: job.studioId,
        jobId: job.id,
        bookingId: job.bookingId,
        customerId: job.customerId,
        vehicleId: job.vehicleId,
        priceBreakdown: job.priceBreakdown,
        paymentId: data.paymentId,
        serviceName: `Service ${job.serviceId}`
      });
      tx.set(eventRef, { paymentId: data.paymentId, result: data.mockResult, processedAt: now });
      tx.update(db.collection(COLLECTIONS.payments()).doc(data.paymentId), {
        status: "completed",
        razorpayPaymentId: `mock_pay_${Date.now()}`,
        invoiceId: invoiceRef.id,
        completedAt: now,
        updatedAt: now
      });
      tx.update(db.collection(COLLECTIONS.jobs()).doc(job.id), {
        paymentStatus: "paid",
        updatedAt: now
      });
      if (job.bookingId) {
        tx.update(db.collection(COLLECTIONS.bookings()).doc(job.bookingId), {
          paymentStatus: "paid",
          updatedAt: now
        });
      }
      tx.set(invoiceRef, invoice);
      writeAuditLog(tx, {
        action: "payment.completed",
        entityType: "Payment",
        entityId: data.paymentId,
        user,
        studioId: payment.studioId,
        after: { status: "completed", invoiceId: invoiceRef.id }
      });
      writeAuditLog(tx, {
        action: "invoice.issued",
        entityType: "Invoice",
        entityId: invoiceRef.id,
        user,
        studioId: payment.studioId,
        after: { invoiceNumber, total: invoice.total, status: "issued" }
      });
    } else {
      tx.set(eventRef, { paymentId: data.paymentId, result: data.mockResult, processedAt: now });
      tx.update(db.collection(COLLECTIONS.payments()).doc(data.paymentId), {
        status: "failed",
        failedAt: now,
        updatedAt: now
      });
      writeAuditLog(tx, {
        action: "payment.failed",
        entityType: "Payment",
        entityId: data.paymentId,
        user,
        studioId: payment.studioId,
        after: { status: "failed" }
      });
    }
  });
  return { paymentId: data.paymentId, result: data.mockResult, idempotent: false };
});

// src/functions/payment/recordManualPayment.ts
var import_https23 = require("firebase-functions/v2/https");
var import_firestore22 = require("firebase-admin/firestore");
var recordManualPayment = (0, import_https23.onCall)({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  if (!["studio", "admin", "superadmin"].includes(user.claims.role)) {
    throw new import_https23.HttpsError("permission-denied", "Studio or admin role required.");
  }
  const data = validate(recordManualPaymentSchema, request.data);
  const db = (0, import_firestore22.getFirestore)();
  const jobSnap = await db.collection(COLLECTIONS.jobs()).doc(data.jobId).get();
  if (!jobSnap.exists) throw new import_https23.HttpsError("not-found", "Job not found.");
  const job = jobSnap.data();
  if (job.tenantId !== user.claims.tenantId) {
    throw new import_https23.HttpsError("permission-denied", "Cross-tenant access denied.");
  }
  if (job.paymentStatus === "paid") {
    throw new import_https23.HttpsError("already-exists", "This job has already been marked as paid.");
  }
  if (job.status === "CANCELLED") {
    throw new import_https23.HttpsError("failed-precondition", "Cannot record payment for a cancelled job.");
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const paymentRef = db.collection(COLLECTIONS.payments()).doc();
  const invoiceRef = db.collection(COLLECTIONS.invoices()).doc();
  const amount = job.totalAmount;
  const payment = {
    id: paymentRef.id,
    tenantId: job.tenantId,
    studioId: job.studioId,
    jobId: job.id,
    bookingId: job.bookingId,
    customerId: job.customerId,
    amount,
    currency: job.priceBreakdown.currency,
    method: data.method,
    status: "completed",
    razorpayPaymentLinkId: null,
    razorpayPaymentId: null,
    razorpayOrderId: null,
    razorpayRefundId: null,
    refundAmount: null,
    manualReference: data.manualReference ?? null,
    recordedBy: user.uid,
    invoiceId: invoiceRef.id,
    providerEventId: null,
    completedAt: now,
    failedAt: null,
    cancelledAt: null,
    refundedAt: null,
    createdAt: now,
    updatedAt: now
  };
  await db.runTransaction(async (tx) => {
    const invoiceNumber = await allocateInvoiceNumber(tx, db, job.tenantId);
    const invoice = buildInvoice({
      invoiceId: invoiceRef.id,
      invoiceNumber,
      tenantId: job.tenantId,
      studioId: job.studioId,
      jobId: job.id,
      bookingId: job.bookingId,
      customerId: job.customerId,
      vehicleId: job.vehicleId,
      priceBreakdown: job.priceBreakdown,
      paymentId: paymentRef.id,
      serviceName: `Service ${job.serviceId}`
    });
    tx.set(paymentRef, payment);
    tx.set(invoiceRef, invoice);
    tx.update(db.collection(COLLECTIONS.jobs()).doc(job.id), {
      paymentStatus: "paid",
      updatedAt: now
    });
    if (job.bookingId) {
      tx.update(db.collection(COLLECTIONS.bookings()).doc(job.bookingId), {
        paymentStatus: "paid",
        updatedAt: now
      });
    }
    writeAuditLog(tx, {
      action: "payment.completed",
      entityType: "Payment",
      entityId: paymentRef.id,
      user,
      studioId: job.studioId,
      after: { method: data.method, amount, status: "completed", invoiceId: invoiceRef.id }
    });
    writeAuditLog(tx, {
      action: "invoice.issued",
      entityType: "Invoice",
      entityId: invoiceRef.id,
      user,
      studioId: job.studioId,
      after: { invoiceNumber, total: invoice.total, status: "issued" }
    });
  });
  return { paymentId: paymentRef.id, invoiceId: invoiceRef.id };
});

// src/functions/payment/getPaymentStatus.ts
var import_https24 = require("firebase-functions/v2/https");
var import_firestore23 = require("firebase-admin/firestore");
var getPaymentStatus = (0, import_https24.onCall)({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  const data = validate(getPaymentStatusSchema, request.data);
  const db = (0, import_firestore23.getFirestore)();
  const paymentsSnap = await db.collection(COLLECTIONS.payments()).where("jobId", "==", data.jobId).orderBy("createdAt", "desc").limit(1).get();
  if (paymentsSnap.empty) {
    return { payment: null };
  }
  const payment = paymentsSnap.docs[0]?.data();
  if (payment.tenantId !== user.claims.tenantId) {
    throw new import_https24.HttpsError("permission-denied", "Cross-tenant access denied.");
  }
  const isOwner = payment.customerId === user.uid;
  const isStudioOrAdmin = ["studio", "admin", "superadmin"].includes(user.claims.role);
  if (!isOwner && !isStudioOrAdmin) {
    throw new import_https24.HttpsError("permission-denied", "Access denied.");
  }
  if (user.claims.role === "customer") {
    return {
      payment: {
        id: payment.id,
        amount: payment.amount,
        currency: payment.currency,
        method: payment.method,
        status: payment.status,
        invoiceId: payment.invoiceId,
        completedAt: payment.completedAt
      }
    };
  }
  return { payment };
});

// src/functions/payment/initiateRefund.ts
var import_https25 = require("firebase-functions/v2/https");
var import_firestore24 = require("firebase-admin/firestore");
var initiateRefund = (0, import_https25.onCall)({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  if (!["admin", "superadmin"].includes(user.claims.role)) {
    throw new import_https25.HttpsError("permission-denied", "Admin role required to initiate refunds.");
  }
  const data = validate(initiateRefundSchema, request.data);
  const db = (0, import_firestore24.getFirestore)();
  const paymentSnap = await db.collection(COLLECTIONS.payments()).doc(data.paymentId).get();
  if (!paymentSnap.exists) throw new import_https25.HttpsError("not-found", "Payment not found.");
  const payment = paymentSnap.data();
  if (payment.tenantId !== user.claims.tenantId) {
    throw new import_https25.HttpsError("permission-denied", "Cross-tenant access denied.");
  }
  if (payment.status !== "completed") {
    throw new import_https25.HttpsError(
      "failed-precondition",
      "Can only refund completed payments."
    );
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  let providerRefundId = null;
  if (payment.method === "razorpay_payment_link" && payment.razorpayPaymentId) {
    const provider = getPaymentProvider();
    const result = await provider.initiateRefund({
      providerPaymentId: payment.razorpayPaymentId,
      amount: payment.amount,
      reason: data.reason,
      referenceId: `refund_${data.paymentId}_${Date.now()}`
    });
    providerRefundId = result.providerRefundId;
  }
  await db.runTransaction(async (tx) => {
    const invoiceSnap = payment.invoiceId ? await tx.get(db.collection(COLLECTIONS.invoices()).doc(payment.invoiceId)) : null;
    tx.update(db.collection(COLLECTIONS.payments()).doc(data.paymentId), {
      status: "refunded",
      razorpayRefundId: providerRefundId,
      refundAmount: payment.amount,
      refundedAt: now,
      updatedAt: now
    });
    if (payment.invoiceId && invoiceSnap) {
      if (invoiceSnap.exists) {
        const invoice = invoiceSnap.data();
        if (invoice.status !== "void") {
          tx.update(db.collection(COLLECTIONS.invoices()).doc(payment.invoiceId), {
            status: "void",
            voidedAt: now,
            voidedReason: `Refund initiated: ${data.reason}`,
            updatedAt: now
          });
          writeAuditLog(tx, {
            action: "invoice.voided",
            entityType: "Invoice",
            entityId: payment.invoiceId,
            user,
            studioId: payment.studioId,
            after: { status: "void", reason: data.reason }
          });
        }
      }
    }
    if (payment.jobId) {
      tx.update(db.collection(COLLECTIONS.jobs()).doc(payment.jobId), {
        paymentStatus: "refunded",
        updatedAt: now
      });
    }
    if (payment.bookingId) {
      tx.update(db.collection(COLLECTIONS.bookings()).doc(payment.bookingId), {
        paymentStatus: "refunded",
        updatedAt: now
      });
    }
    writeAuditLog(tx, {
      action: "payment.refunded",
      entityType: "Payment",
      entityId: data.paymentId,
      user,
      studioId: payment.studioId,
      after: {
        status: "refunded",
        reason: data.reason,
        refundAmount: payment.amount,
        providerRefundId
      }
    });
  });
  return { paymentId: data.paymentId, refunded: true, providerRefundId };
});

// src/functions/invoice/getInvoice.ts
var import_https26 = require("firebase-functions/v2/https");
var import_firestore25 = require("firebase-admin/firestore");

// src/schemas/invoice.ts
var import_zod7 = require("zod");
var getInvoiceSchema = import_zod7.z.object({
  invoiceId: import_zod7.z.string().min(1)
});
var voidInvoiceSchema = import_zod7.z.object({
  invoiceId: import_zod7.z.string().min(1),
  reason: import_zod7.z.string().min(1).max(500)
});

// src/functions/invoice/getInvoice.ts
var getInvoice = (0, import_https26.onCall)({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  const data = validate(getInvoiceSchema, request.data);
  const db = (0, import_firestore25.getFirestore)();
  const invoiceSnap = await db.collection(COLLECTIONS.invoices()).doc(data.invoiceId).get();
  if (!invoiceSnap.exists) throw new import_https26.HttpsError("not-found", "Invoice not found.");
  const invoice = invoiceSnap.data();
  if (invoice.tenantId !== user.claims.tenantId) {
    throw new import_https26.HttpsError("permission-denied", "Cross-tenant access denied.");
  }
  const isOwner = invoice.customerId === user.uid;
  const isStudioOrAdmin = ["studio", "admin", "superadmin"].includes(user.claims.role);
  if (!isOwner && !isStudioOrAdmin) {
    throw new import_https26.HttpsError("permission-denied", "Access denied.");
  }
  return { invoice };
});

// src/functions/invoice/voidInvoice.ts
var import_https27 = require("firebase-functions/v2/https");
var import_firestore26 = require("firebase-admin/firestore");
var voidInvoice = (0, import_https27.onCall)({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  if (!["admin", "superadmin"].includes(user.claims.role)) {
    throw new import_https27.HttpsError("permission-denied", "Admin role required to void invoices.");
  }
  const data = validate(voidInvoiceSchema, request.data);
  const db = (0, import_firestore26.getFirestore)();
  const invoiceSnap = await db.collection(COLLECTIONS.invoices()).doc(data.invoiceId).get();
  if (!invoiceSnap.exists) throw new import_https27.HttpsError("not-found", "Invoice not found.");
  const invoice = invoiceSnap.data();
  if (invoice.tenantId !== user.claims.tenantId) {
    throw new import_https27.HttpsError("permission-denied", "Cross-tenant access denied.");
  }
  if (invoice.status === "void") {
    throw new import_https27.HttpsError("failed-precondition", "Invoice is already void.");
  }
  if (invoice.status === "paid") {
    throw new import_https27.HttpsError(
      "failed-precondition",
      "Cannot void a paid invoice. Initiate a refund first."
    );
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  await db.runTransaction(async (tx) => {
    tx.update(db.collection(COLLECTIONS.invoices()).doc(data.invoiceId), {
      status: "void",
      voidedAt: now,
      voidedReason: data.reason,
      updatedAt: now
    });
    writeAuditLog(tx, {
      action: "invoice.voided",
      entityType: "Invoice",
      entityId: data.invoiceId,
      user,
      studioId: invoice.studioId,
      before: { status: invoice.status },
      after: { status: "void", reason: data.reason }
    });
  });
  return { invoiceId: data.invoiceId, voided: true };
});

// src/functions/studio/updateStudioSettings.ts
var import_https28 = require("firebase-functions/v2/https");
var import_firestore27 = require("firebase-admin/firestore");

// src/schemas/studio.ts
var import_zod8 = require("zod");
var bayTypeEnum2 = import_zod8.z.enum(["wash", "protection", "general"]);
var operatingHoursSchema = import_zod8.z.object({
  dayOfWeek: import_zod8.z.union([
    import_zod8.z.literal(0),
    import_zod8.z.literal(1),
    import_zod8.z.literal(2),
    import_zod8.z.literal(3),
    import_zod8.z.literal(4),
    import_zod8.z.literal(5),
    import_zod8.z.literal(6)
  ]),
  open: import_zod8.z.string().regex(/^\d{2}:\d{2}$/, "open must be HH:mm"),
  close: import_zod8.z.string().regex(/^\d{2}:\d{2}$/, "close must be HH:mm"),
  closed: import_zod8.z.boolean()
});
var updateStudioSettingsSchema = import_zod8.z.object({
  studioId: import_zod8.z.string().min(1),
  name: import_zod8.z.string().min(1).max(100).trim().optional(),
  timezone: import_zod8.z.string().min(1).max(64).optional(),
  operatingHours: import_zod8.z.array(operatingHoursSchema).length(7).optional(),
  taxRatePercent: import_zod8.z.number().min(0).max(100).optional(),
  taxDescription: import_zod8.z.string().min(1).max(100).trim().optional()
});
var addHolidaySchema = import_zod8.z.object({
  studioId: import_zod8.z.string().min(1),
  date: import_zod8.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  reason: import_zod8.z.string().max(200).trim().optional()
});
var removeHolidaySchema = import_zod8.z.object({
  studioId: import_zod8.z.string().min(1),
  date: import_zod8.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD")
});
var upsertBaySchema = import_zod8.z.object({
  studioId: import_zod8.z.string().min(1),
  bayId: import_zod8.z.string().min(1).optional(),
  // omit to create a new bay
  name: import_zod8.z.string().min(1).max(100).trim(),
  bayType: bayTypeEnum2,
  active: import_zod8.z.boolean()
});

// src/functions/studio/updateStudioSettings.ts
var updateStudioSettings = (0, import_https28.onCall)({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "admin", "superadmin");
  const data = validate(updateStudioSettingsSchema, request.data);
  const db = (0, import_firestore27.getFirestore)();
  const ref = db.collection(COLLECTIONS.studioConfig()).doc(data.studioId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new import_https28.HttpsError("not-found", "Studio not found.");
    const existing = snap.data();
    assertTenant(user, existing.tenantId);
    const updates = { updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
    if (data.name !== void 0) updates["name"] = data.name;
    if (data.timezone !== void 0) updates["timezone"] = data.timezone;
    if (data.operatingHours !== void 0) updates["operatingHours"] = data.operatingHours;
    if (data.taxRatePercent !== void 0) updates["taxRatePercent"] = data.taxRatePercent;
    if (data.taxDescription !== void 0) updates["taxDescription"] = data.taxDescription;
    tx.update(ref, updates);
    writeAuditLog(tx, {
      action: "studio.config_updated",
      entityType: "StudioConfig",
      entityId: data.studioId,
      user,
      studioId: data.studioId,
      before: {
        name: existing.name,
        timezone: existing.timezone,
        taxRatePercent: existing.taxRatePercent
      },
      after: updates,
      metadata: { change: "settings_updated" }
    });
  });
  return { studioId: data.studioId };
});

// src/functions/studio/addHoliday.ts
var import_https29 = require("firebase-functions/v2/https");
var import_firestore28 = require("firebase-admin/firestore");
var addHoliday = (0, import_https29.onCall)({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "admin", "superadmin");
  const data = validate(addHolidaySchema, request.data);
  const db = (0, import_firestore28.getFirestore)();
  const ref = db.collection(COLLECTIONS.studioConfig()).doc(data.studioId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new import_https29.HttpsError("not-found", "Studio not found.");
    const existing = snap.data();
    assertTenant(user, existing.tenantId);
    if (existing.holidays.includes(data.date)) {
      throw new import_https29.HttpsError("already-exists", "Holiday already added for this date.");
    }
    tx.update(ref, {
      holidays: import_firestore28.FieldValue.arrayUnion(data.date),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    writeAuditLog(tx, {
      action: "studio.config_updated",
      entityType: "StudioConfig",
      entityId: data.studioId,
      user,
      studioId: data.studioId,
      after: { date: data.date, reason: data.reason ?? null },
      metadata: { change: "holiday.added" }
    });
  });
  return { studioId: data.studioId, date: data.date };
});

// src/functions/studio/removeHoliday.ts
var import_https30 = require("firebase-functions/v2/https");
var import_firestore29 = require("firebase-admin/firestore");
var removeHoliday = (0, import_https30.onCall)({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "admin", "superadmin");
  const data = validate(removeHolidaySchema, request.data);
  const db = (0, import_firestore29.getFirestore)();
  const ref = db.collection(COLLECTIONS.studioConfig()).doc(data.studioId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new import_https30.HttpsError("not-found", "Studio not found.");
    const existing = snap.data();
    assertTenant(user, existing.tenantId);
    if (!existing.holidays.includes(data.date)) {
      throw new import_https30.HttpsError("not-found", "Holiday not found for this date.");
    }
    tx.update(ref, {
      holidays: import_firestore29.FieldValue.arrayRemove(data.date),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    writeAuditLog(tx, {
      action: "studio.config_updated",
      entityType: "StudioConfig",
      entityId: data.studioId,
      user,
      studioId: data.studioId,
      before: { date: data.date },
      metadata: { change: "holiday.removed" }
    });
  });
  return { studioId: data.studioId, date: data.date };
});

// src/functions/studio/upsertBay.ts
var import_https31 = require("firebase-functions/v2/https");
var import_firestore30 = require("firebase-admin/firestore");
var upsertBay = (0, import_https31.onCall)({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "admin", "superadmin");
  const data = validate(upsertBaySchema, request.data);
  const db = (0, import_firestore30.getFirestore)();
  const ref = db.collection(COLLECTIONS.studioConfig()).doc(data.studioId);
  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new import_https31.HttpsError("not-found", "Studio not found.");
    const existing = snap.data();
    assertTenant(user, existing.tenantId);
    let bays;
    let bayId;
    let change;
    let before = null;
    if (data.bayId) {
      const index = existing.bays.findIndex((b) => b.id === data.bayId);
      const existingBay = index === -1 ? null : existing.bays[index];
      if (!existingBay) throw new import_https31.HttpsError("not-found", "Bay not found.");
      before = { ...existingBay };
      const updatedBay = {
        ...existingBay,
        name: data.name,
        bayType: data.bayType,
        active: data.active
      };
      bays = [...existing.bays];
      bays[index] = updatedBay;
      bayId = data.bayId;
      change = "resource.updated";
    } else {
      const newRef = db.collection(COLLECTIONS.studioConfig()).doc();
      const newBay = {
        id: newRef.id,
        tenantId: existing.tenantId,
        studioId: data.studioId,
        name: data.name,
        bayType: data.bayType,
        active: data.active
      };
      bays = [...existing.bays, newBay];
      bayId = newBay.id;
      change = "resource.created";
    }
    tx.update(ref, { bays, updatedAt: (/* @__PURE__ */ new Date()).toISOString() });
    writeAuditLog(tx, {
      action: "studio.config_updated",
      entityType: "Bay",
      entityId: bayId,
      user,
      studioId: data.studioId,
      before,
      after: { name: data.name, bayType: data.bayType, active: data.active },
      metadata: { change }
    });
    return { bayId };
  });
  return { studioId: data.studioId, bayId: result.bayId };
});

// src/functions/employee/addStaffMember.ts
var import_https32 = require("firebase-functions/v2/https");
var import_firestore31 = require("firebase-admin/firestore");
var import_auth32 = require("firebase-admin/auth");

// src/schemas/employee.ts
var import_zod9 = require("zod");
var staffRoleEnum = import_zod9.z.enum(["studio", "admin"]);
var addStaffMemberSchema = import_zod9.z.object({
  name: import_zod9.z.string().min(2).max(100).trim(),
  email: import_zod9.z.string().email().trim(),
  password: import_zod9.z.string().min(8).max(128),
  phone: import_zod9.z.string().max(20).trim().optional(),
  role: staffRoleEnum,
  studioId: import_zod9.z.string().min(1).nullable()
});
var updateStaffRoleSchema = import_zod9.z.object({
  employeeId: import_zod9.z.string().min(1),
  role: staffRoleEnum,
  studioId: import_zod9.z.string().min(1).nullable()
});
var deactivateStaffMemberSchema = import_zod9.z.object({
  employeeId: import_zod9.z.string().min(1)
});

// src/functions/employee/addStaffMember.ts
var addStaffMember = (0, import_https32.onCall)({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "admin", "superadmin");
  const data = validate(addStaffMemberSchema, request.data);
  if (data.role === "admin" && data.studioId !== null) {
    throw new import_https32.HttpsError(
      "invalid-argument",
      "Tenant admins are not studio-scoped \u2014 studioId must be null for role 'admin'."
    );
  }
  if (data.role === "studio" && data.studioId === null) {
    throw new import_https32.HttpsError("invalid-argument", "Studio staff require a studioId.");
  }
  const db = (0, import_firestore31.getFirestore)();
  const adminAuth = (0, import_auth32.getAuth)();
  const tenantId = user.claims.tenantId;
  const existing = await adminAuth.getUserByEmail(data.email).catch(() => null);
  if (existing) {
    throw new import_https32.HttpsError("already-exists", "An account with this email already exists.");
  }
  const authUser = await adminAuth.createUser({
    email: data.email,
    password: data.password,
    displayName: data.name,
    emailVerified: false
  });
  await adminAuth.setCustomUserClaims(authUser.uid, {
    role: data.role,
    tenantId,
    studioId: data.studioId
  });
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const employeeRef = db.collection(COLLECTIONS.employees()).doc(authUser.uid);
  const employee = {
    id: authUser.uid,
    tenantId,
    studioId: data.studioId,
    authUid: authUser.uid,
    name: data.name,
    phone: data.phone ?? "",
    role: data.role,
    active: true,
    createdAt: now,
    updatedAt: now,
    terminatedAt: null
  };
  await db.runTransaction(async (tx) => {
    tx.set(employeeRef, employee);
    writeAuditLog(tx, {
      action: "employee.created",
      entityType: "Employee",
      entityId: authUser.uid,
      user,
      studioId: data.studioId,
      after: { name: data.name, role: data.role, studioId: data.studioId }
    });
  });
  return { employeeId: authUser.uid };
});

// src/functions/employee/updateStaffRole.ts
var import_https33 = require("firebase-functions/v2/https");
var import_firestore32 = require("firebase-admin/firestore");
var import_auth34 = require("firebase-admin/auth");
var updateStaffRole = (0, import_https33.onCall)({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "admin", "superadmin");
  const data = validate(updateStaffRoleSchema, request.data);
  if (data.role === "admin" && data.studioId !== null) {
    throw new import_https33.HttpsError(
      "invalid-argument",
      "Tenant admins are not studio-scoped \u2014 studioId must be null for role 'admin'."
    );
  }
  if (data.role === "studio" && data.studioId === null) {
    throw new import_https33.HttpsError("invalid-argument", "Studio staff require a studioId.");
  }
  const db = (0, import_firestore32.getFirestore)();
  const ref = db.collection(COLLECTIONS.employees()).doc(data.employeeId);
  const snap = await ref.get();
  if (!snap.exists) throw new import_https33.HttpsError("not-found", "Employee not found.");
  const existing = snap.data();
  assertTenant(user, existing.tenantId);
  if (existing.terminatedAt) {
    throw new import_https33.HttpsError("failed-precondition", "Cannot change role of a terminated employee.");
  }
  const adminAuth = (0, import_auth34.getAuth)();
  await adminAuth.setCustomUserClaims(existing.authUid, {
    role: data.role,
    tenantId: existing.tenantId,
    studioId: data.studioId
  });
  const now = (/* @__PURE__ */ new Date()).toISOString();
  await db.runTransaction(async (tx) => {
    tx.update(ref, { role: data.role, studioId: data.studioId, updatedAt: now });
    writeAuditLog(tx, {
      action: "employee.role_changed",
      entityType: "Employee",
      entityId: data.employeeId,
      user,
      studioId: data.studioId,
      before: { role: existing.role, studioId: existing.studioId },
      after: { role: data.role, studioId: data.studioId }
    });
  });
  return { employeeId: data.employeeId, role: data.role };
});

// src/functions/employee/deactivateStaffMember.ts
var import_https34 = require("firebase-functions/v2/https");
var import_firestore33 = require("firebase-admin/firestore");
var import_auth36 = require("firebase-admin/auth");
var deactivateStaffMember = (0, import_https34.onCall)({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "admin", "superadmin");
  const data = validate(deactivateStaffMemberSchema, request.data);
  const db = (0, import_firestore33.getFirestore)();
  const ref = db.collection(COLLECTIONS.employees()).doc(data.employeeId);
  const snap = await ref.get();
  if (!snap.exists) throw new import_https34.HttpsError("not-found", "Employee not found.");
  const existing = snap.data();
  assertTenant(user, existing.tenantId);
  if (existing.terminatedAt) {
    return { employeeId: data.employeeId, alreadyTerminated: true };
  }
  const adminAuth = (0, import_auth36.getAuth)();
  await adminAuth.updateUser(existing.authUid, { disabled: true });
  await adminAuth.revokeRefreshTokens(existing.authUid);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  await db.runTransaction(async (tx) => {
    tx.update(ref, { active: false, terminatedAt: now, updatedAt: now });
    writeAuditLog(tx, {
      action: "employee.deactivated",
      entityType: "Employee",
      entityId: data.employeeId,
      user,
      studioId: existing.studioId,
      before: { active: true },
      after: { active: false, terminatedAt: now }
    });
  });
  return { employeeId: data.employeeId, alreadyTerminated: false };
});

// src/functions/health.ts
var import_https35 = require("firebase-functions/v2/https");
var import_firestore34 = require("firebase-admin/firestore");
var healthCheck = (0, import_https35.onCall)(
  { region: "asia-south1" },
  async (_request) => {
    const db = (0, import_firestore34.getFirestore)();
    await db.collection("_health").doc("ping").set({ ts: (/* @__PURE__ */ new Date()).toISOString() });
    return { status: "ok", region: "asia-south1" };
  }
);

// src/index.ts
(0, import_app.initializeApp)();
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  addHoliday,
  addStaffMember,
  advanceJobStatus,
  archiveVehicle,
  assignBay,
  calculateServicePrice,
  cancelBooking,
  confirmPaymentMock,
  createBooking,
  createService,
  createVehicle,
  createWalkinJob,
  deactivateStaffMember,
  getAvailability,
  getInvoice,
  getMyBookings,
  getPaymentStatus,
  getServiceCatalogue,
  getStudioJobs,
  healthCheck,
  initiatePayment,
  initiateRefund,
  recordManualPayment,
  removeHoliday,
  rescheduleBooking,
  setServiceActive,
  setupCustomerProfile,
  updateService,
  updateStaffRole,
  updateStudioSettings,
  updateVehicle,
  upsertBay,
  voidInvoice
});
//# sourceMappingURL=index.js.map
