import { useState } from "react";
import { View, Text, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter } from "expo-router";
import type { ConfirmationResult } from "firebase/auth";
import { sendPhoneOtp } from "../../lib/auth-service";
import { colors, spacing, typography, TextInput, Button } from "@autodeck/ui";

// Store the confirmation result between screens
// In a full implementation, use a Context or router params
let pendingConfirmation: ConfirmationResult | null = null;
export function getPendingConfirmation(): ConfirmationResult | null {
  return pendingConfirmation;
}
export function clearPendingConfirmation(): void {
  pendingConfirmation = null;
}

export default function LoginScreen() {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const formattedPhone = phone.startsWith("+91") ? phone : `+91${phone.replace(/\s/g, "")}`;

  async function handleSendOtp() {
    if (formattedPhone.length < 13) {
      Alert.alert("Invalid number", "Enter a 10-digit India mobile number.");
      return;
    }

    setLoading(true);
    try {
      pendingConfirmation = await sendPhoneOtp(formattedPhone);
      router.push({ pathname: "/(auth)/verify", params: { phone: formattedPhone } });
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to send OTP.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, justifyContent: "center", padding: spacing.xl, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <Text style={{ ...typography.display, color: colors.textPrimary, marginBottom: spacing.xs }}>AutoDeck</Text>
      <Text style={{ ...typography.body, color: colors.textMuted, marginBottom: spacing.xxl }}>
        Enter your India mobile number
      </Text>

      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: spacing.sm, marginBottom: spacing.xl }}>
        <Text style={{ ...typography.title, color: colors.textSecondary, paddingBottom: 14 }}>+91</Text>
        <View style={{ flex: 1 }}>
          <TextInput
            placeholder="98765 43210"
            keyboardType="phone-pad"
            maxLength={10}
            value={phone}
            onChangeText={setPhone}
            autoFocus
          />
        </View>
      </View>

      <Button label="Send OTP" onPress={() => void handleSendOtp()} loading={loading} />
    </KeyboardAvoidingView>
  );
}
