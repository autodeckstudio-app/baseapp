import { Card, EmptyState } from '../../ui/primitives';

/** Placeholder only — per Phase 3A scope, business screens (staff,
 * services, bookings, packages, inventory, audit log) are later phases. */
export default function DashboardHomePage() {
  return (
    <Card>
      <EmptyState message="AutoDeck Admin foundation is set up. Business screens will be built in a later phase." />
    </Card>
  );
}
