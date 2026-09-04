import type { Customer } from '@autodeck/domain';

/**
 * Fixture data. Uses the REAL `Customer` type from `@autodeck/domain`
 * ({customerId, name, phone, email}) — no invented fields. Studio reads
 * customer records directly against Firestore in production (per
 * `firestore.rules`'s `customers/{id}` rule, `isStaffPlus()`); this
 * fixture stands in for that live query in this UI-only pass.
 */
export const MOCK_CUSTOMERS: Customer[] = [
  { customerId: 'cust-1', name: 'Aditi Shah', phone: '+91 98250 11223', email: 'aditi.shah@example.com' },
  { customerId: 'cust-2', name: 'Rohan Mehta', phone: '+91 98240 55667', email: 'rohan.mehta@example.com' },
];

export function findMockCustomerById(customerId: string): Customer | undefined {
  return MOCK_CUSTOMERS.find((c) => c.customerId === customerId);
}
