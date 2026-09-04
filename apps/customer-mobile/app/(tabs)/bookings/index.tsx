import { FlatList, View } from 'react-native';
import { router } from 'expo-router';
import { spacingScale } from '@autodeck/design-tokens';
import { RequireAuth } from '../../../src/auth/RequireAuth';
import { Badge, Card, EmptyState, Screen, ThemedText, Touchable } from '../../../src/ui/primitives';
import { FadeInView } from '../../../src/ui/motion';
import { MOCK_BOOKINGS } from '../../../src/mocks/bookings.mock';
import { formatPaiseAsRupees } from '../../../src/mocks/pricing.mirror';

const STATUS_TONE = {
  booked: 'neutral',
  in_progress: 'accent',
  approval_required: 'warning',
  completed: 'success',
  sealed: 'success',
  cancelled: 'danger',
} as const;

export default function BookingsScreen() {
  return (
    <RequireAuth>
      <Screen>
        <View style={{ padding: spacingScale.lg, flex: 1, gap: spacingScale.lg }}>
          <ThemedText level="display">Bookings</ThemedText>
          <FlatList
            data={MOCK_BOOKINGS}
            keyExtractor={(item) => item.bookingId}
            contentContainerStyle={{ gap: spacingScale.md }}
            ListEmptyComponent={<EmptyState message="No bookings yet." />}
            renderItem={({ item, index }) => (
              <FadeInView delay={index * 60}>
                <Touchable onPress={() => router.push(`/(tabs)/bookings/${item.bookingId}`)}>
                  <Card>
                    <ThemedText level="subheading">{item.serviceName}</ThemedText>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacingScale.sm }}>
                      <Badge label={item.status.replace('_', ' ')} tone={STATUS_TONE[item.status]} />
                      <ThemedText level="body" color="secondary" tabularFigures>
                        {formatPaiseAsRupees(item.totalPaise)}
                      </ThemedText>
                    </View>
                  </Card>
                </Touchable>
              </FadeInView>
            )}
          />
        </View>
      </Screen>
    </RequireAuth>
  );
}
