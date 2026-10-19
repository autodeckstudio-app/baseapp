import { isNightPalette as nightMaterial } from "@autodeck/ui";
import { Platform as NightPlatform } from "react-native";
import { nightGroundStyle, nightSurfaceStyle, DAY_ATMOSPHERE } from "@autodeck/ui/theme";
import "../lib/webAlert";
import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { Platform, View, useWindowDimensions } from "react-native";
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
      // Signed in without studio access (new person, or access removed): ask the admin for it.
      if ((segments as string[])[1] !== "access") router.replace("/(auth)/access");
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
    position: "fixed", top: phone ? 0 : 16, left: phone ? 0 : 16, right: phone ? 0 : 16, bottom: phone ? 0 : 16,
    borderRadius: phone ? 0 : 44, overflow: "hidden", borderWidth: phone ? 0 : 2,
    borderColor: isNightPalette ? "rgba(255,255,255,.22)" : "rgba(255,255,255,.92)",
    boxShadow: isNightPalette ? "0 40px 90px -30px rgba(0,0,0,.8)" : "0 40px 90px -30px rgba(70,45,20,.55)",
  };
}

export default function RootLayout() {
  const { width } = useWindowDimensions();
  // react-navigation paints every nested screen and header with its theme background (a light grey, rgb(242,242,242)).
  // On web that hid the shared ambient photo on stacked pages such as Lookup. Clear exactly that colour, once, for every page.
  useEffect(() => {
    const doc = (globalThis as { document?: { createElement: (t: string) => { setAttribute: (k: string, v: string) => void; textContent: string }; head: { appendChild: (n: unknown) => void }; getElementById: (i: string) => unknown } }).document;
    if (!doc || doc.getElementById("ad-clear-scene")) return;
    const el = doc.createElement("style");
    el.setAttribute("id", "ad-clear-scene");
    el.textContent = 'div[style*="background-color: rgb(242, 242, 242)"]{background-color:transparent!important}';
    doc.head.appendChild(el);
  }, []);
  useEffect(() => {
    const doc = (globalThis as { document?: { documentElement: { style: { backgroundColor: string } }; body: { style: { backgroundColor: string } } } }).document;
    if (doc) {
      const backdrop = Platform.OS === "web" ? (isNightPalette ? "#141413" : "#E6DFD4") : colors.background;
      doc.documentElement.style.backgroundColor = backdrop;
      doc.body.style.backgroundColor = backdrop;
      if (Platform.OS === "web" && !isNightPalette) {
        // One Day background across customer, studio and admin (see DAY_ATMOSPHERE).
        const rs = doc.documentElement.style as unknown as Record<string, string>;
        rs.backgroundImage = DAY_ATMOSPHERE;
        rs.backgroundAttachment = "fixed";
        rs.backgroundRepeat = "no-repeat";
        doc.body.style.backgroundColor = "transparent";
      }
      (doc.documentElement.style as unknown as { colorScheme: string }).colorScheme = isNightPalette ? "dark" : "light";
      const meta = (doc as unknown as { querySelector: (s: string) => { setAttribute: (k: string, v: string) => void } | null }).querySelector('meta[name="theme-color"]');
      meta?.setAttribute("content", colors.background);
    }
    // Day/night flips by the clock or the device setting: the palette is fixed at load, so reload once on a flip.
    return watchMode(() => (globalThis as { location?: { reload: () => void } }).location?.reload());
  }, []);
  return (
    <AutoExperienceThemeProvider>
    <View style={{ flex: 1, backgroundColor: NightPlatform.OS === "web" && !nightMaterial ? "transparent" : colors.background, ...canvasFrame(width), ...(NightPlatform.OS === "web" && nightMaterial ? nightGroundStyle : {}) }}>
    <NavigationGuard>
      <Stack screenOptions={{ contentStyle: { backgroundColor: NightPlatform.OS === "web" && !nightMaterial ? "transparent" : colors.background, ...(NightPlatform.OS === "web" && nightMaterial ? nightGroundStyle : {}) } }}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </NavigationGuard>
    </View>
    </AutoExperienceThemeProvider>
  );
}
