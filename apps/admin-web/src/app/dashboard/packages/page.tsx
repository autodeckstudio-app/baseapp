'use client';

import { Card, Table, ThemedText, type TableColumn } from '../../../ui/primitives';
import { MOCK_CUSTOMER_PACKAGES, MOCK_PACKAGE_DEFINITIONS, type MockCustomerPackage, type MockPackageDefinition } from '../../../mocks/packages.mock';
import { MOCK_CUSTOMERS } from '../../../mocks/customers.mock';
import { formatPaiseAsRupees } from '../../../mocks/format';

/**
 * Two clearly separate sections, per the approved rule: prepaid packages,
 * never Silver/Gold/Platinum/membership/subscription language anywhere.
 */
export default function PackagesPage() {
  const definitionColumns: TableColumn<MockPackageDefinition & { id: string }>[] = [
    { key: 'name', header: 'Package', render: (r) => r.name },
    { key: 'quantity', header: 'Included quantity', align: 'right', render: (r) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{r.quantity}</span> },
    { key: 'price', header: 'Price', align: 'right', render: (r) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatPaiseAsRupees(r.price)}</span> },
    { key: 'validity', header: 'Validity', render: (r) => `${r.validityDuration.value} ${r.validityDuration.unit}${r.validityDuration.value > 1 ? 's' : ''}` },
  ];

  const ownedColumns: TableColumn<MockCustomerPackage & { id: string }>[] = [
    { key: 'customer', header: 'Customer', render: (r) => MOCK_CUSTOMERS.find((c) => c.customerId === r.customerId)?.name ?? '—' },
    { key: 'package', header: 'Package', render: (r) => r.packageName },
    { key: 'total', header: 'Total', align: 'right', render: (r) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{r.totalQty}</span> },
    { key: 'used', header: 'Used', align: 'right', render: (r) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{r.usedQty}</span> },
    { key: 'remaining', header: 'Remaining', align: 'right', render: (r) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{r.remainingQty}</span> },
    { key: 'purchased', header: 'Purchased', render: (r) => r.purchasedAt },
    { key: 'expires', header: 'Expires', render: (r) => r.expiresAt },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      <ThemedText level="display">Packages</ThemedText>

      <Card>
        <ThemedText level="heading" style={{ marginBottom: 16 }}>
          Package Definitions
        </ThemedText>
        <Table
          columns={definitionColumns}
          rows={MOCK_PACKAGE_DEFINITIONS.map((p) => ({ ...p, id: p.packageDefinitionId }))}
          emptyMessage="No package types defined."
        />
      </Card>

      <Card>
        <ThemedText level="heading" style={{ marginBottom: 4 }}>
          Customer Purchased Packages
        </ThemedText>
        <ThemedText level="caption" color="secondary" style={{ marginBottom: 16 }}>
          No `CustomerPackage` schema exists in `packages/domain` yet — fixture data only.
        </ThemedText>
        <Table columns={ownedColumns} rows={MOCK_CUSTOMER_PACKAGES.map((p) => ({ ...p }))} emptyMessage="No packages purchased yet." />
      </Card>
    </div>
  );
}
