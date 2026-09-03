import { isPermissionRole, type PermissionRole } from '@autodeck/domain';

export type SessionState =
  | { status: 'loading' }
  | { status: 'unauthenticated' }
  | { status: 'authenticated'; uid: string; role: PermissionRole };

/**
 * Derives the UI's session state from Firebase Auth's own signals — never
 * from anything the client itself decides. `role` comes ONLY from the
 * verified Firebase ID token's `role` custom claim (`claims.role`, read via
 * `getIdTokenResult`), exactly mirroring the backend's own
 * `FirebaseAuthGuard`. A signed-in user whose token carries no valid role
 * claim is treated as unauthenticated here — fails closed, grants no
 * default access — rather than falling back to some assumed role.
 * `jobTitle` (or any other claim) is never consulted for this decision.
 *
 * This is a pure function specifically so it's testable without mocking
 * the Firebase SDK at all — `AuthProvider` is the only thing that ever
 * calls it with real `onAuthStateChanged`/`getIdTokenResult` values.
 */
export function deriveSessionState(
  user: { uid: string } | null,
  claims: Record<string, unknown> | null,
): SessionState {
  if (user === null) {
    return { status: 'unauthenticated' };
  }
  const role = claims?.role;
  if (!isPermissionRole(role)) {
    return { status: 'unauthenticated' };
  }
  return { status: 'authenticated', uid: user.uid, role };
}
