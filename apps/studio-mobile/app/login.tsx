import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { getFirebaseAuth } from '../src/lib/firebase';
import { spacingScale } from '@autodeck/design-tokens';
import { Button, Card, ErrorState, Field, Screen, ThemedText } from '../src/ui/primitives';

/**
 * Email/password sign-in for staff accounts — see the Phase 3A
 * implementation summary for why (no invite/password-reset flow exists
 * yet). Restyled onto the shared token/primitive system this pass — no
 * change to the sign-in behavior itself.
 */
export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
      router.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <View style={{ padding: spacingScale.lg, flex: 1, justifyContent: 'center' }}>
        <Card elevation="raised">
          <ThemedText level="heading" style={{ marginBottom: spacingScale.xs }}>
            AutoDeck Studio
          </ThemedText>
          <ThemedText level="body" color="secondary" style={{ marginBottom: spacingScale.md }}>
            Sign in with your staff account.
          </ThemedText>
          <Field
            label="Email"
            placeholder="you@autodeck.studio"
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
