/**
 * Canonical Firestore collection paths for AutoDeck.
 * All paths are functions to enforce required parameters and prevent typos.
 * Multi-tenant: every operational collection requires tenantId to be passed.
 */

// Root collections
export const COLLECTIONS = {
  tenants: () => "tenants",
  customers: () => "customers",
  vehicles: () => "vehicles",
  bookings: () => "bookings",
  jobs: () => "jobs",
  approvals: () => "approvals",
  payments: () => "payments",
  invoices: () => "invoices",
  warranties: () => "warranties",
  // inspections/{jobId} — one per job (id == jobId), same pattern as warranties
  inspections: () => "inspections",
  memberships: () => "memberships",
  membershipPlans: () => "membershipPlans",
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
  paymentEvents: () => "paymentEvents",
  // rateLimits/{tenantId__uid__action} — server-only fixed-window abuse counters
  rateLimits: () => "rateLimits",
} as const;

// Subcollection paths
export const SUBCOLLECTIONS = {
  membershipUsage: (membershipId: string) => `memberships/${membershipId}/usage`,
  // jobPhotos: deferred capability (Phase 3F/3H audit) — job.statusHistory[]
  // is the embedded-array successor to the old jobStatusHistory subcollection
  // design, which has been removed; jobPhotos has no superseding mechanism
  // and is kept as the reserved path for that still-unbuilt capability.
  jobPhotos: (jobId: string) => `jobs/${jobId}/photos`,
  vehicleProtections: (vehicleId: string) => `vehicles/${vehicleId}/protections`,
} as const;

// Document paths
export const DOC_PATHS = {
  tenant: (tenantId: string) => `tenants/${tenantId}`,
  customer: (customerId: string) => `customers/${customerId}`,
  vehicle: (vehicleId: string) => `vehicles/${vehicleId}`,
  booking: (bookingId: string) => `bookings/${bookingId}`,
  job: (jobId: string) => `jobs/${jobId}`,
  approval: (approvalId: string) => `approvals/${approvalId}`,
  payment: (paymentId: string) => `payments/${paymentId}`,
  invoice: (invoiceId: string) => `invoices/${invoiceId}`,
  warranty: (warrantyId: string) => `warranties/${warrantyId}`,
  membership: (membershipId: string) => `memberships/${membershipId}`,
  membershipPlan: (planId: string) => `membershipPlans/${planId}`,
  membershipUsage: (membershipId: string, usageId: string) =>
    `memberships/${membershipId}/usage/${usageId}`,
  service: (serviceId: string) => `services/${serviceId}`,
  employee: (employeeId: string) => `employees/${employeeId}`,
  studioConfig: (studioId: string) => `studioConfig/${studioId}`,
  auditEntry: (entryId: string) => `auditLog/${entryId}`,
} as const;
