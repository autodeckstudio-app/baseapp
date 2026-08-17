import { useState } from "react";
import { Text, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  setupCustomerProfile,
  refreshAuthToken,
} from "../../lib/auth-service";
import {
  getPendingConfirmation,
  clearPendingConfirmation,
} from "./login";
import { colors, spacing, typography, TextInput, Button } from "@autodeck/ui";

export default function VerifyScreen() {
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleVerify() {
    const confirmation = getPendingConfirmation();
    if (!confirmation) {
      Alert.alert("Session expired", "Please go back and request a new OTP.");
      router.replace("/(auth)/login");
      return;
    }

    if (otp.length !== 6) {
      Alert.alert("Invalid OTP", "Enter the 6-digit code.");
      return;
    }

    setLoading(true);
    try {
      await confirmation.confirm(otp);
      clearPendingConfirmation();

      // Check if this is a new or returning customer
      const { isNew } = await setupCustomerProfile();

      if (isNew) {
        // Need name — go to setup screen
        router.replace("/(auth)/setup");
      } else {
        // Returning customer — refresh claims and go to app
        await refreshAuthToken();
        router.replace("/(tabs)");
      }
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Invalid OTP.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, justifyContent: "center", padding: spacing.xl, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <Text style={{ ...typography.heading, color: colors.textPrimary, marginBottom: spacing.xs }}>Verify OTP</Text>
      <Text style={{ ...typography.body, color: colors.textMuted, marginBottom: spacing.xxl, lineHeight: 22 }}>
        Enter the 6-digit code sent to {phone}
        {"\n"}
        {__DEV__ && "(Emulator: use code 123456)"}
      </Text>

      <TextInput
        placeholder="123456"
        keyboardType="number-pad"
        maxLength={6}
        value={otp}
        onChangeText={setOtp}
        autoFocus
        textAlign="center"
      />

      <Button label="Confirm" onPress={() => void handleVerify()} loading={loading} style={{ marginTop: spacing.xl }} />
    </KeyboardAvoidingView>
  );
}
