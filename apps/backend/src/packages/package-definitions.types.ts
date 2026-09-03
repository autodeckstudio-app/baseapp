import type { PackageDefinition } from '@autodeck/domain';

/**
 * The `packageDefinitions/{id}` Firestore document shape — the admin-
 * defined, sellable catalogue entry (e.g. "10 Washes"). Extends the
 * pre-existing `PackageDefinition` domain type (packages/domain/src/
 * packages.ts) with the same backend-only bookkeeping fields every other
 * record type has, rather than re-declaring its shape.
 */
export interface PackageDefinitionRecord extends PackageDefinition {
  createdAt: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue;
  createdByStaffId: string;
}
