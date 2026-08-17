import { Redirect } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { useAuth } from "../hooks/useAuth";

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
  return <Redirect href="/(auth)/login" />;
}
