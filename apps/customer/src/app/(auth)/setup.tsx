import { useState } from "react";
import {
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { setupCustomerProfile, refreshAuthToken } from "../../lib/auth-service";

export default function SetupScreen() {
  const [name, setName] = useState("");
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
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <Text style={styles.heading}>What's your name?</Text>
      <Text style={styles.subheading}>This is shown to the studio team.</Text>

      <TextInput
        style={styles.input}
        placeholder="Rahul Shah"
        autoCapitalize="words"
        maxLength={100}
        value={name}
        onChangeText={setName}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={handleSetup}
      />

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleSetup}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Continue</Text>
        )}
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#fff" },
  heading: { fontSize: 28, fontWeight: "700", marginBottom: 8 },
  subheading: { fontSize: 15, color: "#666", marginBottom: 32 },
  input: {
    borderBottomWidth: 2,
    borderBottomColor: "#333",
    fontSize: 22,
    paddingVertical: 8,
    marginBottom: 32,
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
