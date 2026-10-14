// A Firebase user can be signed in on the device while the server session
// cookie is missing: the redirect sign-in finished in a tab that lost its
// "I am signing in" flag (iPhone, home-screen app), or the cookie expired
// while the Firebase login is still valid. Signing that person out turns a
// working login into a bounce back to the login page. Instead, rebuild the
// server session from the Firebase login. Only a real refusal (not on the
// staff roster, unverified email) signs the user out.
export interface SessionHealDeps<Claims> {
  getIdToken: () => Promise<string>;
  fetchSessionClaims: () => Promise<Claims | null>;
  resolveClaims: (idToken: string) => Promise<{ changed: boolean } | null>;
  exchangeIdToken: (idToken: string) => Promise<Claims | null>;
  refreshIdToken: () => Promise<string>;
}

export async function claimsForSignedInUser<Claims>(deps: SessionHealDeps<Claims>): Promise<Claims | null> {
  const existing = await deps.fetchSessionClaims();
  if (existing) return existing;
  try {
    let idToken = await deps.getIdToken();
    const resolved = await deps.resolveClaims(idToken);
    if (!resolved) return null;
    if (resolved.changed) idToken = await deps.refreshIdToken();
    return await deps.exchangeIdToken(idToken);
  } catch {
    return null;
  }
}
