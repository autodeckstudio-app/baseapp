import { Redirect, Tabs } from 'expo-router';
import { useAuth } from '../../src/auth/AuthProvider';
import { LoadingState, Screen } from '../../src/ui/primitives';
import { useThemeColors } from '../../src/ui/theme';

/**
 * Same authorization boundary as the previous `(app)/_layout.tsx` —
 * unauthenticated sessions redirect to `/login`; any signed-in staff
 * account (staff, studio_manager, or owner_admin — all three use this
 * app, per the existing, preserved product decision) passes. Only the
 * navigation shape changed: five tabs instead of a single `Slot`. No
 * authorization behavior was altered.
 */
export default function TabsLayout() {
  const { session } = useAuth();
  const colors = useThemeColors();

  if (session.status === 'loading') {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }
  if (session.status !== 'authenticated') {
    return <Redirect href="/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarIcon: () => null,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen name="today" options={{ title: 'Today' }} />
      <Tabs.Screen name="jobs" options={{ title: 'Jobs' }} />
      <Tabs.Screen name="vehicles" options={{ title: 'Vehicles' }} />
      <Tabs.Screen name="customers" options={{ title: 'Customers' }} />
      <Tabs.Screen name="you" options={{ title: 'You' }} />
    </Tabs>
  );
}
