'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../auth/AuthProvider';
import { canAccessAdminDashboard } from '../auth/roleAccess';
import { LoadingState, Screen } from '../ui/primitives';

/**
 * Pure traffic director: while auth state is resolving, shows the loading
 * state (the "authentication loading" case Phase 3A requires); once
 * resolved, redirects to `/dashboard` (authorized) or `/login`
 * (unauthenticated, or authenticated but insufficient role — e.g. a Staff
 * account, which admin-web must never grant access to).
 */
export default function RootPage() {
  const { session } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (session.status === 'unauthenticated') {
      router.replace('/login');
    } else if (session.status === 'authenticated') {
      router.replace(canAccessAdminDashboard(session.role) ? '/dashboard' : '/login');
    }
  }, [session, router]);

  return (
    <Screen>
      <LoadingState label="Loading AutoDeck Admin…" />
    </Screen>
  );
}
