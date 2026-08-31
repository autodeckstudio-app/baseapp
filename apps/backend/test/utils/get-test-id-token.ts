import type * as admin from 'firebase-admin';
import type { PermissionRole } from '../../src/auth/role.type';

/**
 * Test-only helper: creates (or reuses) an emulator user, sets their `role`
 * custom claim via the Admin SDK, mints a custom token, then exchanges it
 * for a real ID token via the Auth emulator's REST endpoint — the only way
 * to get a genuine, verifiable ID token to send as a Bearer token in tests.
 * Only ever talks to the local emulator (FIREBASE_AUTH_EMULATOR_HOST).
 */
export async function getTestIdToken(
  app: admin.app.App,
  uid: string,
  role: PermissionRole,
): Promise<string> {
  try {
    await app.auth().createUser({ uid });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code !== 'auth/uid-already-exists') {
      throw err;
    }
  }

  await app.auth().setCustomUserClaims(uid, { role });
  const customToken = await app.auth().createCustomToken(uid);

  const authEmulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  if (!authEmulatorHost) {
    throw new Error('FIREBASE_AUTH_EMULATOR_HOST must be set to exchange a custom token in tests');
  }

  const response = await fetch(
    `http://${authEmulatorHost}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=fake-api-key`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to exchange custom token via the Auth emulator: ${response.status}`);
  }

  const data = (await response.json()) as { idToken: string };
  return data.idToken;
}
