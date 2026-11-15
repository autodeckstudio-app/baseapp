import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";
import type { Membership } from "@autodeck/core";

type GetMyMembershipsInput = { customerId?: string };
type GetMyMembershipsOutput = { memberships: Membership[] };

// Read-only lookup for studio staff to see a customer's membership status
// while handling a job — studio has no authority to create/activate/cancel
// memberships (doc08 §8.2).
export async function getCustomerMembership(
  customerId: string,
  membershipId: string,
): Promise<Membership | null> {
  const fn = httpsCallable<GetMyMembershipsInput, GetMyMembershipsOutput>(functions, "getMyMemberships");
  const result = await fn({ customerId });
  return result.data.memberships.find((m) => m.id === membershipId) ?? null;
}
