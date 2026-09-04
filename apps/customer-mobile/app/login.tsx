import { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { getFirebaseAuth } from '../src/lib/firebase';
import { spacingScale } from '@autodeck/design-tokens';
import { Button, Card, ErrorState, Field, Screen, ThemedText } from '../src/ui/primitives';

/**
 * Email/password sign-in — the approved spec (§D.9) calls for Google
 * Sign-In only for customers, which needs real Google OAuth client
 * credentials this repository does not have and must never fabricate (see
 * the Phase 3A implementation summary). This foundation is built so
 * swapping in Google Sign-In later touches only this one screen.
 *
 * Reached contextually (from a gated tab, or a "Sign in" action), never as
 * a forced entry gate. `redirectTo` carries the exact route the visitor
 * was attempting, so a successful sign-in resumes there instead of always
 * landing on Home, per the approved navigation behaviour.
 */
export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { redirectTo } = useLocalSearchParams<{ redirectTo?: string }>();

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
      router.replace((redirectTo as Href) ?? '/(tabs)/home');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <View style={{ padding: spacingScale.lg, flex: 1, justifyContent: 'center' }}>
        {router.canGoBack() && (
          <View style={{ position: 'absolute', top: spacingScale.lg, left: spacingScale.lg }}>
            <Button variant="ghost" onPress={() => router.back()}>
              Cancel
            </Button>
          </View>
        )}
        <Card elevation="raised">
          <ThemedText level="heading" style={{ marginBottom: spacingScale.xs }}>
            AutoDeck
          </ThemedText>
          <ThemedText level="body" color="secondary" style={{ marginBottom: spacingScale.md }}>
            Sign in to continue.
          </ThemedText>
          <Field
            label="Email"
            placeholder="you@example.com"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <Field
            label="Password"
            placeholder="••••••••"
            secureTextEntry
            autoComplete="password"
            value={password}
            onChangeText={setPassword}
          />
          {error && <ErrorState message={error} />}
          <Button onPress={handleSubmit} disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </Card>
      </View>
    </Screen>
  );
}
