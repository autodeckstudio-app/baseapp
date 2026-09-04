import { useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';
import { router } from 'expo-router';
import { spacingScale } from '@autodeck/design-tokens';
import { Card, EmptyState, Field, Screen, ThemedText, Touchable } from '../../../src/ui/primitives';
import { FadeInView } from '../../../src/ui/motion';
import { MOCK_CUSTOMERS } from '../../../src/mocks/customers.mock';

export default function CustomersScreen() {
  const [query, setQuery] = useState('');
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return MOCK_CUSTOMERS;
    return MOCK_CUSTOMERS.filter((c) => c.name.toLowerCase().includes(q) || c.phone.includes(q));
  }, [query]);

  return (
    <Screen>
      <View style={{ padding: spacingScale.lg, flex: 1, gap: spacingScale.md }}>
        <ThemedText level="display">Customers</ThemedText>
        <Field label="Search" placeholder="Name or phone" value={query} onChangeText={setQuery} />
        <FlatList
          data={results}
          keyExtractor={(item) => item.customerId}
          contentContainerStyle={{ gap: spacingScale.md }}
          ListEmptyComponent={<EmptyState message="No matching customers." />}
          renderItem={({ item, index }) => (
            <FadeInView delay={index * 40}>
              <Touchable onPress={() => router.push(`/(tabs)/customers/${item.customerId}`)}>
                <Card>
                  <ThemedText level="subheading">{item.name}</ThemedText>
                  <ThemedText level="caption" color="secondary" tabularFigures>
                    {item.phone}
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
