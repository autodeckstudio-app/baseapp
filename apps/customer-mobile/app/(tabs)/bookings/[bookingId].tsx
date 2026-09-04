import { ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { spacingScale } from '@autodeck/design-tokens';
import { RequireAuth } from '../../../src/auth/RequireAuth';
import { Button, Card, ErrorState, Screen, ThemedText } from '../../../src/ui/primitives';
import { StatusRail } from '../../../src/ui/domain/StatusRail';
import { ApprovalCard } from '../../../src/ui/domain/ApprovalCard';
import { FadeInView } from '../../../src/ui/motion';
import { findMockBookingById } from '../../../src/mocks/bookings.mock';
import { formatPaiseAsRupees } from '../../../src/mocks/pricing.mirror';

export default function BookingStatusScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const booking = findMockBookingById(bookingId);

  return (
    <RequireAuth>
      <Screen>
        <ScrollView contentContainerStyle={{ padding: spacingScale.lg, gap: spacingScale.lg }}>
          <Button variant="ghost" onPress={() => router.back()}>
            Back
          </Button>

          {!booking ? (
            <ErrorState message="Booking not found." />
          ) : (
            <FadeInView>
              <ThemedText level="display" style={{ marginBottom: spacingScale.md }}>
                {booking.serviceName}
              </ThemedText>
              <Card elevation="raised" style={{ marginBottom: spacingScale.md }}>
                <StatusRail status={booking.status} />
              </Card>

              {booking.status === 'approval_required' && booking.approvalRequest && (
                <FadeInView delay={100}>
                  <ApprovalCard request={booking.approvalRequest} />
                </FadeInView>
              )}

              <Card style={{ marginTop: spacingScale.md }}>
                <ThemedText level="subheading" style={{ marginBottom: spacingScale.xs }}>
                  Payment
                </ThemedText>
                <ThemedText level="body" tabularFigures>
                  Total: {formatPaiseAsRupees(booking.totalPaise)}
                </ThemedText>
                <ThemedText level="caption" color="secondary" tabularFigures>
                  {booking.advanceRequired
                    ? `Advance paid: ${formatPaiseAsRupees(booking.advancePaise)}`
                    : 'No advance was required for this booking.'}
                </ThemedText>
              </Card>
            </FadeInView>
          )}
        </ScrollView>
      </Screen>
    </RequireAuth>
  );
}
