import { ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { spacingScale } from '@autodeck/design-tokens';
import { Button, Card, EmptyState, ErrorState, Screen, ThemedText, Touchable } from '../../../src/ui/primitives';
import { FadeInView } from '../../../src/ui/motion';
import { findMockVehicleById } from '../../../src/mocks/vehicles.mock';
import { findMockCustomerById } from '../../../src/mocks/customers.mock';
import { MOCK_JOBS } from '../../../src/mocks/jobs.mock';
import { StatusRail } from '../../../src/ui/domain/StatusRail';

export default function VehicleDetailScreen() {
  const { vehicleId } = useLocalSearchParams<{ vehicleId: string }>();
  const vehicle = findMockVehicleById(vehicleId);

  if (!vehicle) {
    return (
      <Screen>
        <ErrorState message="Vehicle not found." />
      </Screen>
    );
  }

  const owner = findMockCustomerById(vehicle.ownerCustomerId);
  const history = MOCK_JOBS.filter((job) => job.vehicleId === vehicle.vehicleId);

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
                {vehicle.plate}
              </ThemedText>
              <ThemedText level="body" color="secondary">
                {vehicle.make} {vehicle.model}
              </ThemedText>
            </View>

            {owner && (
              <Touchable onPress={() => router.push(`/(tabs)/customers/${owner.customerId}`)}>
                <Card>
                  <ThemedText level="caption" color="secondary">
                    Owner
                  </ThemedText>
                  <ThemedText level="subheading">{owner.name}</ThemedText>
                  <ThemedText level="caption" color="secondary">
                    {owner.phone}
                  </ThemedText>
                </Card>
              </Touchable>
            )}

            <View style={{ gap: spacingScale.md }}>
              <ThemedText level="heading">Service history</ThemedText>
              {history.length === 0 ? (
                <EmptyState message="No service history yet." />
              ) : (
                history.map((job) => (
                  <Touchable key={job.visitId} onPress={() => router.push(`/(tabs)/jobs/${job.visitId}`)}>
                    <Card>
                      <ThemedText level="body">{job.serviceName}</ThemedText>
                      <View style={{ marginTop: spacingScale.sm }}>
                        <StatusRail status={job.status} compact />
                      </View>
                    </Card>
                  </Touchable>
                ))
              )}
            </View>
          </View>
        </FadeInView>
      </ScrollView>
    </Screen>
  );
}
