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
 * Identical in shape to admin-web's own `sessionState.ts` — deliberately
 * NOT extracted into a shared package for Phase 3A (see the implementation
 * summary: no shared RN/web UI-logic package existed before this phase,
 * and introducing one is a bigger architectural decision than this
 * foundation phase calls for).
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
