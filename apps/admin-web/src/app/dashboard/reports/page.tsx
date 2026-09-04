'use client';

import { Card, ThemedText } from '../../../ui/primitives';

/**
 * No reporting/analytics backend exists (confirmed in the Studio+Admin
 * audit) — a premium "coming soon" state, not fabricated charts, per the
 * explicit instruction not to imply production-backed analytics.
 */
export default function ReportsPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <ThemedText level="display">Reports</ThemedText>
      <Card elevation="raised" style={{ padding: 48, textAlign: 'center' }}>
        <ThemedText level="heading" style={{ marginBottom: 8 }}>
          Coming soon
        </ThemedText>
        <ThemedText level="body" color="secondary">
          Revenue, job-completion, and package-sales reporting require aggregation infrastructure that doesn't exist
          yet. This section is reserved, not implemented.
        </ThemedText>
      </Card>
    </div>
  );
}
