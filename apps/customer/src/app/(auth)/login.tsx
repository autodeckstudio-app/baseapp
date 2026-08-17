import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import type { ConfirmationResult } from "firebase/auth";
import { sendPhoneOtp } from "../../lib/auth-service";

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
    <View style={styles.container}>
      <Text style={styles.heading}>AutoDeck</Text>
      <Text style={styles.subheading}>Enter your India mobile number</Text>

      <View style={styles.inputRow}>
        <Text style={styles.prefix}>+91</Text>
        <TextInput
          style={styles.input}
          placeholder="98765 43210"
          keyboardType="phone-pad"
          maxLength={10}
          value={phone}
          onChangeText={setPhone}
          autoFocus
        />
      </View>

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleSendOtp}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Send OTP</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#fff" },
  heading: { fontSize: 32, fontWeight: "700", marginBottom: 8 },
  subheading: { fontSize: 16, color: "#666", marginBottom: 32 },
  inputRow: { flexDirection: "row", alignItems: "center", marginBottom: 24 },
  prefix: { fontSize: 18, marginRight: 8, color: "#333" },
  input: {
    flex: 1,
    borderBottomWidth: 2,
    borderBottomColor: "#333",
    fontSize: 20,
    paddingVertical: 8,
    letterSpacing: 2,
  },
  button: {
    backgroundColor: "#1a1a1a",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
