import "../lib/webAlert";
import { useEffect, useState } from "react";
import { Platform, Pressable } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AutoExperienceThemeProvider, useExperienceTheme, installWebFonts } from "@autodeck/ui/native";
import { useAuth } from "../hooks/useAuth";
import { onForegroundPush, syncPushRegistration } from "../lib/push";
import { T } from "../ui/kit";

installWebFonts();
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

    if (auth.status === "unauthenticated") {
      if (!inAuth || (segs[1] !== "login" && segs[1] !== "welcome")) router.replace("/(auth)/login");
    } else if (auth.status === "authenticated_no_claims") {
      if (!inAuth || segs[1] !== "setup") router.replace("/(auth)/setup");

    } else if (inAuth) {
      router.replace("/(tabs)");
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
      style={{ position: "absolute", top: 16, left: 16, right: 16, maxWidth: 460, alignSelf: "center", zIndex: 60, backgroundColor: "rgba(24,22,20,0.97)", borderRadius: 16, padding: 14, borderWidth: 1, borderColor: "rgba(236,134,56,0.45)", gap: 2 }}
    >
      <T role="bodyStrong">{banner.title}</T>
      {banner.body ? <T role="caption" tone="secondary">{banner.body}</T> : null}
    </Pressable>
  );
}

function ThemedRoot() {
  const { name, colors } = useExperienceTheme();
  useEffect(() => {
    if (Platform.OS !== "web" || !bodyDoc) return;
    bodyDoc.body.style.backgroundColor = colors.canvas;
    bodyDoc.documentElement.style.backgroundColor = colors.canvas;
    bodyDoc.documentElement.style.colorScheme = name === "night" ? "dark" : "light";
    const meta = bodyDoc.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", colors.canvas);
  }, [name, colors.canvas]);
  return (
    <>
      <StatusBar style={name === "night" ? "light" : "dark"} />
      <NavigationGuard>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
        </Stack>
      </NavigationGuard>
      <PushBridge />
    </>
  );
}

export default function RootLayout() {
  return (
    <AutoExperienceThemeProvider>
      <ThemedRoot />
    </AutoExperienceThemeProvider>
  );
}
