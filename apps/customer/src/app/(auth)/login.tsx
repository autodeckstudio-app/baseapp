import { useEffect, useRef, useState } from "react";
import { Platform, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { signInWithNativeGoogle } from "../../lib/native-google-signin";
import { TextInput } from "@autodeck/ui";
import { space } from "@autodeck/ui/theme";
import { AuthButton } from "@autodeck/ui/native";
import { LoginStage } from "../../ui/LoginStage";
import {
  completeGoogleRedirect,
  devGoogleSignIn,
  googleSignInConfigured,
  signInWithGooglePopup,
  signInWithGoogleRedirect,
  useEmulator,
} from "../../lib/auth-service";
import {
  currentUserAgent,
  isInAppBrowser,
  isIosBrowser,
  shouldFallBackToRedirect,
} from "../../lib/browser";
import { Button, Kicker, T } from "../../ui/kit";

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
  // Returning from a redirect sign-in: surface its error, if any. A
  // successful result reaches the auth listener and the navigation guard
  // routes into the app, exactly as after a successful popup.
  useEffect(() => {
    if (!web) return;
    completeGoogleRedirect().catch((e: unknown) => setError(friendly(e)));
  }, [web]);
  return (
    <LoginStage title="Welcome to AutoDeck" error={error}>
      {web ? <WebGoogleButton onError={setError} /> : googleSignInConfigured() ? <GoogleButton onError={setError} /> : null}
      {useEmulator ? <DevSignIn onError={setError} /> : null}
      {!web && !googleSignInConfigured() && !useEmulator ? <T tone="tertiary">Sign-in isn't set up in this build yet.</T> : null}
    </LoginStage>
  );
}

function WebGoogleButton({ onError }: { onError: (m: string | null) => void }) {
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  return (
    <AuthButton dark soft
      testID="google-sign-in"
      label="Continue with Google"
      busy={busy}
      onPress={() => {
        if (inFlight.current) return;
        inFlight.current = true;
        setBusy(true);
        onError(null);
        const fail = (e: unknown) => {
          onError(friendly(e));
          inFlight.current = false;
          setBusy(false);
        };
        const ua = currentUserAgent();
        const touchPoints = typeof navigator === "undefined" ? 0 : ((navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints ?? 0);
        if (isInAppBrowser(ua)) {
          // In-app webviews (WhatsApp/Instagram/Facebook links) can do
          // neither: popups never post back, and Google refuses OAuth from
          // embedded user agents, so a redirect would dead-end too. Say so
          // honestly instead of looping.
          onError("This app's built-in browser can't sign in with Google. Open app.autodeck.in/login in Chrome or Safari and try there.");
          inFlight.current = false;
          setBusy(false);
          return;
        }
        if (isIosBrowser(ua, touchPoints)) {
          // Popups can never report back here; full-page redirect instead.
          // The page unloads on success and the guard routes in on return.
          signInWithGoogleRedirect().catch(fail);
          return;
        }
        // On success keep the button busy: the navigation guard replaces this
        // screen once the session is ready, so the login screen does not
        // flash back. The timer releases the button if that never happens.
        signInWithGooglePopup()
          .then(() => { setTimeout(() => { inFlight.current = false; setBusy(false); }, 10000); })
          .catch((e: unknown) => {
            const code = (e as { code?: string } | null)?.code;
            if (shouldFallBackToRedirect(code)) {
              // This browser can't do popups here; retry by redirect.
              signInWithGoogleRedirect().catch(fail);
              return;
            }
            fail(e);
          });
      }}
    />
  );
}

function GoogleButton({ onError }: { onError: (m: string | null) => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <AuthButton dark soft
      label="Continue with Google"
      busy={busy}
      onPress={() => {
        setBusy(true);
        onError(null);
        void signInWithNativeGoogle()
          .catch((e: unknown) => onError(friendly(e)))
          .finally(() => setBusy(false));
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
