'use client';

import { useMemo, useState } from 'react';
import { Field, Table, ThemedText, type TableColumn } from '../../../ui/primitives';
import { StatusBadge } from '../../../ui/domain/StatusBadge';
import { MOCK_BOOKINGS, type MockBookingRow } from '../../../mocks/bookings.mock';
import { MOCK_CUSTOMERS } from '../../../mocks/customers.mock';
import { MOCK_VEHICLES } from '../../../mocks/vehicles.mock';
import { formatPaiseAsRupees } from '../../../mocks/format';

export default function BookingsPage() {
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return MOCK_BOOKINGS.filter((b) => {
      if (!q) return true;
      const customer = MOCK_CUSTOMERS.find((c) => c.customerId === b.customerId);
      const vehicle = MOCK_VEHICLES.find((v) => v.vehicleId === b.vehicleId);
      return (
        b.serviceName.toLowerCase().includes(q) ||
        customer?.name.toLowerCase().includes(q) ||
        vehicle?.plate.toLowerCase().includes(q)
      );
    });
  }, [query]);

  const columns: TableColumn<MockBookingRow & { id: string }>[] = [
    { key: 'booking', header: 'Booking', render: (r) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{r.bookingId}</span> },
    { key: 'customer', header: 'Customer', render: (r) => MOCK_CUSTOMERS.find((c) => c.customerId === r.customerId)?.name ?? '—' },
    { key: 'vehicle', header: 'Vehicle', render: (r) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{MOCK_VEHICLES.find((v) => v.vehicleId === r.vehicleId)?.plate ?? '—'}</span> },
    { key: 'service', header: 'Service', render: (r) => r.serviceName },
    { key: 'when', header: 'Date/time', render: (r) => new Date(r.scheduledAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'payment', header: 'Payment', render: (r) => r.paymentStatus.replace('_', ' ') },
    { key: 'total', header: 'Total', align: 'right', render: (r) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatPaiseAsRupees(r.totalPaise)}</span> },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <ThemedText level="display">Bookings</ThemedText>
      <div style={{ maxWidth: 320 }}>
        <Field label="Search" placeholder="Customer, vehicle, or service" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <Table columns={columns} rows={rows.map((r) => ({ ...r, id: r.bookingId }))} emptyMessage="No matching bookings." />
    </div>
  );
}
