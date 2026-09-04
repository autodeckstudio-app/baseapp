import { useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { radiusScale, spacingScale } from '@autodeck/design-tokens';
import { useAuth } from '../../src/auth/AuthProvider';
import { EmptyState, Screen, ThemedText, Touchable } from '../../src/ui/primitives';
import { ServiceCard } from '../../src/ui/domain/ServiceCard';
import { PackageCard } from '../../src/ui/domain/PackageCard';
import { FadeInView } from '../../src/ui/motion';
import { MOCK_SERVICES } from '../../src/mocks/services.mock';
import { MOCK_PACKAGE_DEFINITIONS } from '../../src/mocks/packages.mock';
import { MOCK_OWNED_PACKAGES } from '../../src/mocks/ownedPackages.mock';
import { useThemeColors } from '../../src/ui/theme';

type Segment = 'services' | 'packages';

/**
 * Explore contains both Services and Packages behind one local segmented
 * control, per the approved navigation gate — both stay fully public, no
 * authentication required to browse either. When authenticated, Packages
 * shows the customer's owned "Care Balance" instead of the pre-purchase
 * browse list, since there's something real to show.
 */
export default function ExploreScreen() {
  const [segment, setSegment] = useState<Segment>('services');
  const colors = useThemeColors();
  const { session } = useAuth();

  return (
    <Screen>
      <View style={{ padding: spacingScale.lg, gap: spacingScale.lg, flex: 1 }}>
        <ThemedText level="display">Explore</ThemedText>

        <View style={{ flexDirection: 'row', backgroundColor: colors.border, borderRadius: radiusScale.sm, padding: 2 }}>
          {(['services', 'packages'] as Segment[]).map((option) => (
            <Pressable
              key={option}
              accessibilityRole="button"
              onPress={() => setSegment(option)}
              style={{
                flex: 1,
                minHeight: 44,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: radiusScale.sm - 2,
                backgroundColor: segment === option ? colors.surface : 'transparent',
              }}
            >
              <ThemedText level="body" style={{ fontWeight: '600' }}>
                {option === 'services' ? 'Services' : 'Packages'}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        {segment === 'services' ? (
          <FlatList
            data={MOCK_SERVICES}
            keyExtractor={(item) => item.serviceId}
            contentContainerStyle={{ gap: spacingScale.lg }}
            ListEmptyComponent={<EmptyState message="No services published yet." />}
            renderItem={({ item, index }) => (
              <FadeInView delay={index * 60}>
                <Touchable onPress={() => router.push(`/service/${item.serviceId}`)}>
                  <ServiceCard service={item} />
                </Touchable>
              </FadeInView>
            )}
          />
        ) : session.status === 'authenticated' ? (
          <FlatList
            data={MOCK_OWNED_PACKAGES}
            keyExtractor={(item) => item.packageDefinitionId}
            contentContainerStyle={{ gap: spacingScale.lg }}
            ListEmptyComponent={<EmptyState message="No packages purchased yet." />}
            renderItem={({ item }) => <PackageCard ownedPackage={item} />}
          />
        ) : (
          <FlatList
            data={MOCK_PACKAGE_DEFINITIONS}
            keyExtractor={(item) => item.packageDefinitionId}
            contentContainerStyle={{ gap: spacingScale.lg }}
            ListEmptyComponent={<EmptyState message="No package types configured yet." />}
            renderItem={({ item }) => <PackageCard packageDefinition={item} />}
          />
        )}
      </View>
    </Screen>
  );
}
