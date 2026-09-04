import type { ReactNode } from 'react';
import { Redirect, usePathname } from 'expo-router';
import { useAuth } from './AuthProvider';
import { LoadingState, Screen } from '../ui/primitives';

/**
 * Gates Garage and Bookings (per the approved navigation behaviour — these
 * are the two tabs that "require authentication" outright, unlike Home and
 * You which stay reachable and render a session-aware state instead).
 * Redirects to `/login` with the current path as `redirectTo` so a
 * successful sign-in returns the user to exactly the screen they were
 * attempting, per the approved requirement.
 *
 * Promoted to a shared component per the Expo design-system rule: it
 * appears in 4 screens (Garage list/detail, Bookings list/detail), has a
 * nameable role, and its API (one prop) is smaller than its implementation.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const pathname = usePathname();

  if (session.status === 'loading') {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  if (session.status !== 'authenticated') {
    return <Redirect href={{ pathname: '/login', params: { redirectTo: pathname } }} />;
  }

  return <>{children}</>;
}
