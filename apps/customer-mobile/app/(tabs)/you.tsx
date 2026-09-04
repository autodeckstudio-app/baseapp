import { usePathname, router } from 'expo-router';
import { View } from 'react-native';
import { spacingScale } from '@autodeck/design-tokens';
import { useAuth } from '../../src/auth/AuthProvider';
import { Button, Card, Screen, ThemedText } from '../../src/ui/primitives';

/**
 * Session-aware, per the approved navigation gate — shows an inline
 * "Sign in" prompt when logged out (no redirect, unlike Garage/Bookings)
 * and the profile/sign-out surface when authenticated.
 */
export default function YouScreen() {
  const { session, signOut } = useAuth();
  const pathname = usePathname();

  return (
    <Screen>
      <View style={{ padding: spacingScale.lg, flex: 1, justifyContent: 'center' }}>
        {session.status === 'authenticated' ? (
          <Card>
            <ThemedText level="heading" style={{ marginBottom: spacingScale.xs }}>
              Your account
            </ThemedText>
            <ThemedText level="body" color="secondary" style={{ marginBottom: spacingScale.md }}>
              Signed in.
            </ThemedText>
            <Button variant="secondary" onPress={() => void signOut()}>
              Sign out
            </Button>
          </Card>
        ) : (
          <Card elevation="raised">
            <ThemedText level="heading" style={{ marginBottom: spacingScale.xs }}>
              You're not signed in
            </ThemedText>
            <ThemedText level="body" color="secondary" style={{ marginBottom: spacingScale.md }}>
              Sign in to manage your garage, bookings, and profile.
            </ThemedText>
            <Button onPress={() => router.push({ pathname: '/login', params: { redirectTo: pathname } })}>
              Sign in
            </Button>
          </Card>
        )}
      </View>
    </Screen>
  );
}
