import { useState } from "react";
import { Text, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { signInWithEmailAndPassword } from "firebase/auth";
import type { FirebaseError } from "firebase/app";
import { auth } from "../../lib/firebase";
import { colors, spacing, typography, TextInput, Button } from "@autodeck/ui";

export default function StudioLoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email.trim() || !password) return;
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      router.replace("/(tabs)");
    } catch (err) {
      const firebaseErr = err as FirebaseError;
      Alert.alert("Sign in failed", firebaseErr.message ?? "Unknown error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, justifyContent: "center", padding: spacing.xxl, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <Text style={{ ...typography.heading, color: colors.textPrimary, marginBottom: spacing.xxs }}>AutoDeck Studio</Text>
      <Text style={{ ...typography.body, color: colors.textMuted, marginBottom: spacing.xxl }}>Staff sign in</Text>

      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        editable={!loading}
      />
      <TextInput placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry editable={!loading} />

      <Button label="Sign In" onPress={() => void handleLogin()} loading={loading} />
    </KeyboardAvoidingView>
  );
}
