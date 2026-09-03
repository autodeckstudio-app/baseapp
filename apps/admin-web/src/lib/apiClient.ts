import { createApiClient, type ApiClient } from '@autodeck/api-client';
import { environment } from './environment';

/** The minimal shape this module needs from Firebase's `Auth` — kept as a
 * narrow local interface rather than importing `firebase/auth`'s own type,
 * so `createAdminApiClient` is testable with a plain mock, no Firebase SDK
 * involved at all. */
export interface AuthLike {
  currentUser: { getIdToken: () => Promise<string> } | null;
  signOut: () => Promise<void>;
}

/**
 * Wires `@autodeck/api-client`'s generic client to this app's Firebase Auth
 * instance: the token always comes from the CURRENTLY signed-in user (never
 * cached, never client-chosen), and a 401 response triggers sign-out — the
 * same "fail closed on an invalid/expired/revoked session" posture the
 * backend's own `FirebaseAuthGuard` has.
 */
export function createAdminApiClient(auth: AuthLike): ApiClient {
  return createApiClient({
    baseUrl: environment.apiBaseUrl,
    getIdToken: async () => {
      if (!auth.currentUser) {
        return null;
      }
      return auth.currentUser.getIdToken();
    },
    onUnauthorized: () => {
      void auth.signOut();
    },
  });
}
