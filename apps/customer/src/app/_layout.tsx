import { Stack } from "expo-router";
import { useEffect } from "react";
import { useRouter, useSegments } from "expo-router";
import { useAuth } from "../hooks/useAuth";

function NavigationGuard({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (auth.status === "loading") return;

    const inAuthGroup = segments[0] === "(auth)";

    if (auth.status === "unauthenticated" && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (auth.status === "authenticated_no_claims" && !inAuthGroup) {
      router.replace("/(auth)/setup");
    } else if (auth.status === "ready" && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [auth.status, segments, router]);

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <NavigationGuard>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </NavigationGuard>
  );
}
