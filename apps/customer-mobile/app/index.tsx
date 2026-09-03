import { Redirect } from 'expo-router';
import { useAuth } from '../src/auth/AuthProvider';
import { LoadingState, Screen } from '../src/ui/primitives';

/** Pure traffic director — see studio-mobile's identical file. */
export default function Index() {
  const { session } = useAuth();

  if (session.status === 'loading') {
    return (
      <Screen>
        <LoadingState label="Loading AutoDeck…" />
      </Screen>
    );
  }

  return <Redirect href={session.status === 'authenticated' ? '/home' : '/login'} />;
}
