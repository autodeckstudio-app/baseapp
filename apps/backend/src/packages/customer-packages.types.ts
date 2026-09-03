/**
 * The `customerPackages/{id}` Firestore document shape — one customer's
 * purchased instance of a package definition. `totalQty`, `pricePaid`, and
 * `expiresAt` are all snapshotted once at purchase time from the
 * referenced `packageDefinitions/{id}` and never re-derived afterward —
 * the same "snapshot at commitment, never silently recompute" principle
 * Phase 2E established for `BookingRecord.priceSnapshot`. A later change to
 * the package definition's own price/quantity/validity never retroactively
 * affects an already-purchased CustomerPackage.
 */
export interface CustomerPackageRecord {
  customerPackageId: string; // backend-generated Firestore document ID
  customerId: string;
  packageDefinitionId: string;
  totalQty: number;
  usedQty: number;
  remainingQty: number;
  pricePaid: number; // integer, paise — snapshotted from packageDefinitions/{id}.price at purchase time
  purchaseDate: FirebaseFirestore.Timestamp;
  expiresAt: FirebaseFirestore.Timestamp;
  createdAt: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue;
  createdByStaffId: string;
}

/**
 * The `packageUsage/{id}` Firestore document shape — one redemption event.
 * Always represents exactly one unit consumed (see ConsumePackageUsageDto).
 */
export interface PackageUsageRecord {
  packageUsageId: string; // backend-generated Firestore document ID
  customerPackageId: string;
  customerId: string; // denormalized from the customer package, required by the existing packageUsage/{id} Firestore rule's ownership read-check
  vehicleId: string;
  usedAt: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue;
  usedByStaffId: string;
}
