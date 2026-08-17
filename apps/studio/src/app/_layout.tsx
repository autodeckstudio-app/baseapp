import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { signOut } from "firebase/auth";
import { Alert } from "react-native";
import { auth } from "../lib/firebase";
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
        Alert.alert("Access removed", "Your studio access has been removed. Please contact your admin.");
      });
    } else if (authState.status === "ready" && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [authState.status, segments, router]);

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <NavigationGuard>
      <Stack>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </NavigationGuard>
  );
}
