import "../lib/webAlert";
import { useEffect } from "react";
import { Platform } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ExperienceThemeProvider, installWebFonts } from "@autodeck/ui/native";
import { useAuth } from "../hooks/useAuth";

installWebFonts();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const bodyDoc = (globalThis as any).document;
if (Platform.OS === "web" && bodyDoc) bodyDoc.body.style.backgroundColor = "#0B0B0D";

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

export default function RootLayout() {
  return (
    <ExperienceThemeProvider name="charcoal">
      <StatusBar style="light" />
      <NavigationGuard>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#0B0B0D" } }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
        </Stack>
      </NavigationGuard>
    </ExperienceThemeProvider>
  );
}
