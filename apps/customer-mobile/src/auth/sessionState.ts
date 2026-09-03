export type SessionState = { status: 'loading' } | { status: 'unauthenticated' } | { status: 'authenticated'; uid: string };

/**
 * Deliberately simpler than studio-mobile's/admin-web's `sessionState.ts`:
 * customers never receive a `role` custom claim at all — per the backend
 * architecture verified across every backend phase, `FirebaseAuthGuard`
 * only recognizes `staff`/`studio_manager`/`owner_admin`, and there is no
 * customer-facing backend write endpoint anywhere (customers read their
 * own data directly against Firestore, scoped by `request.auth.uid`, per
 * the existing rules — never through this app's future API calls in the
 * same way staff/admin do). So "authenticated" here means only "has a
 * signed-in Firebase user" — checking for a role claim would be wrong for
 * this app, not merely unnecessary.
 */
export function deriveSessionState(user: { uid: string } | null): SessionState {
  if (user === null) {
    return { status: 'unauthenticated' };
  }
  return { status: 'authenticated', uid: user.uid };
}
