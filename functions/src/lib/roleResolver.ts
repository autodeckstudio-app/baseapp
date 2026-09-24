// Mirror of apps/admin/src/lib/role-resolver.ts for Cloud Functions.
// Keep the two in step: same inputs, same answer.
//
// owner email (verified)            -> admin
// active roster entry (verified)    -> that roster role / studio
// anyone else                       -> customer
// existing superadmin               -> untouched
import type { Auth } from "firebase-admin/auth";
import type { Firestore } from "firebase-admin/firestore";
import { FIRST_TENANT_ID, type Employee } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import type { AutoDeckClaims } from "@autodeck/auth";

export const DEFAULT_OWNER_EMAIL = "autodeckstudio@gmail.com";

export function ownerEmail(): string {
  return (process.env["AUTODECK_OWNER_EMAIL"] ?? DEFAULT_OWNER_EMAIL).trim().toLowerCase();
}

export interface TokenFacts {
  uid: string;
  email?: unknown;
  email_verified?: unknown;
  [claim: string]: unknown;
}

export function verifiedEmail(t: Pick<TokenFacts, "email" | "email_verified">): string | null {
  if (t.email_verified !== true || typeof t.email !== "string") return null;
  return t.email.trim().toLowerCase() || null;
}

export async function resolveClaims(auth: Auth, db: Firestore, token: TokenFacts): Promise<{ claims: AutoDeckClaims; changed: boolean }> {
  if (token["role"] === "superadmin") {
    return {
      claims: { role: "superadmin", tenantId: String(token["tenantId"] ?? FIRST_TENANT_ID), studioId: null },
      changed: false,
    };
  }
  const email = verifiedEmail(token);
  let claims: AutoDeckClaims = { role: "customer", tenantId: FIRST_TENANT_ID, studioId: null };
  let rosterId: string | null = null;
  if (email && email === ownerEmail()) {
    claims = { role: "admin", tenantId: FIRST_TENANT_ID, studioId: null };
  } else if (email) {
    const snap = await db
      .collection(COLLECTIONS.employees())
      .where("email", "==", email)
      .where("active", "==", true)
      .limit(1)
      .get();
    const doc = snap.docs[0];
    const data = doc?.data() as Partial<Employee> | undefined;
    if (doc && data && (data.role === "studio" || data.role === "admin") && typeof data.tenantId === "string") {
      rosterId = doc.id;
      claims = {
        role: data.role,
        tenantId: data.tenantId,
        studioId: data.role === "admin" ? null : (data.studioId ?? null),
      };
    }
  }
  const same =
    token["role"] === claims.role &&
    token["tenantId"] === claims.tenantId &&
    (token["studioId"] ?? null) === claims.studioId;
  if (same) return { claims, changed: false };

  await auth.setCustomUserClaims(token.uid, { ...claims });
  if (rosterId) {
    await db
      .collection(COLLECTIONS.employees())
      .doc(rosterId)
      .set({ authUid: token.uid, updatedAt: new Date().toISOString() }, { merge: true });
  }
  return { claims, changed: true };
}
