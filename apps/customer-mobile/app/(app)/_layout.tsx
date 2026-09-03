import { Redirect, Slot } from 'expo-router';
import { useAuth } from '../../src/auth/AuthProvider';
import { LoadingState, Screen } from '../../src/ui/primitives';

/** The authenticated navigation boundary for the whole customer app: an
 * unauthenticated session is redirected to `/login` rather than ever
 * seeing app content. */
export default function AppLayout() {
  const { session } = useAuth();

  if (session.status === 'loading') {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }
  if (session.status !== 'authenticated') {
    return <Redirect href="/login" />;
  }

  return <Slot />;
}
