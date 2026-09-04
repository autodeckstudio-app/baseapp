/**
 * Fixture data only. `packageDefinitionId`, `name`, `includedServiceId`,
 * `quantity`, `price`, `validityDuration` mirror the real
 * `packages/domain/src/packages.ts` `PackageDefinition` schema exactly —
 * these are admin-defined package TYPES, not a customer's purchased
 * instance. Per the approved rules: prepaid packages, NOT memberships — no
 * tier/renewal framing anywhere here.
 *
 * FUTURE SCHEMA DEPENDENCY: there is no `CustomerPackage` (purchased
 * instance — totalQty/usedQty/remainingQty/purchaseDate/expiresAt) schema
 * in `packages/domain` yet (see the approved design-gate review, Gate 8).
 * This pass only implements the public, pre-purchase browse screen for
 * that reason — "My Packages"/usage is not in this phase list.
 */
export interface MockPackageDefinition {
  packageDefinitionId: string;
  name: string;
  includedServiceId: string;
  quantity: number;
  price: number; // paise, 100% upfront
  validityDuration: { unit: 'day' | 'month' | 'year'; value: number };
}

export const MOCK_PACKAGE_DEFINITIONS: MockPackageDefinition[] = [
  {
    packageDefinitionId: 'pkg-4-washes',
    name: '4 Washes',
    includedServiceId: 'svc-wash-premium',
    quantity: 4,
    price: 360_000,
    validityDuration: { unit: 'month', value: 3 },
  },
  {
    packageDefinitionId: 'pkg-10-washes',
    name: '10 Washes',
    includedServiceId: 'svc-wash-premium',
    quantity: 10,
    price: 850_000,
    validityDuration: { unit: 'month', value: 6 },
  },
];
