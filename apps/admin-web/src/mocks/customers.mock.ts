import type { Customer } from '@autodeck/domain';

/** Fixture data using the REAL `Customer` type from `@autodeck/domain`. Production reads are direct-Firestore (`customers/{id}`, `isStaffPlus()`). */
export const MOCK_CUSTOMERS: Customer[] = [
  { customerId: 'cust-1', name: 'Aditi Shah', phone: '+91 98250 11223', email: 'aditi.shah@example.com' },
  { customerId: 'cust-2', name: 'Rohan Mehta', phone: '+91 98240 55667', email: 'rohan.mehta@example.com' },
  { customerId: 'cust-3', name: 'Priya Nair', phone: '+91 98790 33445', email: 'priya.nair@example.com' },
];
