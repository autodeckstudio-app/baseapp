'use client';

import { Badge, Table, ThemedText, type TableColumn } from '../../../ui/primitives';
import { MOCK_PAYMENTS, type MockPayment } from '../../../mocks/payments.mock';
import { MOCK_CUSTOMERS } from '../../../mocks/customers.mock';
import { formatPaiseAsRupees } from '../../../mocks/format';

const STATUS_TONE = { created: 'neutral', paid: 'success', failed: 'danger', refunded: 'warning' } as const;

/** Individual payment records only — no revenue aggregation is implied or fabricated. */
export default function PaymentsPage() {
  const columns: TableColumn<MockPayment & { id: string }>[] = [
    { key: 'ref', header: 'Payment / Order', render: (r) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{r.paymentId}</span> },
    { key: 'for', header: 'Booking / Package', render: (r) => r.bookingId ?? r.customerPackageId ?? '—' },
    { key: 'customer', header: 'Customer', render: (r) => MOCK_CUSTOMERS.find((c) => c.customerId === r.customerId)?.name ?? '—' },
    { key: 'amount', header: 'Amount', align: 'right', render: (r) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatPaiseAsRupees(r.amountPaise)}</span> },
    { key: 'status', header: 'Status', render: (r) => <Badge label={r.status} tone={STATUS_TONE[r.status]} /> },
    { key: 'date', header: 'Date', render: (r) => new Date(r.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <ThemedText level="display">Payments</ThemedText>
      <Table columns={columns} rows={MOCK_PAYMENTS.map((p) => ({ ...p, id: p.paymentId }))} emptyMessage="No payment records." />
    </div>
  );
}
