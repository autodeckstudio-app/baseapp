import { isNightPalette as nightMaterial } from "@autodeck/ui";
import { Platform as NightPlatform } from "react-native";
import { nightGroundStyle, nightSurfaceStyle } from "@autodeck/ui/theme";
import "../lib/webAlert";
import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { signOut } from "firebase/auth";
import { Alert, Platform, View, useWindowDimensions } from "react-native";
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

// Web: the whole app lives in one rounded canvas on a plain backdrop (Orizon layout).
function canvasFrame(width: number): Record<string, unknown> {
  if (Platform.OS !== "web") return {};
  const phone = width <= 860;
  return {
    position: "fixed", top: phone ? 6 : 16, left: phone ? 6 : 16, right: phone ? 6 : 16, bottom: phone ? 6 : 16,
    borderRadius: phone ? 32 : 44, overflow: "hidden", borderWidth: 2,
    borderColor: isNightPalette ? "rgba(255,255,255,.22)" : "rgba(255,255,255,.92)",
    boxShadow: isNightPalette ? "0 40px 90px -30px rgba(0,0,0,.8)" : "0 40px 90px -30px rgba(70,45,20,.55)",
  };
}

export default function RootLayout() {
  const { width } = useWindowDimensions();
  useEffect(() => {
    const doc = (globalThis as { document?: { documentElement: { style: { backgroundColor: string } }; body: { style: { backgroundColor: string } } } }).document;
    if (doc) {
      const backdrop = Platform.OS === "web" ? (isNightPalette ? "#141413" : "#E6DFD4") : colors.background;
      doc.documentElement.style.backgroundColor = backdrop;
      doc.body.style.backgroundColor = backdrop;
      (doc.documentElement.style as unknown as { colorScheme: string }).colorScheme = isNightPalette ? "dark" : "light";
      const meta = (doc as unknown as { querySelector: (s: string) => { setAttribute: (k: string, v: string) => void } | null }).querySelector('meta[name="theme-color"]');
      meta?.setAttribute("content", colors.background);
    }
    // Day/night flips by the clock or the device setting: the palette is fixed at load, so reload once on a flip.
    return watchMode(() => (globalThis as { location?: { reload: () => void } }).location?.reload());
  }, []);
  return (
    <AutoExperienceThemeProvider>
    <View style={{ flex: 1, backgroundColor: colors.background, ...canvasFrame(width), ...(NightPlatform.OS === "web" && nightMaterial ? nightGroundStyle : {}) }}>
    <NavigationGuard>
      <Stack screenOptions={{ contentStyle: { backgroundColor: colors.background, ...(NightPlatform.OS === "web" && nightMaterial ? nightGroundStyle : {}) } }}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </NavigationGuard>
    </View>
    </AutoExperienceThemeProvider>
  );
}
