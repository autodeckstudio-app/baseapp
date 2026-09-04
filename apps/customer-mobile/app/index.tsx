import { Redirect } from 'expo-router';
import { useAuth } from '../src/auth/AuthProvider';
import { LoadingState, Screen } from '../src/ui/primitives';

/**
 * Always resolves to the tab shell, regardless of auth status — Home is
 * public and session-aware (see `(tabs)/home.tsx`). This app must never
 * force a visitor through `/login` before they see anything, per the
 * approved navigation behaviour. Only the initial Firebase session
 * resolution (`loading`) blocks here, and only briefly.
 */
export default function Index() {
  const { session } = useAuth();

  if (session.status === 'loading') {
    return (
      <Screen>
        <LoadingState label="Loading AutoDeck…" />
      </Screen>
    );
  }

  return <Redirect href="/(tabs)/home" />;
}
