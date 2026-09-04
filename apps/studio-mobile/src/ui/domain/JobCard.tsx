import { View } from 'react-native';
import { spacingScale } from '@autodeck/design-tokens';
import { Card, ThemedText } from '../primitives';
import { StatusRail } from './StatusRail';
import { formatPaiseAsRupees } from '../../mocks/format';
import type { MockJob } from '../../mocks/jobs.mock';
import { findMockVehicleById } from '../../mocks/vehicles.mock';
import { findMockCustomerById } from '../../mocks/customers.mock';

/**
 * The core operational work-item card — Today and Jobs both use this
 * (promoted per the Expo design-system rule: 2+ screens, nameable role,
 * small API). Information-dense by design: vehicle, customer, service,
 * time, status, and bay/assignment all visible without a tap, matching
 * the approved "very fast scanning" requirement.
 */
export function JobCard({ job }: { job: MockJob }) {
  const vehicle = findMockVehicleById(job.vehicleId);
  const customer = findMockCustomerById(job.customerId);
  const time = new Date(job.scheduledAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  return (
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <ThemedText level="subheading" tabularFigures>
            {vehicle?.plate ?? 'Unknown vehicle'}
          </ThemedText>
          <ThemedText level="caption" color="secondary">
            {vehicle?.make} {vehicle?.model} · {customer?.name ?? 'Unknown customer'}
          </ThemedText>
        </View>
        <ThemedText level="caption" color="secondary" tabularFigures>
          {time}
        </ThemedText>
      </View>

      <ThemedText level="body" style={{ marginTop: spacingScale.sm }}>
        {job.serviceName}
      </ThemedText>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacingScale.sm }}>
        <StatusRail status={job.status} compact />
        <ThemedText level="caption" color="secondary" tabularFigures>
          {formatPaiseAsRupees(job.totalPaise)}
        </ThemedText>
      </View>

      {(job.bay || job.assignedStaffName) && (
        <ThemedText level="caption" color="secondary" style={{ marginTop: spacingScale.xs }}>
          {[job.bay, job.assignedStaffName].filter(Boolean).join(' · ')}
        </ThemedText>
      )}
    </Card>
  );
}
