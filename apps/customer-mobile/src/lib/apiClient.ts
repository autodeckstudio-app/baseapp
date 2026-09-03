import { createApiClient, type ApiClient } from '@autodeck/api-client';
import { environment } from './environment';

/** Kept as a narrow local interface so `createCustomerApiClient` is
 * testable with a plain mock, no Firebase SDK involved. */
export interface AuthLike {
  currentUser: { getIdToken: () => Promise<string> } | null;
  signOut: () => Promise<void>;
}

/**
 * Wires `@autodeck/api-client`'s generic client to this app's Firebase Auth
 * instance. Note: as of Phase 3A, no customer-facing backend endpoint
 * exists yet (customers read their own data directly against Firestore,
 * per the existing rules) — this client is foundation-only, ready for
 * whichever future phase adds the first real customer-facing endpoint.
 */
export function createCustomerApiClient(auth: AuthLike): ApiClient {
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
