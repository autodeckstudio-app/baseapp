import { useEffect } from "react";
import { Platform } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ExperienceThemeProvider } from "@autodeck/ui/native";
import { useAuth } from "../hooks/useAuth";

// Web build: load the three OFL faces the type scale names.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const doc = (globalThis as any).document;
if (Platform.OS === "web" && doc && !doc.getElementById("ad-fonts")) {
  const link = doc.createElement("link");
  link.id = "ad-fonts";
  link.rel = "stylesheet";
  link.href =
    "https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600&family=Outfit:wght@200;300;400&display=swap";
  doc.head.appendChild(link);
  doc.body.style.backgroundColor = "#08090A";
}

// Routes once claims are known, so a customer never sees staff screens and
// staff never see customer screens (spec §5.1). Staff accounts land on a
// notice that points them at the studio app.
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
      if (!inAuth || segs[1] !== "login") router.replace("/(auth)/login");
    } else if (auth.status === "authenticated_no_claims") {
      if (!inAuth || segs[1] !== "setup") router.replace("/(auth)/setup");
    } else if (auth.claims.role !== "customer") {
      if (segs[1] !== "staff") router.replace("/(auth)/staff");
    } else if (inAuth) {
      router.replace("/(tabs)");
    }
  }, [auth, segments, router]);

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <ExperienceThemeProvider name="dark">
      <StatusBar style="light" />
      <NavigationGuard>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#08090A" } }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
        </Stack>
      </NavigationGuard>
    </ExperienceThemeProvider>
  );
}
