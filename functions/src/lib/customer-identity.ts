import { HttpsError } from "firebase-functions/v2/https";

/** Counter data is contact data, never proof of email ownership. */
export function assertCustomerProfileIdentity(existing:{id:string;authUid:string;tenantId:string;deletedAt?:string|null;email?:string|null},uid:string,tenantId:string){if(existing.id!==uid||existing.authUid!==uid||existing.tenantId!==tenantId||existing.deletedAt)throw Error('Customer identity needs review');}
export function verifiedCustomerEmail(token:Record<string,unknown>):string|null{if(typeof token['email']!=='string'||!token['email'])return null;if(token['email_verified']!==true)throw Error('Verified email ownership required');return token['email'].trim().toLowerCase();}

/**
 * Resolves the customer DOCUMENT id bound to an Auth uid.
 *
 * Identity key model (staff-first onboarding): every record references the
 * customer doc id. Legacy customers have doc id == authUid; a claimed staged
 * customer has doc id != authUid with the binding stored on the doc
 * (authUid field). Firestore rules enforce the same binding via doc match,
 * so this resolver is the functions-side mirror - never trust a token claim.
 *
 * Invariant (enforced by the claim transaction): at most one non-deleted
 * customer doc per auth uid per tenant. More than one means data corruption:
 * fail closed and alert rather than guess.
 *
 * Returns null when the uid owns no customer profile (e.g. staff accounts,
 * or a customer whose profile was never set up).
 */
export async function resolveCustomerDocId(
  db: {
    collection: (name: string) => {
      doc: (id: string) => { get: () => Promise<{ exists: boolean; data: () => Record<string, unknown> | undefined }> };
      where: (field: string, op: string, value: unknown) => {
        limit: (n: number) => { get: () => Promise<{ docs: { id: string; data: () => Record<string, unknown> | undefined }[] }> };
      };
    };
  },
  customersCollection: string,
  tenantId: string,
  uid: string,
): Promise<string | null> {
  // Fast path: legacy doc (id == authUid). One point read, no query.
  const direct = await db.collection(customersCollection).doc(uid).get();
  if (direct.exists) {
    const d = direct.data()!;
    if (d["authUid"] === uid && d["tenantId"] === tenantId && !d["deletedAt"]) return uid;
    // A doc at this id that is NOT bound to this uid is corrupt - fail closed.
    throw new HttpsError("failed-precondition", "Your profile needs a studio review. No records were linked or changed.");
  }
  // Claimed staged doc: bound via the authUid field. Single-field equality
  // only (auto-indexed; no composite index to provision). authUid bindings
  // are at most one live doc by the claim-transaction invariant, so a
  // limit-3 read plus in-code tenant/deleted filtering cannot scan more.
  const snap = await db
    .collection(customersCollection)
    .where("authUid", "==", uid)
    .limit(3)
    .get();
  const live = snap.docs.filter((doc) => {
    const d = doc.data() ?? {};
    return d["tenantId"] === tenantId && !d["deletedAt"];
  });
  if (live.length > 1) throw new HttpsError("internal", "Customer identity needs a studio review.");
  return live.length === 1 ? live[0]!.id : null;
}

/** Variant for callables that REQUIRE an existing customer profile. */
export async function requireCustomerDocId(
  db: Parameters<typeof resolveCustomerDocId>[0],
  customersCollection: string,
  tenantId: string,
  uid: string,
): Promise<string> {
  const id = await resolveCustomerDocId(db, customersCollection, tenantId, uid);
  if (!id) throw new HttpsError("failed-precondition", "Set up your customer profile first.");
  return id;
}
