import { useState } from 'react';
import { Text, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { getFirebaseAuth } from '../src/lib/firebase';
import { Button, Card, ErrorState, Screen } from '../src/ui/primitives';

/**
 * Email/password sign-in for staff accounts — see the Phase 3A
 * implementation summary for why (Phase 2B's StaffService creates accounts
 * with no password set at creation, and no invite/password-reset flow
 * exists in any backend phase yet; this foundation just needs a working
 * Firebase sign-in path against the emulator, not a real onboarding flow).
 */
export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

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
      <Card>
        <Text style={{ fontSize: 20, fontWeight: '600', marginBottom: 4 }}>AutoDeck Studio</Text>
        <Text style={{ marginBottom: 12 }}>Sign in with your staff account.</Text>
        <TextInput
          placeholder="Email"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          style={{ borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 6, padding: 8, marginBottom: 8 }}
        />
        <TextInput
          placeholder="Password"
          secureTextEntry
          autoComplete="password"
          value={password}
          onChangeText={setPassword}
          style={{ borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 6, padding: 8, marginBottom: 12 }}
        />
        {error && <ErrorState message={error} />}
        <Button onPress={handleSubmit} disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </Card>
    </Screen>
  );
}
