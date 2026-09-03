import { Redirect, Slot } from 'expo-router';
import { useAuth } from '../../src/auth/AuthProvider';
import { LoadingState, Screen } from '../../src/ui/primitives';

/**
 * The authenticated navigation boundary for the whole studio app: an
 * unauthenticated session is redirected to `/login` rather than ever
 * seeing app content. Any signed-in staff account (staff, studio_manager,
 * or owner_admin — all three use this same app per the approved product
 * decisions) passes this gate; finer role-scoped screens (e.g. a future
 * staff-management screen limited to Studio Manager+) are a later phase's
 * concern, not this foundation's.
 */
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
