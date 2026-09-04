import { FlatList, View } from 'react-native';
import { heroColors, spacingScale } from '@autodeck/design-tokens';
import { RequireAuth } from '../../../src/auth/RequireAuth';
import { Button, Screen, ThemedText } from '../../../src/ui/primitives';
import { VehicleCard } from '../../../src/ui/domain/VehicleCard';
import { PhotoPlaceholder } from '../../../src/ui/domain/PhotoPlaceholder';
import { FadeInView } from '../../../src/ui/motion';
import { MOCK_VEHICLES } from '../../../src/mocks/vehicles.mock';

export default function GarageScreen() {
  return (
    <RequireAuth>
      <Screen>
        <View style={{ padding: spacingScale.lg, flex: 1, gap: spacingScale.lg }}>
          <ThemedText level="display">Garage</ThemedText>
          <FlatList
            data={MOCK_VEHICLES}
            keyExtractor={(item) => item.vehicleId}
            contentContainerStyle={{ gap: spacingScale.lg }}
            ListEmptyComponent={<GarageEmptyState />}
            renderItem={({ item, index }) => (
              <FadeInView delay={index * 60}>
                <VehicleCard vehicle={item} />
              </FadeInView>
            )}
          />
        </View>
      </Screen>
    </RequireAuth>
  );
}

/**
 * Polished per the approved requirement ("visually polished rather than a
 * plain message"). The CTA has no destination yet — an Add Vehicle flow is
 * out of scope for this visual-quality pass (not part of the approved
 * screen list) — noted here and in the implementation audit rather than
 * silently building a half-working form. Unreachable in practice today
 * since `MOCK_VEHICLES` is never empty.
 */
function GarageEmptyState() {
  return (
    <PhotoPlaceholder height={280} scrim>
      <View style={{ padding: spacingScale.lg, gap: spacingScale.sm }}>
        <ThemedText level="heading" color="inherit" style={{ color: heroColors.textPrimary }}>
          Add your vehicle
        </ThemedText>
        <ThemedText level="body" color="inherit" style={{ color: heroColors.textSecondary, marginBottom: spacingScale.xs }}>
          Your garage is where every service, protection, and record lives.
        </ThemedText>
        <Button onPress={() => {}}>Add your vehicle</Button>
      </View>
    </PhotoPlaceholder>
  );
}
