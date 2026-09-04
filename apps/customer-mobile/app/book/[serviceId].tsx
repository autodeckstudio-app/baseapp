import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { radiusScale, spacingScale } from '@autodeck/design-tokens';
import { RequireAuth } from '../../src/auth/RequireAuth';
import { Button, Card, Divider, ErrorState, Screen, ThemedText } from '../../src/ui/primitives';
import { useThemeColors } from '../../src/ui/theme';
import { findMockServiceById } from '../../src/mocks/services.mock';
import { MOCK_VEHICLES } from '../../src/mocks/vehicles.mock';
import { computeMockPriceSnapshot, formatPaiseAsRupees } from '../../src/mocks/pricing.mirror';

const MOCK_SLOTS = ['Tomorrow, 10:00 AM', 'Tomorrow, 2:00 PM', 'Thu, 11:00 AM'];

/**
 * Mock-data booking flow — no backend, no real payment, no submission.
 * Wrapped in `RequireAuth` defensively (a direct deep link here should
 * still gate, even though Service Detail already gates the entry tap),
 * per the approved "protected screens redirect to Login contextually"
 * requirement.
 */
export default function BookingFlowScreen() {
  const { serviceId } = useLocalSearchParams<{ serviceId: string }>();
  const service = findMockServiceById(serviceId);
  const colors = useThemeColors();

  const [vehicleId, setVehicleId] = useState<string | null>(MOCK_VEHICLES[0]?.vehicleId ?? null);
  const [slot, setSlot] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  return (
    <RequireAuth>
      <Screen>
        <ScrollView contentContainerStyle={{ padding: spacingScale.lg, gap: spacingScale.md }}>
          <Button variant="ghost" onPress={() => router.back()}>
            Back
          </Button>

          {!service ? (
            <ErrorState message="Service not found." />
          ) : confirmed ? (
            <Card elevation="raised">
              <ThemedText level="heading" style={{ marginBottom: spacingScale.xs }}>
                Booking confirmed
              </ThemedText>
              <ThemedText level="body" color="secondary">
                This is a mock confirmation — no booking was actually created (no backend exists yet for this
                action).
              </ThemedText>
              <View style={{ marginTop: spacingScale.md }}>
                <Button variant="secondary" onPress={() => router.replace('/(tabs)/home')}>
                  Back to Home
                </Button>
              </View>
            </Card>
          ) : (
            <>
              <ThemedText level="heading">{service.name}</ThemedText>

              <View style={{ gap: spacingScale.sm }}>
                <ThemedText level="subheading">Vehicle</ThemedText>
                {MOCK_VEHICLES.map((vehicle) => (
                  <Pressable key={vehicle.vehicleId} onPress={() => setVehicleId(vehicle.vehicleId)}>
                    <View
                      style={{
                        minHeight: 44,
                        justifyContent: 'center',
                        paddingHorizontal: spacingScale.md,
                        borderRadius: radiusScale.sm,
                        borderCurve: 'continuous',
                        backgroundColor: vehicleId === vehicle.vehicleId ? colors.accent : colors.surface,
                      }}
                    >
                      <ThemedText
                        level="body"
                        color="inherit"
                        style={{ color: vehicleId === vehicle.vehicleId ? colors.accentContrast : colors.textPrimary }}
                        tabularFigures
                      >
                        {vehicle.plate} — {vehicle.make} {vehicle.model}
                      </ThemedText>
                    </View>
                  </Pressable>
                ))}
              </View>

              <View style={{ gap: spacingScale.sm }}>
                <ThemedText level="subheading">Date & time</ThemedText>
                {MOCK_SLOTS.map((option) => (
                  <Pressable key={option} onPress={() => setSlot(option)}>
                    <View
                      style={{
                        minHeight: 44,
                        justifyContent: 'center',
                        paddingHorizontal: spacingScale.md,
                        borderRadius: radiusScale.sm,
                        borderCurve: 'continuous',
                        backgroundColor: slot === option ? colors.accent : colors.surface,
                      }}
                    >
                      <ThemedText
                        level="body"
                        color="inherit"
                        style={{ color: slot === option ? colors.accentContrast : colors.textPrimary }}
                      >
                        {option}
                      </ThemedText>
                    </View>
                  </Pressable>
                ))}
              </View>

              <Divider />

              <View style={{ gap: spacingScale.xs }}>
                <ThemedText level="subheading">Review</ThemedText>
                {(() => {
                  const snapshot = computeMockPriceSnapshot([service]);
                  return (
                    <>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <ThemedText level="body">{service.name}</ThemedText>
                        <ThemedText level="body" tabularFigures>
                          {formatPaiseAsRupees(snapshot.subtotal)}
                        </ThemedText>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <ThemedText level="body" style={{ fontWeight: '600' }}>
                          Total
                        </ThemedText>
                        <ThemedText level="body" tabularFigures style={{ fontWeight: '600' }}>
                          {formatPaiseAsRupees(snapshot.total)}
                        </ThemedText>
                      </View>
                      <ThemedText level="caption" color="secondary" tabularFigures>
                        {snapshot.advanceRequired
                          ? `40% advance required at booking: ${formatPaiseAsRupees(snapshot.advanceAmount)}`
                          : 'No advance required for this service.'}
                      </ThemedText>
                    </>
                  );
                })()}
              </View>

              <Button disabled={!vehicleId || !slot} onPress={() => setConfirmed(true)}>
                {(() => {
                  const snapshot = computeMockPriceSnapshot([service]);
                  return snapshot.advanceRequired ? 'Confirm & Pay' : 'Confirm Booking';
                })()}
              </Button>
            </>
          )}
        </ScrollView>
      </Screen>
    </RequireAuth>
  );
}
