/**
 * Fixture data only, for the "Care Balance" visual treatment requested in
 * the premium-UI pass. Represents a customer's PURCHASED package instance
 * (quantity used/remaining) — this is distinct from `packages.mock.ts`'s
 * `MockPackageDefinition`, which is the admin-defined, pre-purchase TYPE.
 *
 * FUTURE SCHEMA DEPENDENCY: there is no `CustomerPackage` schema in
 * `packages/domain` yet (see the approved design-gate review, Gate 8) —
 * this fixture exists purely so the owned-package UI can be designed and
 * verified now, per this pass's explicit instruction to "use fixtures/mock
 * data where necessary" rather than touch the domain schema. No purchase
 * flow exists; this is a fixed, already-owned example only.
 */
export interface MockOwnedPackage {
  packageDefinitionId: string;
  name: string;
  totalQty: number;
  usedQty: number;
  remainingQty: number;
  validUntil: string;
}

export const MOCK_OWNED_PACKAGES: MockOwnedPackage[] = [
  {
    packageDefinitionId: 'pkg-10-washes',
    name: 'Care Balance',
    totalQty: 10,
    usedQty: 2,
    remainingQty: 8,
    validUntil: '2027-02-14',
  },
];
