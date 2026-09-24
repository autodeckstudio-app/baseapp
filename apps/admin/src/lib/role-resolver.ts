// Server-only. Resolves which AutoDeck role a verified Google account holds
// and keeps the account's custom claims in step with that answer.
//
// Ported from the legacy app's Google sign-in model (owner email -> admin,
// active roster email -> staff, everyone else -> customer), with two
// changes: the answer lives in Firebase custom claims instead of a
// client-writable profile field, and it is computed here with the Admin SDK
// so no client can grant itself a role.
import type { Auth, DecodedIdToken } from "firebase-admin/auth";
import type { Firestore } from "firebase-admin/firestore";
import { FIRST_TENANT_ID, type Employee } from "@autodeck/core";
import type { AutoDeckClaims } from "@autodeck/auth";

export const DEFAULT_OWNER_EMAIL = "autodeckstudio@gmail.com";

export function ownerEmail(): string {
  return (process.env["AUTODECK_OWNER_EMAIL"] ?? DEFAULT_OWNER_EMAIL).trim().toLowerCase();
}

export interface RosterMatch {
  id: string;
  role: Employee["role"];
  studioId: string | null;
  tenantId: string;
}

// An unverified email is a claim, not an identity. Google always verifies,
// but any provider enabled later in the console could mint a token carrying
// someone else's address. Only a verified email can match the owner or the
// roster.
export function verifiedEmail(decoded: Pick<DecodedIdToken, "email" | "email_verified">): string | null {
  if (decoded.email_verified !== true || typeof decoded.email !== "string") return null;
  const email = decoded.email.trim().toLowerCase();
  return email || null;
}

export function claimsFor(email: string | null, roster: RosterMatch | null): AutoDeckClaims {
  if (email && email === ownerEmail()) {
    return { role: "admin", tenantId: FIRST_TENANT_ID, studioId: null };
  }
  if (email && roster) {
    return {
      role: roster.role,
      tenantId: roster.tenantId,
      studioId: roster.role === "admin" ? null : roster.studioId,
    };
  }
  return { role: "customer", tenantId: FIRST_TENANT_ID, studioId: null };
}

export function sameClaims(current: Record<string, unknown>, next: AutoDeckClaims): boolean {
  return (
    current["role"] === next.role &&
    current["tenantId"] === next.tenantId &&
    (current["studioId"] ?? null) === (next.studioId ?? null)
  );
}

export async function findActiveRosterEntry(db: Firestore, email: string): Promise<RosterMatch | null> {
  const snap = await db
    .collection("employees")
    .where("email", "==", email)
    .where("active", "==", true)
    .limit(1)
    .get();
  const doc = snap.docs[0];
  if (!doc) return null;
  const data = doc.data() as Partial<Employee>;
  if (data.role !== "studio" && data.role !== "admin") return null;
  if (typeof data.tenantId !== "string") return null;
  return { id: doc.id, role: data.role, studioId: data.studioId ?? null, tenantId: data.tenantId };
}

export interface Resolution {
  claims: AutoDeckClaims;
  changed: boolean;
}

// Computes the account's role and writes it to custom claims when it
// differs. Promotion and demotion both happen here: a deactivated or
// removed roster entry drops the account back to customer on its next
// sign-in. Existing superadmin claims (platform operators) are left alone.
export async function resolveAndSyncClaims(
  auth: Auth,
  db: Firestore,
  decoded: DecodedIdToken,
): Promise<Resolution> {
  if (decoded["role"] === "superadmin") {
    return {
      claims: {
        role: "superadmin",
        tenantId: String(decoded["tenantId"] ?? FIRST_TENANT_ID),
        studioId: null,
      },
      changed: false,
    };
  }
  const email = verifiedEmail(decoded);
  const roster = email && email !== ownerEmail() ? await findActiveRosterEntry(db, email) : null;
  const claims = claimsFor(email, roster);
  if (sameClaims(decoded, claims)) return { claims, changed: false };

  await auth.setCustomUserClaims(decoded.uid, {
    role: claims.role,
    tenantId: claims.tenantId,
    studioId: claims.studioId,
  });
  if (roster) {
    await db.collection("employees").doc(roster.id).set(
      { authUid: decoded.uid, updatedAt: new Date().toISOString() },
      { merge: true },
    );
  }
  return { claims, changed: true };
}
