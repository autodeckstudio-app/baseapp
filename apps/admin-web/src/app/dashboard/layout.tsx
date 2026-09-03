'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../auth/AuthProvider';
import { canAccessAdminDashboard } from '../../auth/roleAccess';
import { Button, LoadingState, Screen } from '../../ui/primitives';

/**
 * The authenticated/authorized navigation boundary for the entire admin
 * dashboard: unauthenticated users, and authenticated users whose role
 * isn't Owner/Admin or Studio Manager (e.g. Staff), are redirected to
 * `/login` rather than ever seeing dashboard content — this is the UI-side
 * enforcement Phase 3A asks for. It grants no actual authority: every
 * backend call this dashboard ever makes is independently re-checked by
 * the backend's own `RolesGuard`, regardless of what this layout decides.
 */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { session, signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (session.status === 'unauthenticated') {
      router.replace('/login');
      return;
    }
    if (session.status === 'authenticated' && !canAccessAdminDashboard(session.role)) {
      router.replace('/login');
    }
  }, [session, router]);

  const authorized = session.status === 'authenticated' && canAccessAdminDashboard(session.role);

  if (!authorized) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  return (
    <Screen>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <strong>AutoDeck Admin</strong>
        <Button variant="secondary" onClick={() => void signOut()}>
          Log out
        </Button>
      </header>
      {children}
    </Screen>
  );
}
