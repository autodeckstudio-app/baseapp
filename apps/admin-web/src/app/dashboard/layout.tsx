'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../../auth/AuthProvider';
import { canAccessAdminDashboard } from '../../auth/roleAccess';
import { AdminShell, LoadingState, Screen } from '../../ui/primitives';

const SECTIONS = [
  { key: 'Overview', label: 'Overview', href: '/dashboard' },
  { key: 'Bookings', label: 'Bookings', href: '/dashboard/bookings' },
  { key: 'Customers', label: 'Customers', href: '/dashboard/customers' },
  { key: 'Vehicles', label: 'Vehicles', href: '/dashboard/vehicles' },
  { key: 'Services', label: 'Services', href: '/dashboard/services' },
  { key: 'Packages', label: 'Packages', href: '/dashboard/packages' },
  { key: 'Staff', label: 'Staff', href: '/dashboard/staff' },
  { key: 'Payments', label: 'Payments', href: '/dashboard/payments' },
  { key: 'Reports', label: 'Reports', href: '/dashboard/reports' },
  { key: 'Settings', label: 'Settings', href: '/dashboard/settings' },
];

/**
 * SAME authorization boundary as before this pass — unauthenticated or
 * insufficient-role sessions (e.g. Staff) redirect to `/login`, unchanged.
 * Only the shell changed: a persistent sidebar + header replaces the
 * previous single inline header, per the approved desktop-first
 * requirement. `canAccessAdminDashboard` itself was not touched.
 */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { session, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

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

  const currentSection = SECTIONS.slice().reverse().find((s) => pathname.startsWith(s.href))?.key ?? 'Overview';

  return (
    <AdminShell sections={SECTIONS} currentSection={currentSection} onSignOut={() => void signOut()}>
      {children}
    </AdminShell>
  );
}
