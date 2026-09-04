'use client';

import { Card, ThemedText } from '../../ui/primitives';
import { MOCK_BOOKINGS } from '../../mocks/bookings.mock';
import { MOCK_CUSTOMER_PACKAGES } from '../../mocks/packages.mock';
import { MOCK_PAYMENTS } from '../../mocks/payments.mock';
import { formatPaiseAsRupees } from '../../mocks/format';

/**
 * Business-level overview using fixture data throughout — there is no
 * aggregation backend (confirmed in the Studio+Admin audit), so these are
 * counts computed client-side over fixture records, not production
 * metrics. No vanity metrics: every card is something an owner would
 * actually act on today.
 */
export default function OverviewPage() {
  const todaysBookings = MOCK_BOOKINGS.length;
  const activeJobs = MOCK_BOOKINGS.filter((b) => b.status === 'in_progress').length;
  const pendingApprovals = MOCK_BOOKINGS.filter((b) => b.status === 'approval_required').length;
  const completedJobs = MOCK_BOOKINGS.filter((b) => b.status === 'completed' || b.status === 'sealed').length;
  const packagesSold = MOCK_CUSTOMER_PACKAGES.length;
  const paymentsCollected = MOCK_PAYMENTS.filter((p) => p.status === 'paid').reduce((sum, p) => sum + p.amountPaise, 0);

  const cards = [
    { label: "Today's bookings", value: todaysBookings },
    { label: 'Active jobs', value: activeJobs },
    { label: 'Pending approvals', value: pendingApprovals },
    { label: 'Completed jobs', value: completedJobs },
    { label: 'Packages sold', value: packagesSold },
    { label: 'Payments collected', value: formatPaiseAsRupees(paymentsCollected) },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <ThemedText level="display">Overview</ThemedText>
        <ThemedText level="caption" color="secondary">
          Fixture data — no production reporting backend exists yet (see the Studio+Admin audit).
        </ThemedText>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
        {cards.map((card) => (
          <Card key={card.label} elevation="raised">
            <ThemedText level="display" tabularFigures>
              {card.value}
            </ThemedText>
            <ThemedText level="caption" color="secondary">
              {card.label}
            </ThemedText>
          </Card>
        ))}
      </div>
    </div>
  );
}
