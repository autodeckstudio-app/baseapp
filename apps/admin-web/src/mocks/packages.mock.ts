/**
 * Fixture data, kept in two clearly separate shapes per the approved
 * "prepaid packages, not memberships" rule — never Silver/Gold/Platinum.
 *
 * `MockPackageDefinition` mirrors the REAL `PackageDefinition` schema from
 * `packages/domain/src/packages.ts` exactly (packageDefinitionId, name,
 * includedServiceId, quantity, price, validityDuration).
 *
 * `MockCustomerPackage` mirrors what a `customerPackages/{id}` Firestore
 * document would hold — there is NO shared `CustomerPackage` schema in
 * `packages/domain` yet (identified in the customer-mobile design-gate
 * review, Gate 8), so this is a documented placeholder, not a real type.
 */
export interface MockPackageDefinition {
  packageDefinitionId: string;
  name: string;
  includedServiceId: string;
  quantity: number;
  price: number;
  validityDuration: { unit: 'day' | 'month' | 'year'; value: number };
}

export const MOCK_PACKAGE_DEFINITIONS: MockPackageDefinition[] = [
  { packageDefinitionId: 'pkg-4-washes', name: '4 Washes', includedServiceId: 'svc-wash-premium', quantity: 4, price: 360_000, validityDuration: { unit: 'month', value: 3 } },
  { packageDefinitionId: 'pkg-10-washes', name: '10 Washes', includedServiceId: 'svc-wash-premium', quantity: 10, price: 850_000, validityDuration: { unit: 'month', value: 6 } },
];

export interface MockCustomerPackage {
  id: string;
  customerId: string;
  packageDefinitionId: string;
  packageName: string;
  totalQty: number;
  usedQty: number;
  remainingQty: number;
  purchasedAt: string;
  expiresAt: string;
}

export const MOCK_CUSTOMER_PACKAGES: MockCustomerPackage[] = [
  {
    id: 'cp-1',
    customerId: 'cust-1',
    packageDefinitionId: 'pkg-10-washes',
    packageName: '10 Washes',
    totalQty: 10,
    usedQty: 2,
    remainingQty: 8,
    purchasedAt: '2026-08-14',
    expiresAt: '2027-02-14',
  },
];
