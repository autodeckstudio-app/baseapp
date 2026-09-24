import { useEffect, useState } from "react";
import { View, Text, Alert } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import {
  devGoogleSignIn,
  googleClientIds,
  googleSignInConfigured,
  signInWithGoogleIdToken,
  useEmulator,
} from "../../lib/auth-service";
import { colors, spacing, typography, TextInput, Button } from "@autodeck/ui";

// Lets the auth browser session hand its result back to the app.
WebBrowser.maybeCompleteAuthSession();

// Google-only customer sign-in. After Firebase has the user, the root layout
// routes to /(auth)/setup (profile + claims) or straight into the app.
export default function LoginScreen() {
  return (
    <View style={{ flex: 1, justifyContent: "center", padding: spacing.xl, backgroundColor: colors.background }}>
      <Text style={{ ...typography.display, color: colors.textPrimary, marginBottom: spacing.xs }}>AutoDeck</Text>
      <Text style={{ ...typography.body, color: colors.textMuted, marginBottom: spacing.xxl }}>
        Book, track and pay for your car's care.
      </Text>
      {googleSignInConfigured() ? <GoogleButton /> : null}
      {useEmulator ? <DevSignIn /> : null}
      {!googleSignInConfigured() && !useEmulator ? (
        <Text style={{ ...typography.body, color: colors.textMuted }}>
          Sign-in isn't set up in this build yet.
        </Text>
      ) : null}
    </View>
  );
}

function GoogleButton() {
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    ...googleClientIds(),
    selectAccount: true,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (response?.type !== "success") {
      if (response) setLoading(false);
      return;
    }
    const idToken = response.params["id_token"];
    if (!idToken) {
      setLoading(false);
      Alert.alert("Sign-in failed", "Google didn't return a sign-in token. Please try again.");
      return;
    }
    signInWithGoogleIdToken(idToken)
      .catch((err: unknown) => {
        Alert.alert("Sign-in failed", err instanceof Error ? err.message : "Please try again.");
      })
      .finally(() => setLoading(false));
  }, [response]);

  return (
    <Button
      label="Continue with Google"
      loading={loading}
      disabled={!request}
      onPress={() => {
        setLoading(true);
        void promptAsync();
      }}
    />
  );
}

// Emulator-only: sign in as any Google account without real client IDs.
function DevSignIn() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  return (
    <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
      <Text style={{ ...typography.caption, color: colors.textMuted }}>Emulator dev sign-in</Text>
      <TextInput
        placeholder="someone@gmail.com"
        keyboardType="email-address"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
      />
      <Button
        label="Dev sign-in"
        loading={loading}
        onPress={() => {
          setLoading(true);
          devGoogleSignIn(email.trim().toLowerCase(), email.split("@")[0] ?? "Dev User")
            .catch((err: unknown) => Alert.alert("Dev sign-in failed", err instanceof Error ? err.message : String(err)))
            .finally(() => setLoading(false));
        }}
      />
    </View>
  );
}
