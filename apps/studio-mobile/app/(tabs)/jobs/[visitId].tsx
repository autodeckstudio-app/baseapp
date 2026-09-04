import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { spacingScale } from '@autodeck/design-tokens';
import { Badge, Button, Card, Divider, ErrorState, Screen, ThemedText } from '../../../src/ui/primitives';
import { StatusRail } from '../../../src/ui/domain/StatusRail';
import { ApprovalCard } from '../../../src/ui/domain/ApprovalCard';
import { FadeInView } from '../../../src/ui/motion';
import { findMockJobByVisitId } from '../../../src/mocks/jobs.mock';
import { findMockVehicleById } from '../../../src/mocks/vehicles.mock';
import { findMockCustomerById } from '../../../src/mocks/customers.mock';
import { formatPaiseAsRupees } from '../../../src/mocks/format';

/**
 * The most important Studio screen. Actions correspond exactly to real
 * backend capabilities (`VisitsController`: check-in, complete, seal;
 * `ApprovalsController`: request/resolve — all `@Roles('staff')`, so no
 * per-role action gating is needed here, matching the actual RBAC matrix
 * from the Studio+Admin audit). No live network call is wired in this
 * UI-only pass — pressing an action shows a local, clearly-mocked
 * acknowledgement, the same pattern used for customer-mobile's booking
 * flow and ApprovalCard.
 */
export default function JobDetailScreen() {
  const { visitId } = useLocalSearchParams<{ visitId: string }>();
  const job = findMockJobByVisitId(visitId);
  const [lastAction, setLastAction] = useState<string | null>(null);

  if (!job) {
    return (
      <Screen>
        <ErrorState message="Job not found." />
      </Screen>
    );
  }

  const vehicle = findMockVehicleById(job.vehicleId);
  const customer = findMockCustomerById(job.customerId);
  const scheduled = new Date(job.scheduledAt).toLocaleString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  function recordAction(label: string) {
    setLastAction(`${label} — recorded locally only; no live backend call is wired in this pass.`);
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacingScale.lg, gap: spacingScale.lg }}>
        <Button variant="ghost" onPress={() => router.back()}>
          Back
        </Button>

        <FadeInView>
          <View style={{ gap: spacingScale.lg }}>
            <View>
              <ThemedText level="display" tabularFigures>
                {vehicle?.plate ?? 'Unknown vehicle'}
              </ThemedText>
              <ThemedText level="body" color="secondary">
                {vehicle?.make} {vehicle?.model} · {customer?.name ?? 'Unknown customer'}
              </ThemedText>
              <ThemedText level="caption" color="secondary" tabularFigures style={{ marginTop: spacingScale.xs }}>
                Booking {job.bookingId} · {scheduled}
              </ThemedText>
            </View>

            <Card elevation="raised">
              <ThemedText level="subheading" style={{ marginBottom: spacingScale.md }}>
                {job.serviceName}
              </ThemedText>
              <StatusRail status={job.status} />
            </Card>

            {job.status === 'approval_required' && job.approval && <ApprovalCard request={job.approval} />}

            <Card>
              <ThemedText level="subheading" style={{ marginBottom: spacingScale.sm }}>
                Booking
              </ThemedText>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <ThemedText level="body" color="secondary">
                  Total
                </ThemedText>
                <ThemedText level="body" tabularFigures>
                  {formatPaiseAsRupees(job.totalPaise)}
                </ThemedText>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacingScale.xs }}>
                <ThemedText level="body" color="secondary">
                  Advance
                </ThemedText>
                <ThemedText level="body" tabularFigures>
                  {job.advanceRequired ? formatPaiseAsRupees(job.advancePaise) : 'Not required'}
                </ThemedText>
              </View>
              {(job.bay || job.assignedStaffName) && (
                <>
                  <Divider style={{ marginVertical: spacingScale.sm }} />
                  {job.bay && (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <ThemedText level="body" color="secondary">
                        Bay
                      </ThemedText>
                      <ThemedText level="body">{job.bay}</ThemedText>
                    </View>
                  )}
                  {job.assignedStaffName && (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacingScale.xs }}>
                      <ThemedText level="body" color="secondary">
                        Assigned to
                      </ThemedText>
                      <ThemedText level="body">{job.assignedStaffName}</ThemedText>
                    </View>
                  )}
                  <ThemedText level="caption" color="secondary" style={{ marginTop: spacingScale.sm }}>
                    Bay and staff assignment are fixture-only — no backend field exists for either yet.
                  </ThemedText>
                </>
              )}
            </Card>

            <JobActions status={job.status} onAction={recordAction} />

            {lastAction && (
              <Card>
                <ThemedText level="caption" color="secondary">
                  {lastAction}
                </ThemedText>
              </Card>
            )}
          </View>
        </FadeInView>
      </ScrollView>
    </Screen>
  );
}

function JobActions({ status, onAction }: { status: string; onAction: (label: string) => void }) {
  if (status === 'booked') {
    return <Button onPress={() => onAction('Checked in')}>Check In</Button>;
  }
  if (status === 'in_progress') {
    return (
      <View style={{ gap: spacingScale.sm }}>
        <Button onPress={() => onAction('Marked complete')}>Complete Job</Button>
        <Button variant="secondary" onPress={() => onAction('Approval requested')}>
          Request Approval
        </Button>
      </View>
    );
  }
  if (status === 'completed') {
    return <Button onPress={() => onAction('Sealed')}>Seal</Button>;
  }
  if (status === 'sealed') {
    return <Badge label="Sealed — no further action" tone="success" />;
  }
  if (status === 'cancelled') {
    return <Badge label="Cancelled" tone="danger" />;
  }
  return null;
}
