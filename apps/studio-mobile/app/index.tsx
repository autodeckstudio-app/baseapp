import { Redirect } from 'expo-router';
import { useAuth } from '../src/auth/AuthProvider';
import { LoadingState, Screen } from '../src/ui/primitives';

/**
 * Pure traffic director: while auth state is resolving, shows the loading
 * state; once resolved, redirects to `/home` (any signed-in staff account —
 * see `sessionState.ts`'s comment on why there is no role sub-boundary
 * here, unlike admin-web) or `/login`.
 */
export default function Index() {
  const { session } = useAuth();

  if (session.status === 'loading') {
    return (
      <Screen>
        <LoadingState label="Loading AutoDeck Studio…" />
      </Screen>
    );
  }

  return <Redirect href={session.status === 'authenticated' ? '/home' : '/login'} />;
}
