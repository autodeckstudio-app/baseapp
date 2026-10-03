import { useState } from "react";
import { Text, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { GoogleAuthProvider, signInWithEmailAndPassword, signInWithPopup } from "firebase/auth";
import type { FirebaseError } from "firebase/app";
import { auth } from "../../lib/firebase";
import { colors, spacing, typography, TextInput, Button } from "@autodeck/ui";

export default function StudioLoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleGoogle() {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      await signInWithPopup(auth, provider);
      router.replace("/(tabs)");
    } catch (err) {
      const code = (err as FirebaseError).code ?? "";
      if (!/popup-closed|cancelled/.test(code)) Alert.alert("Sign in failed", "Could not sign in with Google. Try again.");
    } finally {
      setLoading(false);
    }
  }

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
      style={{ flex: 1, justifyContent: "center", alignSelf: "center", width: "100%", maxWidth: 420, padding: spacing.xxl }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <Text style={{ ...typography.heading, color: colors.textPrimary, marginBottom: spacing.xxs }}>AutoDeck Studio</Text>
      <Text style={{ ...typography.body, color: colors.textMuted, marginBottom: spacing.xxl }}>Staff sign in</Text>

      {Platform.OS === "web" ? (
        <Button label="Continue with Google" onPress={() => void handleGoogle()} loading={loading} />
      ) : (
        <>
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
        </>
      )}
    </KeyboardAvoidingView>
  );
}
