import { ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { heroColors, spacingScale } from '@autodeck/design-tokens';
import { RequireAuth } from '../../../src/auth/RequireAuth';
import { Badge, Button, EmptyState, ErrorState, Screen, ThemedText } from '../../../src/ui/primitives';
import { PhotoPlaceholder } from '../../../src/ui/domain/PhotoPlaceholder';
import { FadeInView } from '../../../src/ui/motion';
import { findMockVehicleById } from '../../../src/mocks/vehicles.mock';

const PROTECTION_LABEL: Record<string, string> = { ppf: 'PPF', ceramic: 'Ceramic', insurance: 'Insurance' };

/**
 * "Vehicle detail with protection cards" — approved V1 scope (§I). This is
 * deliberately lightweight badges only, not the Warranty Certificate
 * feature, which remains explicitly out of scope for this pass.
 */
export default function VehicleDetailScreen() {
  const { vehicleId } = useLocalSearchParams<{ vehicleId: string }>();
  const vehicle = findMockVehicleById(vehicleId);

  return (
    <RequireAuth>
      <Screen>
        <ScrollView contentContainerStyle={{ padding: spacingScale.lg, gap: spacingScale.md }}>
          <Button variant="ghost" onPress={() => router.back()}>
            Back
          </Button>

          {!vehicle ? (
            <ErrorState message="Vehicle not found." />
          ) : (
            <FadeInView>
              <View style={{ gap: spacingScale.md }}>
              <PhotoPlaceholder height={220} scrim>
                <View style={{ padding: spacingScale.md }}>
                  <ThemedText level="display" color="inherit" tabularFigures style={{ color: heroColors.textPrimary }}>
                    {vehicle.plate}
                  </ThemedText>
                </View>
              </PhotoPlaceholder>
              <ThemedText level="body" color="secondary">
                {vehicle.make} {vehicle.model}
                {vehicle.year ? ` · ${vehicle.year}` : ''}
              </ThemedText>

              <View style={{ gap: spacingScale.sm }}>
                <ThemedText level="subheading">Protection</ThemedText>
                {vehicle.protections.length === 0 ? (
                  <EmptyState message="No protection records yet." />
                ) : (
                  <View style={{ flexDirection: 'row', gap: spacingScale.xs, flexWrap: 'wrap' }}>
                    {vehicle.protections.map((protection) => (
                      <Badge
                        key={protection.kind}
                        label={`${PROTECTION_LABEL[protection.kind]} · ${protection.status}`}
                        tone={
                          protection.status === 'active'
                            ? 'accent'
                            : protection.status === 'expiring'
                              ? 'warning'
                              : 'danger'
                        }
                      />
                    ))}
                  </View>
                )}
              </View>

              <View style={{ gap: spacingScale.sm }}>
                <ThemedText level="subheading">Service history</ThemedText>
                <EmptyState message="No completed services yet." />
              </View>

              <Button onPress={() => router.push('/(tabs)/explore')}>Book a service for this vehicle</Button>
              </View>
            </FadeInView>
          )}
        </ScrollView>
      </Screen>
    </RequireAuth>
  );
}
