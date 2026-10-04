import { useEffect, useState } from "react";
import { Text, View, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { GoogleAuthProvider, getRedirectResult, signInWithEmailAndPassword, signInWithPopup, signInWithRedirect } from "firebase/auth";
import type { FirebaseError } from "firebase/app";
import { auth } from "../../lib/firebase";
import { colors, spacing, typography, TextInput, Button } from "@autodeck/ui";
import { AuthButton, AuthCard } from "@autodeck/ui/native";

export default function StudioLoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  // Coming back from a full-page Google redirect (used on iPhone Safari): pick up the result or show why it failed.
  useEffect(() => {
    if (Platform.OS !== "web") return;
    getRedirectResult(auth).then((r) => { if (r) router.replace("/(tabs)"); }).catch((e) => setProblem(`Sign in did not finish (${(e as FirebaseError).code ?? "unknown"}).`));
  }, [router]);

  async function handleGoogle() {
    setLoading(true);
    setProblem(null);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    try {
      await signInWithPopup(auth, provider);
      router.replace("/(tabs)");
    } catch (e) {
      const code = (e as FirebaseError).code ?? "";
      if (/popup-closed|cancelled-popup/.test(code)) {
        // Person closed the window: nothing to report.
      } else if (/popup-blocked|operation-not-supported|web-storage-unsupported|internal-error|argument-error/.test(code)) {
        // Popups are blocked on some phones and in-app browsers: use a full-page redirect.
        try {
          await signInWithRedirect(auth, provider);
          return;
        } catch (e2) {
          setProblem(`Could not open Google sign in (${(e2 as FirebaseError).code ?? "unknown"}). Try Chrome, or open the link in your browser app.`);
        }
      } else {
        setProblem(`Could not sign in with Google (${code || "unknown"}).`);
      }
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
    <AuthCard role="Studio staff" title="Sign in to the studio" copy="Today's cars, walk-ins and bays, for the studio team." error={problem}>
      {Platform.OS === "web" ? (
        <AuthButton label="Continue with Google" onPress={() => void handleGoogle()} busy={loading} />
      ) : (
        <>
          <TextInput placeholder="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} editable={!loading} />
          <TextInput placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry editable={!loading} />
          <AuthButton label="Sign In" onPress={() => void handleLogin()} busy={loading} />
        </>
      )}
    </AuthCard>
  );
}
