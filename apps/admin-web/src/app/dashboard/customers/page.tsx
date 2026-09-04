'use client';

import type { Customer } from '@autodeck/domain';
import { Table, ThemedText, type TableColumn } from '../../../ui/primitives';
import { MOCK_CUSTOMERS } from '../../../mocks/customers.mock';
import { MOCK_VEHICLES } from '../../../mocks/vehicles.mock';
import { MOCK_BOOKINGS } from '../../../mocks/bookings.mock';
import { MOCK_CUSTOMER_PACKAGES } from '../../../mocks/packages.mock';

export default function CustomersPage() {
  const columns: TableColumn<Customer & { id: string }>[] = [
    { key: 'name', header: 'Customer', render: (r) => r.name },
    { key: 'contact', header: 'Phone / Email', render: (r) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{r.phone} · {r.email}</span> },
    { key: 'vehicles', header: 'Vehicles', render: (r) => MOCK_VEHICLES.filter((v) => v.ownerCustomerId === r.customerId).length },
    { key: 'bookings', header: 'Bookings', render: (r) => MOCK_BOOKINGS.filter((b) => b.customerId === r.customerId).length },
    { key: 'packages', header: 'Packages owned', render: (r) => MOCK_CUSTOMER_PACKAGES.filter((p) => p.customerId === r.customerId).length },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <ThemedText level="display">Customers</ThemedText>
      <Table columns={columns} rows={MOCK_CUSTOMERS.map((c) => ({ ...c, id: c.customerId }))} emptyMessage="No customers on file." />
    </div>
  );
}
