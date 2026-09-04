import { View } from 'react-native';
import { router } from 'expo-router';
import { heroColors, spacingScale } from '@autodeck/design-tokens';
import { Badge, Button, Card, ThemedText } from '../primitives';
import type { MockVehicle } from '../../mocks/vehicles.mock';
import { PhotoPlaceholder } from './PhotoPlaceholder';

const PROTECTION_LABEL: Record<MockVehicle['protections'][number]['kind'], string> = {
  ppf: 'PPF',
  ceramic: 'Ceramic',
  insurance: 'Insurance',
};

/**
 * The vehicle as a "passport" — the primary object in the app, per the
 * approved requirement, not a CRUD list row. Photo dominates, plate reads
 * like an identity document, and the two actions carry distinct weight
 * (Book is the primary path; viewing full detail is secondary).
 */
export function VehicleCard({ vehicle }: { vehicle: MockVehicle }) {
  return (
    <Card elevation="raised">
      <PhotoPlaceholder height={160}>
        <View style={{ padding: spacingScale.md }}>
          <ThemedText level="heading" color="inherit" tabularFigures style={{ color: heroColors.textPrimary }}>
            {vehicle.plate}
          </ThemedText>
        </View>
      </PhotoPlaceholder>
      <View style={{ marginTop: spacingScale.md, gap: spacingScale.sm }}>
        <ThemedText level="subheading">
          {vehicle.make} {vehicle.model}
          {vehicle.year ? ` · ${vehicle.year}` : ''}
        </ThemedText>
        {vehicle.protections.length > 0 && (
          <View style={{ flexDirection: 'row', gap: spacingScale.xs }}>
            {vehicle.protections.map((protection) => (
              <Badge
                key={protection.kind}
                label={PROTECTION_LABEL[protection.kind]}
                tone={protection.status === 'active' ? 'accent' : protection.status === 'expiring' ? 'warning' : 'danger'}
              />
            ))}
          </View>
        )}
        <View style={{ flexDirection: 'row', gap: spacingScale.sm, marginTop: spacingScale.xs }}>
          <View style={{ flex: 1 }}>
            <Button onPress={() => router.push('/(tabs)/explore')}>Book for this vehicle</Button>
          </View>
          <View style={{ flex: 1 }}>
            <Button variant="secondary" onPress={() => router.push(`/(tabs)/garage/${vehicle.vehicleId}`)}>
              View Vehicle
            </Button>
          </View>
        </View>
      </View>
    </Card>
  );
}
