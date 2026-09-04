import { useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';
import { router } from 'expo-router';
import { spacingScale } from '@autodeck/design-tokens';
import { Card, EmptyState, Field, Screen, ThemedText, Touchable } from '../../../src/ui/primitives';
import { FadeInView } from '../../../src/ui/motion';
import { MOCK_VEHICLES } from '../../../src/mocks/vehicles.mock';
import { findMockCustomerById } from '../../../src/mocks/customers.mock';

/**
 * Search by plate/make/model — real `Vehicle` fields only. Ownership is by
 * `ownerCustomerId` (a real ID, never a plate string), per the audit's
 * explicit finding that AutoModz's plate-string join is a lesson to avoid.
 */
export default function VehiclesScreen() {
  const [query, setQuery] = useState('');
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return MOCK_VEHICLES;
    return MOCK_VEHICLES.filter(
      (v) => v.plate.toLowerCase().includes(q) || v.make.toLowerCase().includes(q) || v.model.toLowerCase().includes(q)
    );
  }, [query]);

  return (
    <Screen>
      <View style={{ padding: spacingScale.lg, flex: 1, gap: spacingScale.md }}>
        <ThemedText level="display">Vehicles</ThemedText>
        <Field label="Search" placeholder="Plate, make, or model" value={query} onChangeText={setQuery} />
        <FlatList
          data={results}
          keyExtractor={(item) => item.vehicleId}
          contentContainerStyle={{ gap: spacingScale.md }}
          ListEmptyComponent={<EmptyState message="No matching vehicles." />}
          renderItem={({ item, index }) => (
            <FadeInView delay={index * 40}>
              <Touchable onPress={() => router.push(`/(tabs)/vehicles/${item.vehicleId}`)}>
                <Card>
                  <ThemedText level="subheading" tabularFigures>
                    {item.plate}
                  </ThemedText>
                  <ThemedText level="caption" color="secondary">
                    {item.make} {item.model} · {findMockCustomerById(item.ownerCustomerId)?.name ?? 'Unknown owner'}
                  </ThemedText>
                </Card>
              </Touchable>
            </FadeInView>
          )}
        />
      </View>
    </Screen>
  );
}
