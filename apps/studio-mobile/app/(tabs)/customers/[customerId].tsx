import { ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { spacingScale } from '@autodeck/design-tokens';
import { Button, Card, EmptyState, ErrorState, Screen, ThemedText, Touchable } from '../../../src/ui/primitives';
import { FadeInView } from '../../../src/ui/motion';
import { findMockCustomerById } from '../../../src/mocks/customers.mock';
import { findMockVehiclesByCustomerId } from '../../../src/mocks/vehicles.mock';
import { MOCK_JOBS } from '../../../src/mocks/jobs.mock';

export default function CustomerDetailScreen() {
  const { customerId } = useLocalSearchParams<{ customerId: string }>();
  const customer = findMockCustomerById(customerId);

  if (!customer) {
    return (
      <Screen>
        <ErrorState message="Customer not found." />
      </Screen>
    );
  }

  const vehicles = findMockVehiclesByCustomerId(customer.customerId);
  const bookings = MOCK_JOBS.filter((job) => job.customerId === customer.customerId);

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacingScale.lg, gap: spacingScale.lg }}>
        <Button variant="ghost" onPress={() => router.back()}>
          Back
        </Button>
        <FadeInView>
          <View style={{ gap: spacingScale.lg }}>
            <View>
              <ThemedText level="display">{customer.name}</ThemedText>
              <ThemedText level="body" color="secondary" tabularFigures>
                {customer.phone}
              </ThemedText>
              <ThemedText level="caption" color="secondary">
                {customer.email}
              </ThemedText>
            </View>

            <View style={{ gap: spacingScale.md }}>
              <ThemedText level="heading">Vehicles</ThemedText>
              {vehicles.length === 0 ? (
                <EmptyState message="No vehicles on file." />
              ) : (
                vehicles.map((vehicle) => (
                  <Touchable key={vehicle.vehicleId} onPress={() => router.push(`/(tabs)/vehicles/${vehicle.vehicleId}`)}>
                    <Card>
                      <ThemedText level="subheading" tabularFigures>
                        {vehicle.plate}
                      </ThemedText>
                      <ThemedText level="caption" color="secondary">
                        {vehicle.make} {vehicle.model}
                      </ThemedText>
                    </Card>
                  </Touchable>
                ))
              )}
            </View>

            <View style={{ gap: spacingScale.md }}>
              <ThemedText level="heading">Bookings</ThemedText>
              {bookings.length === 0 ? (
                <EmptyState message="No bookings on file." />
              ) : (
                bookings.map((job) => (
                  <Touchable key={job.visitId} onPress={() => router.push(`/(tabs)/jobs/${job.visitId}`)}>
                    <Card>
                      <ThemedText level="body">{job.serviceName}</ThemedText>
                      <ThemedText level="caption" color="secondary" style={{ marginTop: spacingScale.xs }}>
                        {job.status.replace('_', ' ')}
                      </ThemedText>
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
