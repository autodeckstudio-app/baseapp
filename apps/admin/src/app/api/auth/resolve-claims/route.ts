// Google sign-in step 2: work out which AutoDeck role this account holds and
// write it to Firebase custom claims.
//
// Runs as a Next.js Route Handler (Node.js runtime, Admin SDK) so sign-in
// works on the Spark plan, before Cloud Functions are deployed. The client
// sends only its own fresh ID token; the role comes entirely from the
// server's view of the verified email and the staff roster, never from
// anything the client says. See lib/role-resolver.ts.
import { NextResponse, type NextRequest } from "next/server";
import { getAdminAuth, getAdminDb } from "../../../../lib/firebase-admin";
import { resolveAndSyncClaims } from "../../../../lib/role-resolver";

export async function POST(request: NextRequest): Promise<NextResponse> {
  let idToken: unknown;
  try {
    const body = (await request.json()) as { idToken?: unknown };
    idToken = body.idToken;
  } catch {
    return NextResponse.json({ error: "invalid-request" }, { status: 400 });
  }
  if (typeof idToken !== "string" || !idToken) {
    return NextResponse.json({ error: "invalid-request" }, { status: 400 });
  }

  const auth = getAdminAuth();
  let decoded;
  try {
    decoded = await auth.verifyIdToken(idToken, true);
  } catch {
    return NextResponse.json({ error: "invalid-token" }, { status: 401 });
  }
  if (decoded.email_verified !== true) {
    return NextResponse.json({ error: "email-not-verified" }, { status: 403 });
  }

  try {
    const { claims, changed } = await resolveAndSyncClaims(auth, getAdminDb(), decoded);
    // `changed` tells the client to force-refresh its ID token before
    // exchanging it for a session, so the new claims are in the token.
    return NextResponse.json({ claims, changed });
  } catch {
    return NextResponse.json({ error: "resolve-failed" }, { status: 500 });
  }
}
