import { useEffect, useState } from "react";
import { Platform, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import { TextInput } from "@autodeck/ui";
import { space } from "@autodeck/ui/theme";
import { AuthButton, AuthCard } from "@autodeck/ui/native";
import {
  devGoogleSignIn,
  googleClientIds,
  googleSignInConfigured,
  signInWithGoogleIdToken,
  signInWithGooglePopup,
  useEmulator,
} from "../../lib/auth-service";
import { Button, Kicker, Pane, T } from "../../ui/kit";

// Lets the auth browser session hand its result back to the app.
WebBrowser.maybeCompleteAuthSession();

function friendly(err: unknown): string {
  const code = (err as { code?: string } | null)?.code ?? "";
  if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return "Sign-in was cancelled.";
  if (code === "auth/popup-blocked") return "Your browser blocked the Google window. Allow pop-ups and try again.";
  if (code === "auth/unauthorized-domain") return "This address isn't allowed to sign in yet.";
  return "Couldn't sign you in. Please try again.";
}

// Google-only customer sign-in. After Firebase has the user, the root layout
// routes to /(auth)/setup (profile + claims) or straight into the app.
export default function LoginScreen() {
  const [error, setError] = useState<string | null>(null);
  const web = Platform.OS === "web";
  return (
    <AuthCard role="Customer" title="Welcome to AutoDeck" copy="Book services, follow your car's visit and keep every bill and warranty in one place." error={error}>
      {web ? <WebGoogleButton onError={setError} /> : googleSignInConfigured() ? <GoogleButton onError={setError} /> : null}
      {!web && useEmulator ? <DevSignIn onError={setError} /> : null}
      {!web && !googleSignInConfigured() && !useEmulator ? <T tone="tertiary">Sign-in isn't set up in this build yet.</T> : null}
    </AuthCard>
  );
}

function WebGoogleButton({ onError }: { onError: (m: string | null) => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <AuthButton
      testID="google-sign-in"
      label="Continue with Google"
      busy={busy}
      onPress={() => {
        setBusy(true);
        onError(null);
        signInWithGooglePopup()
          .catch((e: unknown) => onError(friendly(e)))
          .finally(() => setBusy(false));
      }}
    />
  );
}

function GoogleButton({ onError }: { onError: (m: string | null) => void }) {
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    ...googleClientIds(),
    selectAccount: true,
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (response?.type !== "success") {
      if (response) setBusy(false);
      return;
    }
    const idToken = response.params["id_token"];
    if (!idToken) {
      setBusy(false);
      onError("Google didn't return a sign-in token. Please try again.");
      return;
    }
    signInWithGoogleIdToken(idToken)
      .catch((e: unknown) => onError(friendly(e)))
      .finally(() => setBusy(false));
  }, [response]);

  return (
    <AuthButton
      label="Continue with Google"
      busy={busy}
      disabled={!request}
      onPress={() => {
        setBusy(true);
        onError(null);
        void promptAsync();
      }}
    />
  );
}

// Emulator-only: sign in as any Google account without real client IDs.
function DevSignIn({ onError }: { onError: (m: string | null) => void }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <View style={{ marginTop: space.gap, gap: space.breath }}>
      <Kicker>Emulator dev sign-in</Kicker>
      <TextInput placeholder="someone@gmail.com" keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} />
      <Button
        kind="quiet"
        label="Dev sign-in"
        busy={busy}
        onPress={() => {
          setBusy(true);
          devGoogleSignIn(email.trim().toLowerCase(), email.split("@")[0] ?? "Dev User")
            .catch((e: unknown) => onError(e instanceof Error ? e.message : String(e)))
            .finally(() => setBusy(false));
        }}
      />
    </View>
  );
}
