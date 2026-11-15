import type { Payment } from "@autodeck/core";
import type { Firestore } from "firebase-admin/firestore";
import { obtainMembershipPaymentLink } from "./membership-payment-link.js";
import { getPaymentProvider } from "./razorpay-provider.js";

/** Resume the committed payment through its exclusive, reconcile-first link lifecycle. */
export async function membershipPaymentUrl(db: Firestore, p: Payment | undefined, customerPhone = ""): Promise<string | null> {
  if (!p || p.method !== "razorpay_payment_link" || p.status !== "pending") return null;
  const out = await obtainMembershipPaymentLink(db, p, getPaymentProvider(), customerPhone);
  return out.outcome === "link_ready" ? out.paymentUrl : null;
}
