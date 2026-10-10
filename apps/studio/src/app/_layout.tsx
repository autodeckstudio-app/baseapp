import "../lib/webAlert";
import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { signOut } from "firebase/auth";
import { Alert, Platform, View } from "react-native";
import { auth } from "../lib/firebase";
import { colors, isNightPalette, watchMode } from "@autodeck/ui";
import { installWebFonts, AutoExperienceThemeProvider } from "@autodeck/ui/native";

installWebFonts();
import { useAuth } from "../hooks/useAuth";

function NavigationGuard({ children }: { children: React.ReactNode }) {
  const authState = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (authState.status === "loading") return;

    const inAuthGroup = segments[0] === "(auth)";

    if (authState.status === "unauthenticated" && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (authState.status === "unauthorized") {
      // Signed in with a non-studio account, or claims were revoked
      // (e.g. deactivateStaffMember) — sign out and bounce to login rather
      // than leaving the user stuck on a screen where every call 403s.
      void signOut(auth).then(() => {
        const msg = "Your studio access has been removed. Please contact your admin.";
        if (Platform.OS === "web") (globalThis as { alert?: (m: string) => void }).alert?.(msg);
        else Alert.alert("Access removed", msg);
      });
    } else if (authState.status === "ready" && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [authState.status, segments, router]);

  return <>{children}</>;
}

export default function RootLayout() {
  useEffect(() => {
    const doc = (globalThis as { document?: { documentElement: { style: { backgroundColor: string } }; body: { style: { backgroundColor: string } } } }).document;
    if (doc) {
      doc.documentElement.style.backgroundColor = colors.background;
      doc.body.style.backgroundColor = colors.background;
      (doc.documentElement.style as unknown as { colorScheme: string }).colorScheme = isNightPalette ? "dark" : "light";
      const meta = (doc as unknown as { querySelector: (s: string) => { setAttribute: (k: string, v: string) => void } | null }).querySelector('meta[name="theme-color"]');
      meta?.setAttribute("content", colors.background);
    }
    // Day/night flips by the clock or the device setting: the palette is fixed at load, so reload once on a flip.
    return watchMode(() => (globalThis as { location?: { reload: () => void } }).location?.reload());
  }, []);
  return (
    <AutoExperienceThemeProvider>
    <View style={{ flex: 1, backgroundColor: colors.background }}>
    <NavigationGuard>
      <Stack screenOptions={{ contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </NavigationGuard>
    </View>
    </AutoExperienceThemeProvider>
  );
}
