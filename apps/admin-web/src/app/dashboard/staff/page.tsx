'use client';

import { Badge, Table, ThemedText, type TableColumn } from '../../../ui/primitives';
import { MOCK_STAFF, type MockStaff } from '../../../mocks/staff.mock';

const ROLE_LABEL = { staff: 'Staff', studio_manager: 'Studio Manager', owner_admin: 'Owner/Admin' } as const;

/**
 * Job Title (display metadata) is shown as plain text; Permission Role
 * (the only thing that authorizes anything, per `role.type.ts` and
 * `firestore.rules`) is shown as a Badge — a deliberate visual distinction
 * so the two are never confused, per the approved rule.
 */
export default function StaffPage() {
  const columns: TableColumn<MockStaff & { id: string }>[] = [
    { key: 'name', header: 'Name', render: (r) => r.name },
    { key: 'email', header: 'Email', render: (r) => r.email },
    { key: 'jobTitle', header: 'Job Title (display only)', render: (r) => r.jobTitle },
    { key: 'role', header: 'Permission Role', render: (r) => <Badge label={ROLE_LABEL[r.permissionRole]} tone="accent" /> },
    { key: 'active', header: 'Status', render: (r) => <Badge label={r.active ? 'Active' : 'Inactive'} tone={r.active ? 'success' : 'neutral'} /> },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <ThemedText level="display">Staff</ThemedText>
        <ThemedText level="caption" color="secondary">
          Job Title is display metadata only. Permission Role is the sole basis for authorization, enforced server-side.
        </ThemedText>
      </div>
      <Table columns={columns} rows={MOCK_STAFF.map((s) => ({ ...s, id: s.staffId }))} emptyMessage="No staff accounts." />
    </div>
  );
}
