/**
 * The `services/{id}` Firestore document shape.
 *
 * Deliberately the same three fields as the pre-existing `Service`/
 * `ServiceSchema` in `packages/domain/src/types.ts` (serviceId, name,
 * basePrice, in paise) — that domain type is the shape's source of truth,
 * and this module introduces no new or different field. It is declared
 * locally here rather than imported, matching the existing convention of
 * every other backend module (`StaffRecord`, `CustomerRecord`,
 * `VehicleRecord` are all likewise local interfaces, not imports from
 * `@autodeck/domain`, which the backend package does not currently depend
 * on at all). Wiring a real runtime dependency on `@autodeck/domain` is
 * squarely a Phase 2E (Bookings) concern, since that is the first module
 * that actually calls `computePriceSnapshot` with live service data — not
 * introduced here.
 */
export interface ServiceRecord {
  serviceId: string; // backend-generated Firestore document ID
  name: string;
  basePrice: number; // integer, paise — never client-overridable after creation without going through updateService
  createdAt: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue;
  createdByStaffId: string;
}
