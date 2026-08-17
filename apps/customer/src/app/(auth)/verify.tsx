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
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  setupCustomerProfile,
  refreshAuthToken,
} from "../../lib/auth-service";
import {
  getPendingConfirmation,
  clearPendingConfirmation,
} from "./login";
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
        router.replace("/(tabs)/vehicles");
      }
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Invalid OTP.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Verify OTP</Text>
      <Text style={styles.subheading}>
        Enter the 6-digit code sent to {phone}
        {"\n"}
        {__DEV__ && "(Emulator: use code 123456)"}
      </Text>

      <TextInput
        style={styles.input}
        placeholder="123456"
        keyboardType="number-pad"
        maxLength={6}
        value={otp}
        onChangeText={setOtp}
        autoFocus
      />

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleVerify}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Confirm</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#fff" },
  heading: { fontSize: 28, fontWeight: "700", marginBottom: 8 },
  subheading: { fontSize: 15, color: "#666", marginBottom: 32, lineHeight: 22 },
  input: {
    borderBottomWidth: 2,
    borderBottomColor: "#333",
    fontSize: 32,
    paddingVertical: 8,
    marginBottom: 32,
    letterSpacing: 8,
    textAlign: "center",
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
