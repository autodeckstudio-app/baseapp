import "../lib/boot-theme";
import "../lib/webAlert";
import { useEffect, useState } from "react";
import { View, Platform, Pressable } from "react-native";
import { groundFor, groundImageFor } from "../lib/ground";
import { setSurfaceMode, glassSurface } from "../lib/glass";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AutoExperienceThemeProvider, useExperienceTheme, installWebFonts } from "@autodeck/ui/native";
import { useAuth } from "../hooks/useAuth";
import { captureAuthReturn, consumeAuthReturn } from "../lib/auth-return";
import { onForegroundPush, syncPushRegistration } from "../lib/push";
import { T } from "../ui/kit";
import { ConnectionBanner } from "../ui/ConnectionBanner";
import { ErrorBoundary } from "../ui/ErrorBoundary";

installWebFonts();

// Direct process.env reads only: Expo's web export inlines each access, so a
// production export folds this to null and the strip can never render there.
const LOCAL_TEST_NOTICE: string | null =
  process.env["EXPO_PUBLIC_USE_FIREBASE_EMULATOR"] === "true" || process.env["USE_FIREBASE_EMULATOR"] === "true"
    ? "Local test build. Emulator data; sample content and prices."
    : null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const bodyDoc = (globalThis as any).document;

// Any signed-in account may use the customer app. Staff access stays additive.
function NavigationGuard({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (auth.status === "loading") return;
    const segs = segments as string[];
    const group = segs[0];
    const inAuth = group === "(auth)";
    if (__DEV__ && (group === "preview" || group === "preview-services" || group === "preview-car" || group === "preview-profile" || group === "preview-bookings" || group === "preview-booking" || group === "preview-help" || group === "preview-combos" || group === "preview-garage" || group === "preview-cars" || group === "preview-membership" || group === "preview-kit" || group === "preview-price" || group === "preview-service" || group === "preview-studio" || group === "preview-detail" || group === "preview-catalogue" || group === "preview-gifts" || group === "preview-stories" || group === "preview-shop")) return;
    

    if (auth.status === "unauthenticated") {
      const browsingCars = (group === "(tabs)" && segs[1] === "cars" && segs[2] !== "sell") || group === "shop";
      if (!browsingCars && (!inAuth || (segs[1] !== "login" && segs[1] !== "welcome"))) {
        // Remember where this signed-out visitor was heading (web deep link,
        // e.g. a website service CTA) so sign-in can return them there.
        const loc = (globalThis as { window?: { location?: { pathname: string; search: string } } }).window?.location;
        if (loc) captureAuthReturn(loc.pathname + loc.search);
        router.replace("/(auth)/login");
      }
    } else if (auth.status === "authenticated_no_claims") {
      if (!inAuth || segs[1] !== "setup") router.replace("/(auth)/setup");

    } else if (inAuth) {
      router.replace(consumeAuthReturn() ?? "/(tabs)");
    }
  }, [auth, segments, router]);

  return <>{children}</>;
}

// Web push: once signed in, silently re-register this device's token when
// permission was granted earlier, and show foreground pushes as an in-app
// banner (FCM shows no system notification while the tab is focused).
function PushBridge() {
  const auth = useAuth();
  const [banner, setBanner] = useState<{ title: string; body: string } | null>(null);

  useEffect(() => {
    if (auth.status !== "ready") return undefined;
    void syncPushRegistration();
    return onForegroundPush((title, body) => setBanner({ title, body }));
  }, [auth.status]);

  useEffect(() => {
    if (!banner) return undefined;
    const t = setTimeout(() => setBanner(null), 8000);
    return () => clearTimeout(t);
  }, [banner]);

  if (!banner) return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${banner.title}. Dismiss`}
      onPress={() => setBanner(null)}
      style={{ position: "absolute", top: 16, left: 16, right: 16, maxWidth: 460, alignSelf: "center", zIndex: 60, backgroundColor: glassSurface.backgroundColor, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: "rgba(236,134,56,0.45)", gap: 2 }}
    >
      <T role="bodyStrong">{banner.title}</T>
      {banner.body ? <T role="caption" tone="secondary">{banner.body}</T> : null}
    </Pressable>
  );
}

function ThemedRoot() {
  const { name, colors } = useExperienceTheme();
  setSurfaceMode(name);
  const GROUND_COLOR = groundFor(name);
  const COALMINE = groundImageFor(name);
  useEffect(() => {
    if (Platform.OS !== "web" || !bodyDoc) return;
    bodyDoc.body.style.backgroundColor = GROUND_COLOR;
    bodyDoc.documentElement.style.backgroundColor = GROUND_COLOR;
    bodyDoc.documentElement.style.colorScheme = name === "night" ? "dark" : "light";
    if (!bodyDoc.getElementById("ad-ground-fix")) {
      // React Navigation paints its light default theme behind every scene on web; let the root ground show through.
      const st = bodyDoc.createElement("style");
      st.id = "ad-ground-fix";
      st.textContent = '#root div[style*="rgb(242, 242, 242)"], #root div[style*="rgb(1, 1, 1)"] { background-color: transparent !important; }';
      bodyDoc.head.appendChild(st);
    }
    const meta = bodyDoc.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", colors.canvas);
  }, [name, colors.canvas, GROUND_COLOR]);
  return (
    <View style={{ flex: 1, backgroundColor: GROUND_COLOR, ...(Platform.OS === "web" ? ({ backgroundImage: COALMINE } as object) : null) }}>
      <StatusBar style={name === "night" ? "light" : "dark"} />
      {LOCAL_TEST_NOTICE ? (
        <View style={{ backgroundColor: "#FFF3D6", borderBottomWidth: 1, borderColor: "rgba(151,99,18,0.4)", paddingVertical: 5, paddingHorizontal: 12, alignItems: "center" }}>
          <T role="label" tone="primary" style={{ color: "#6B4A08", fontWeight: "600" }}>{LOCAL_TEST_NOTICE}</T>
        </View>
      ) : null}
      <ConnectionBanner />
      <ErrorBoundary>
      <NavigationGuard key={name}>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "transparent" }, animation: "fade", animationDuration: 180 }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
        </Stack>
      </NavigationGuard>
      </ErrorBoundary>
      <PushBridge />
    </View>
  );
}

export default function RootLayout() {
  return (
    <AutoExperienceThemeProvider>
      <ThemedRoot />
    </AutoExperienceThemeProvider>
  );
}
