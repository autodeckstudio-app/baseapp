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
  // Tombstones for permanently deleted cars (doc id == old vehicleId); Cloud Functions write only.
  deletedVehicles: () => "deletedVehicles",
  bookings: () => "bookings",
  pickupRequests: () => "pickupRequests",
  accountDeletionRequests: () => "accountDeletionRequests",
  jobs: () => "jobs",
  approvals: () => "approvals",
  // Staff-to-admin approval requests (distinct from customer additional-work approvals)
  adminApprovalRequests: () => "adminApprovalRequests",
  payments: () => "payments",
  // Staff-only attention items (reason code + references, no customer data). Cloud Function writes only.
  staffAlerts: () => "staffAlerts",
  invoices: () => "invoices",
  warranties: () => "warranties",
  // inspections/{jobId} — one per job (id == jobId), same pattern as warranties
  inspections: () => "inspections",
  memberships: () => "memberships",
  membershipPlans: () => "membershipPlans",
  services: () => "services",
  employees: () => "employees",
  attendance: () => "attendance",
  // staffAccessRequests/{uid} - a signed-in person asking the admin for studio access
  staffAccessRequests: () => "staffAccessRequests",
  expenses: () => "expenses",
  inventoryItems: () => "inventoryItems",
  inventoryTxns: () => "inventoryTxns",
  papers: () => "papers",
  dailyClosings: () => "dailyClosings",
  gallery: () => "gallery",
  stories: () => "stories",
  offers: () => "offers",
  jobMessages: () => "jobMessages",
  /** Gift-a-wash codes (hashed). Server only; rules deny all client access. */
  gifts: () => "gifts",
  /** Failed gift-code attempts per account and per network address, for the lockout. Server only. */
  giftAttempts: () => "giftAttempts",
  /** Server only (default-deny rules): the plain gift code, so a buyer who closed the app after paying can get it again. */
  giftSecrets: () => "giftSecrets",
  /** Server only (default-deny rules): one in-flight gift purchase per buyer, serializes concurrent createGift calls. */
  giftPurchaseSlots: () => "giftPurchaseSlots",
  carListings: () => "carListings",
  carLeads: () => "carLeads",
  studioConfig: () => "studioConfig",
  auditLog: () => "auditLog",
  notifications: () => "notifications",
  // reviews/{bookingId} — one customer rating per completed booking (Cloud Function write only)
  reviews: () => "reviews",
  bookingIntents: () => "bookingIntents",
  // invoiceCounters/{tenantId} — atomic invoice number counter (Admin SDK only)
  invoiceCounters: () => "invoiceCounters",
  // paymentEvents/{providerEventId} — idempotency guard for webhook/event deduplication
  // refundRequests/{requestId} — booking refund outbox: reservation -> provider -> projection
  refundRequests: () => "refundRequests",
  // paymentRefunds/pr_<paymentId>_<providerRefundId> — durable per-refund
  // identity ledger: one doc per provider refund, written transactionally
  // with its projection so the same refund can never be counted twice
  // across webhook event types, duplicate deliveries, or code paths.
  paymentRefunds: () => "paymentRefunds",
  paymentEvents: () => "paymentEvents",
  // shopRateLimits/{hashedKey} — shared abuse-limiter windows (server only)
  shopRateLimits: () => "shopRateLimits",
  // rateLimits/{tenantId__uid__action} — server-only fixed-window abuse counters
  rateLimits: () => "rateLimits",
  // bayLocks/{tenantId__studioId__bayId} — server-only deterministic-document
  // touch used to give Firestore's transaction conflict detection a
  // document-version-based signal for bay-assignment races. Firestore
  // transactions do NOT reliably detect a "phantom" conflict from a QUERY
  // whose result set changes due to a concurrent transaction's write
  // (confirmed empirically, Phase 7 hostile audit) — reading and writing a
  // query result alone is not sufficient to serialize two concurrent
  // callers racing for the same bay. Reading+writing this specific document
  // measurably reduces (empirically: ~50%→~10-15% failure rate under
  // adversarial back-to-back stress testing) that race, but does NOT fully
  // eliminate it — repeated stress-testing still shows occasional
  // double-assignment. This is a KNOWN, OPEN, documented gap requiring a
  // proper claim/lock document with a real lifecycle as follow-up work, not
  // a complete fix. See createBooking.ts's usage and the corresponding test
  // file comments for the full account. Never read directly for any other
  // purpose — it carries no meaningful data, only a version.
  bayLocks: () => "bayLocks",
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
