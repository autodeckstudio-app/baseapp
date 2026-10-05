// Shared rules for the test-data cleanup. Accounts are KEPT by uid prefix. Everything else is a candidate.
export const KEEP_PREFIXES = ["A25nOd0l", "PDBRkiAk", "T3jKcHze", "QKik649E"]; // Meet, studio staff, admin, Gauri Dhote
export const isKept = (uid) => KEEP_PREFIXES.some((p) => uid.startsWith(p));
export const OWNER_FIELDS = ["ownerId", "customerId", "userId", "uid"];
// Collections whose docs belong to a customer. auditLog, rateLimits, services, studioConfig, staff etc. are never touched.
export const OWNED = ["vehicles", "bookings", "jobs", "payments", "invoices", "approvals", "papers", "memberships", "notifications", "pickupRequests", "reviews", "warranties", "inspections", "membershipUsage", "accountDeletionRequests", "carLeads"];
