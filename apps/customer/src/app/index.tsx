import { Redirect } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { useAuth } from "../hooks/useAuth";

// Shows a neutral loading state while the persisted session (if any) is
// resolved, then redirects once — avoids a visible flash of the login
// screen for already-authenticated users on cold start.
export default function Index() {
  const auth = useAuth();

  if (auth.status === "loading") {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (auth.status === "ready") return <Redirect href="/(tabs)" />;
  if (auth.status === "authenticated_no_claims") return <Redirect href="/(auth)/setup" />;
  return <Redirect href="/(auth)/login" />;
}
