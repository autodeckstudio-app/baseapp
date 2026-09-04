import { ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { spacingScale } from '@autodeck/design-tokens';
import { useAuth } from '../../src/auth/AuthProvider';
import { Button, Card, ErrorState, Screen, ThemedText } from '../../src/ui/primitives';
import { ServiceCard } from '../../src/ui/domain/ServiceCard';
import { FadeInView } from '../../src/ui/motion';
import { useThemeColors } from '../../src/ui/theme';
import { findMockServiceById } from '../../src/mocks/services.mock';

/**
 * Fully public — a visitor can read everything here without signing in.
 * Authentication is only triggered by the "Book this service" action
 * (see the approved contextual-auth requirement), not by viewing the page.
 * The CTA is sticky at the bottom of the viewport, per the approved
 * "sticky CTA on mobile where appropriate" requirement.
 */
export default function ServiceDetailScreen() {
  const { serviceId } = useLocalSearchParams<{ serviceId: string }>();
  const { session } = useAuth();
  const colors = useThemeColors();
  const service = findMockServiceById(serviceId);

  if (!service) {
    return (
      <Screen>
        <ErrorState message="Service not found." />
      </Screen>
    );
  }

  function handleBook() {
    if (session.status === 'authenticated') {
      router.push(`/book/${service!.serviceId}`);
    } else {
      router.push({ pathname: '/login', params: { redirectTo: `/book/${service!.serviceId}` } });
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacingScale.lg, paddingBottom: spacingScale.xxl + 64, gap: spacingScale.md }}>
        <Button variant="ghost" onPress={() => router.back()}>
          Back
        </Button>
        <FadeInView>
          <ServiceCard service={service} variant="featured" />
        </FadeInView>

        {service.warrantyLabel && (
          <Card>
            <ThemedText level="subheading" style={{ marginBottom: spacingScale.xs }}>
              Protection
            </ThemedText>
            <ThemedText level="body" color="secondary">
              {service.warrantyLabel}
            </ThemedText>
          </Card>
        )}
      </ScrollView>

      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          padding: spacingScale.lg,
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}
      >
        <Button onPress={handleBook}>Book this service</Button>
      </View>
    </Screen>
  );
}
