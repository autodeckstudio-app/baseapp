'use client';

import type { Vehicle } from '@autodeck/domain';
import { Table, ThemedText, type TableColumn } from '../../../ui/primitives';
import { MOCK_VEHICLES } from '../../../mocks/vehicles.mock';
import { MOCK_CUSTOMERS } from '../../../mocks/customers.mock';
import { MOCK_BOOKINGS } from '../../../mocks/bookings.mock';

export default function VehiclesPage() {
  const columns: TableColumn<Vehicle & { id: string }>[] = [
    { key: 'plate', header: 'Plate', render: (r) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{r.plate}</span> },
    { key: 'vehicle', header: 'Vehicle', render: (r) => `${r.make} ${r.model}` },
    { key: 'customer', header: 'Customer', render: (r) => MOCK_CUSTOMERS.find((c) => c.customerId === r.ownerCustomerId)?.name ?? '—' },
    { key: 'history', header: 'Service history', render: (r) => MOCK_BOOKINGS.filter((b) => b.vehicleId === r.vehicleId).length },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <ThemedText level="display">Vehicles</ThemedText>
      <Table columns={columns} rows={MOCK_VEHICLES.map((v) => ({ ...v, id: v.vehicleId }))} emptyMessage="No vehicles on file." />
    </div>
  );
}
