import { useState } from "react";
import { Text, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { setupCustomerProfile, refreshAuthToken, auth } from "../../lib/auth-service";
import { colors, spacing, typography, TextInput, Button } from "@autodeck/ui";

export default function SetupScreen() {
  // Google gives us a name; the customer can correct it.
  const [name, setName] = useState(auth.currentUser?.displayName ?? "");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSetup() {
    if (name.trim().length < 2) {
      Alert.alert("Name required", "Enter your full name (at least 2 characters).");
      return;
    }

    setLoading(true);
    try {
      await setupCustomerProfile(name.trim());
      // Force-refresh token to receive custom claims (role, tenantId)
      await refreshAuthToken();
      router.replace("/(tabs)");
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Setup failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, justifyContent: "center", padding: spacing.xl, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <Text style={{ ...typography.heading, color: colors.textPrimary, marginBottom: spacing.xs }}>What's your name?</Text>
      <Text style={{ ...typography.body, color: colors.textMuted, marginBottom: spacing.xxl }}>
        This is shown to the studio team.
      </Text>

      <TextInput
        placeholder="Rahul Shah"
        autoCapitalize="words"
        maxLength={100}
        value={name}
        onChangeText={setName}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={() => void handleSetup()}
      />

      <Button label="Continue" onPress={() => void handleSetup()} loading={loading} />
    </KeyboardAvoidingView>
  );
}
