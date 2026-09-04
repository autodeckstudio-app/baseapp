import { Tabs } from 'expo-router';
import { useThemeColors } from '../../src/ui/theme';

/**
 * Five tabs, per the approved navigation gate: Home | Explore | Garage |
 * Bookings | You. No icon library is wired up yet (see the implementation
 * audit — `@expo/vector-icons` exists in the dependency tree but isn't a
 * declared dependency of this app, and adding it mid-pass was avoided as
 * an unnecessary dependency-graph risk), so tabs are text-label only for
 * now — that's a deliberate, disclosed simplification, not an oversight.
 *
 * No group-level auth redirect here (unlike the old `(app)/_layout.tsx`):
 * Home/Explore/You are public or session-aware; Garage/Bookings gate
 * individually via `RequireAuth` inside their own screens.
 */
export default function TabsLayout() {
  const colors = useThemeColors();

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
      <Tabs.Screen name="home" options={{ title: 'Home' }} />
      <Tabs.Screen name="explore" options={{ title: 'Explore' }} />
      <Tabs.Screen name="garage" options={{ title: 'Garage' }} />
      <Tabs.Screen name="bookings" options={{ title: 'Bookings' }} />
      <Tabs.Screen name="you" options={{ title: 'You' }} />
    </Tabs>
  );
}
