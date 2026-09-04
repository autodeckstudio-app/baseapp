'use client';

import { useState } from 'react';
import { Badge, Button, Card, Field, Table, ThemedText, type TableColumn } from '../../../ui/primitives';
import { MOCK_SERVICES, type MockServiceRow } from '../../../mocks/services.mock';
import { formatPaiseAsRupees } from '../../../mocks/format';

/**
 * Admin CRUD UI over the EXISTING `Service` model
 * (`serviceId`/`name`/`basePrice`, real backend endpoints:
 * `POST/PATCH` on `ServicesController`, `@Roles('studio_manager')`).
 * `category`/`duration` are shown but explicitly marked as a proposed,
 * not-yet-real schema extension — never presented as already backed.
 * The "Add Service" form is display-only in this pass: no live network
 * call is wired, per the explicit scope rule against new functionality.
 */
export default function ServicesPage() {
  const [showForm, setShowForm] = useState(false);

  const columns: TableColumn<MockServiceRow & { id: string }>[] = [
    { key: 'name', header: 'Service', render: (r) => r.name },
    { key: 'price', header: 'Price', align: 'right', render: (r) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatPaiseAsRupees(r.basePrice)}</span> },
    { key: 'category', header: 'Category*', render: (r) => r.category },
    { key: 'duration', header: 'Duration*', align: 'right', render: (r) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{r.durationMinutes} min</span> },
    { key: 'active', header: 'Status', render: (r) => <Badge label={r.active ? 'Active' : 'Inactive'} tone={r.active ? 'success' : 'neutral'} /> },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <ThemedText level="display">Services</ThemedText>
          <ThemedText level="caption" color="secondary">
            *Category and duration are proposed fields pending a schema decision — not part of the real Service model yet.
          </ThemedText>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>{showForm ? 'Cancel' : 'Add Service'}</Button>
      </div>

      {showForm && (
        <Card elevation="raised">
          <ThemedText level="subheading" style={{ marginBottom: 12 }}>
            New service
          </ThemedText>
          <Field label="Name" placeholder="e.g. Ceramic Coating — Prolong" />
          <Field label="Base price (₹)" type="number" placeholder="10000" />
          <ThemedText level="caption" color="secondary" style={{ marginBottom: 12 }}>
            This form is not connected to a live endpoint in this pass.
          </ThemedText>
          <Button disabled>Save (not wired)</Button>
        </Card>
      )}

      <Table columns={columns} rows={MOCK_SERVICES.map((s) => ({ ...s, id: s.serviceId }))} emptyMessage="No services in the catalogue." />
    </div>
  );
}
