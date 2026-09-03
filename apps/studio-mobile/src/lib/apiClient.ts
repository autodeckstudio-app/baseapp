import { createApiClient, type ApiClient } from '@autodeck/api-client';
import { environment } from './environment';

/** Kept as a narrow local interface (not `firebase/auth`'s own `Auth`
 * type) so `createStudioApiClient` is testable with a plain mock. */
export interface AuthLike {
  currentUser: { getIdToken: () => Promise<string> } | null;
  signOut: () => Promise<void>;
}

/**
 * Wires `@autodeck/api-client`'s generic client to this app's Firebase Auth
 * instance: the token always comes from the CURRENTLY signed-in user, and
 * a 401 response triggers sign-out — the same "fail closed on an invalid/
 * expired/revoked session" posture the backend's own `FirebaseAuthGuard`
 * has. Identical wiring to admin-web's `apiClient.ts` — see that file's
 * comment for why this isn't extracted into a shared package yet.
 */
export function createStudioApiClient(auth: AuthLike): ApiClient {
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
