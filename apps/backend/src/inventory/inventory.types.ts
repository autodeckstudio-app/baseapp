/**
 * The `inventory/{id}` Firestore document shape — a single studio-level
 * stock item (e.g. "Wax", "Microfiber Cloths"). Per the approved product
 * decisions ("Minimal inventory in V1 — stock levels, studio-level stock"),
 * this is deliberately flat: no recipes, no supplier data, no reordering
 * metadata — all explicitly deferred ("Advanced inventory: recipes,
 * supplier management, reordering workflows" is Later/Post-V1).
 *
 * `currentStock` is a CONTESTED COUNTER: it is only ever mutated inside a
 * Firestore transaction (see inventory.service.ts's `restock`/`recordUsage`)
 * — never through a generic update endpoint. `lowStockThreshold` is purely
 * configuration consumed by the pre-existing `isLowStock` domain function
 * (packages/domain/src/inventory.ts, Phase 2A) — it is not itself a
 * derived/stored "is low" flag, which would risk staleness.
 */
export interface InventoryItemRecord {
  inventoryItemId: string; // backend-generated Firestore document ID
  name: string;
  currentStock: number; // integer, nonnegative
  lowStockThreshold: number; // integer, nonnegative
  createdAt: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue;
  createdByStaffId: string;
}

/**
 * The `inventoryUsage/{id}` Firestore document shape — one deduction event.
 * Deliberately has no bookingId/visitId/vehicleId: the approved product
 * decision only ever says "record/deduct usage where applicable," with no
 * requirement to tie a deduction to any other entity (mirrors the identical
 * resolution already made for `packageUsage` in Phase 2H).
 */
export interface InventoryUsageRecord {
  inventoryUsageId: string; // backend-generated Firestore document ID
  inventoryItemId: string;
  quantityUsed: number;
  usedAt: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue;
  usedByStaffId: string;
}
